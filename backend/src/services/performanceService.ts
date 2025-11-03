/**
 * Performance Service Layer
 * Implements hierarchical performance analytics with dynamic rollups
 * Based on rollup-api-instructions.md specification
 */

import { getDataWarehouseDatabase } from '../database/datawarehouseConnection.js';
import { ErrorUtils } from '../utils/errors.js';
import logger from '../utils/logger.js';

// Type definitions for performance data
export type DisplayMode = 'network' | 'domain' | 'placement' | 'targeting' | 'special';

export interface PerformanceMetrics {
  cost: number;
  revenue: number;
  sales: number;
  uniqueClicks: number;
  rawClicks: number;
  confirmReg: number;
  rawReg: number;
  ltrev: number;
  // Derived metrics (calculated, not summed)
  roas: number;
  ltRoas: number;
  cprConfirm: number;
  cprRaw: number;
  cps: number;
  rps: number;
  cpcUnique: number;
  cpcRaw: number;
}

export interface HierarchyNode {
  name: string;
  level: string;
  metrics: PerformanceMetrics;
  children?: HierarchyNode[] | PerformanceLeafNode[];
}

export interface PerformanceLeafNode {
  id: number;
  name: string;
  level: string;
  status: string;
  network: string;
  domain: string;
  placement: string;
  targeting: string;
  special: string;
  metrics: PerformanceMetrics;
}

export interface PerformanceQueryFilters {
  displayMode: DisplayMode;
  status?: 'active' | 'paused' | 'completed' | 'all';
  startDate?: string;
  endDate?: string;
  network?: string;
  domain?: string;
}

export interface PerformanceResponse {
  displayMode: DisplayMode;
  hierarchyLevels: string[];
  data: HierarchyNode[] | PerformanceLeafNode[];
  metadata: {
    totalRecords: number;
    dateRange: {
      start: string;
      end: string;
    };
    filtersApplied: Record<string, any>;
  };
}

/**
 * Performance analytics service
 */
export class PerformanceService {
  /**
   * Hierarchy level mapping
   */
  private static readonly HIERARCHY_MAP: Record<DisplayMode, string[]> = {
    network: ['network', 'domain', 'placement', 'targeting', 'special'],
    domain: ['domain', 'placement', 'targeting', 'special'],
    placement: ['placement', 'targeting', 'special'],
    targeting: ['targeting', 'special'],
    special: []
  };

  /**
   * Get performance data with hierarchical rollups
   */
  static async getPerformanceData(filters: PerformanceQueryFilters): Promise<PerformanceResponse> {
    const db = getDataWarehouseDatabase();

    try {
      // Validate display mode
      if (!['network', 'domain', 'placement', 'targeting', 'special'].includes(filters.displayMode)) {
        throw ErrorUtils.badRequest('Invalid display_mode. Must be one of: network, domain, placement, targeting, special');
      }

      // Set default date range (last 30 days)
      const endDate = filters.endDate || new Date().toISOString().split('T')[0];
      const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      logger.info('Fetching performance data', {
        displayMode: filters.displayMode,
        startDate,
        endDate,
        status: filters.status,
        network: filters.network,
        domain: filters.domain
      });

      // Query raw data from database
      const rawData = await this.queryRawData(filters, startDate, endDate);

      logger.info(`Fetched ${rawData.length} raw performance records`);

      // Get hierarchy levels for this display mode
      const hierarchyLevels = this.HIERARCHY_MAP[filters.displayMode];

      // Build response
      let data: HierarchyNode[] | PerformanceLeafNode[];

      if (hierarchyLevels.length === 0) {
        // Flat mode (special)
        data = rawData;
      } else {
        // Hierarchical mode
        data = this.buildHierarchy(rawData, hierarchyLevels, 0);
      }

      return {
        displayMode: filters.displayMode,
        hierarchyLevels,
        data,
        metadata: {
          totalRecords: rawData.length,
          dateRange: {
            start: startDate,
            end: endDate
          },
          filtersApplied: {
            status: filters.status || 'all',
            network: filters.network,
            domain: filters.domain
          }
        }
      };
    } catch (error: any) {
      logger.error('Error fetching performance data', { error: error.message, filters });
      throw error;
    }
  }

  /**
   * Query raw data from database
   */
  private static async queryRawData(
    filters: PerformanceQueryFilters,
    startDate: string,
    endDate: string
  ): Promise<PerformanceLeafNode[]> {
    const db = getDataWarehouseDatabase();

    // Build SQL query
    const conditions: string[] = [];
    const params: any[] = [];

    // Status filter
    if (filters.status && filters.status !== 'all') {
      const statusMap: Record<string, string> = {
        active: 'live',
        paused: 'paused',
        completed: 'unknown'
      };
      conditions.push('c.status = ?');
      params.push(statusMap[filters.status] || filters.status);
    }

    // Network filter
    if (filters.network) {
      conditions.push('ch.network = ?');
      params.push(filters.network);
    }

    // Domain filter
    if (filters.domain) {
      conditions.push('ch.domain = ?');
      params.push(filters.domain);
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // Add date range parameters for cost override filtering (endDate, startDate order for overlap check)
    params.push(endDate, startDate);

    const sql = `
      SELECT
        c.id,
        c.name,
        c.status,
        ch.network,
        ch.domain,
        ch.placement,
        ch.targeting,
        ch.special,
        COALESCE(c.cost, 0) as base_cost,
        MAX(cco.cost) as override_cost,
        MAX(cco.start_date) as override_start,
        MAX(cco.end_date) as override_end,
        COALESCE(SUM(hd.sessions), 0) as sessions,
        COALESCE(SUM(hd.registrations), 0) as registrations,
        COALESCE(SUM(hd.email_accounts), 0) as email_accounts,
        COALESCE(SUM(hd.credit_cards), 0) as credit_cards,
        MIN(datetime(hd.unix_hour * 3600, 'unixepoch')) as first_activity_date,
        MAX(datetime(hd.unix_hour * 3600, 'unixepoch')) as last_activity_date
      FROM campaigns c
      LEFT JOIN campaign_hierarchy ch ON c.id = ch.campaign_id
      LEFT JOIN hourly_data hd ON c.id = hd.campaign_id
      LEFT JOIN campaign_cost_overrides cco ON c.id = cco.campaign_id
        AND cco.is_active = 1
        AND date(cco.start_date) <= date(?)
        AND date(cco.end_date) >= date(?)
      WHERE ch.network IS NOT NULL
        ${whereClause}
      GROUP BY c.id, c.name, c.status, ch.network, ch.domain, ch.placement, ch.targeting, ch.special, c.cost
      ORDER BY c.id
    `;

    const rows = db.executeQuery<any>(sql, params);

    // Transform to PerformanceLeafNode format
    return rows.map(row => {
      const sessions = row.sessions || 0;
      const registrations = row.registrations || 0;
      const emailAccounts = row.email_accounts || 0;
      const creditCards = row.credit_cards || 0;

      // Calculate prorated cost
      let calculatedCost = row.base_cost || 0;

      // Use cost override if available and calculate proration
      if (row.override_cost != null && row.override_start && row.override_end) {
        const queryStartDate = new Date(startDate);
        const queryEndDate = new Date(endDate);
        const overrideStartDate = new Date(row.override_start);
        const overrideEndDate = new Date(row.override_end);

        // Calculate overlap between query range and override period
        const overlapStart = new Date(Math.max(queryStartDate.getTime(), overrideStartDate.getTime()));
        const overlapEnd = new Date(Math.min(queryEndDate.getTime(), overrideEndDate.getTime()));

        if (overlapStart <= overlapEnd) {
          // Calculate total days in override period
          const overrideDays = Math.ceil((overrideEndDate.getTime() - overrideStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          // Calculate overlap days
          const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          // Prorate the override cost
          calculatedCost = (row.override_cost / overrideDays) * overlapDays;
        } else {
          // No overlap, cost is 0 for this period
          calculatedCost = 0;
        }
      } else if (row.first_activity_date && row.last_activity_date && calculatedCost > 0) {
        // FALLBACK: Prorate base cost using campaign activity dates
        const queryStartDate = new Date(startDate);
        const queryEndDate = new Date(endDate);
        const activityStartDate = new Date(row.first_activity_date);
        const activityEndDate = new Date(row.last_activity_date);

        // Calculate overlap between query range and activity period
        const overlapStart = new Date(Math.max(queryStartDate.getTime(), activityStartDate.getTime()));
        const overlapEnd = new Date(Math.min(queryEndDate.getTime(), activityEndDate.getTime()));

        if (overlapStart <= overlapEnd) {
          // Calculate total days in activity period
          const activityDays = Math.ceil((activityEndDate.getTime() - activityStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          // Calculate overlap days
          const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          // Prorate the base cost
          calculatedCost = (calculatedCost / activityDays) * overlapDays;
        } else {
          // No overlap with activity period
          calculatedCost = 0;
        }
      }

      // Calculate derived metrics
      // Note: This is a simplified calculation. Adjust based on your actual business logic
      const revenue = creditCards * 50; // Assuming $50 per credit card signup
      const sales = creditCards;
      const ltrev = revenue * 1.5; // Assuming 1.5x lifetime multiplier

      return {
        id: row.id,
        name: row.name,
        level: 'special',
        status: this.mapStatus(row.status),
        network: row.network || 'Unknown',
        domain: row.domain || 'Unknown',
        placement: row.placement || 'Standard',
        targeting: row.targeting || 'General',
        special: row.special || 'Standard',
        metrics: this.calculateMetrics({
          cost: calculatedCost,
          revenue,
          sales,
          uniqueClicks: sessions, // Using sessions as proxy for unique clicks
          rawClicks: sessions * 1.2, // Estimate raw clicks
          confirmReg: registrations,
          rawReg: emailAccounts,
          ltrev
        })
      };
    });
  }

  /**
   * Build hierarchical structure recursively
   */
  private static buildHierarchy(
    data: PerformanceLeafNode[],
    levels: string[],
    depth: number
  ): HierarchyNode[] {
    if (depth >= levels.length) {
      return data as any;
    }

    const currentLevel = levels[depth];
    const grouped = this.groupBy(data, currentLevel);

    const result: HierarchyNode[] = [];

    for (const [key, items] of Object.entries(grouped)) {
      const node: HierarchyNode = {
        name: key,
        level: currentLevel,
        metrics: this.aggregateMetrics(items)
      };

      if (depth < levels.length - 1) {
        // Has children, recurse
        node.children = this.buildHierarchy(items, levels, depth + 1);
      } else {
        // Leaf level, attach individual records
        node.children = items;
      }

      result.push(node);
    }

    return result;
  }

  /**
   * Group items by a specific field
   */
  private static groupBy(items: PerformanceLeafNode[], field: string): Record<string, PerformanceLeafNode[]> {
    return items.reduce((acc, item) => {
      const key = (item as any)[field] || 'Unknown';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {} as Record<string, PerformanceLeafNode[]>);
  }

  /**
   * Aggregate metrics from multiple items
   * IMPORTANT: Sum additive metrics, calculate derived metrics
   */
  private static aggregateMetrics(items: PerformanceLeafNode[]): PerformanceMetrics {
    // Sum all additive metrics
    const summed = {
      cost: items.reduce((sum, item) => sum + item.metrics.cost, 0),
      revenue: items.reduce((sum, item) => sum + item.metrics.revenue, 0),
      sales: items.reduce((sum, item) => sum + item.metrics.sales, 0),
      uniqueClicks: items.reduce((sum, item) => sum + item.metrics.uniqueClicks, 0),
      rawClicks: items.reduce((sum, item) => sum + item.metrics.rawClicks, 0),
      confirmReg: items.reduce((sum, item) => sum + item.metrics.confirmReg, 0),
      rawReg: items.reduce((sum, item) => sum + item.metrics.rawReg, 0),
      ltrev: items.reduce((sum, item) => sum + item.metrics.ltrev, 0)
    };

    // Calculate derived metrics from summed values
    return this.calculateMetrics(summed);
  }

  /**
   * Calculate all derived metrics
   */
  private static calculateMetrics(summed: {
    cost: number;
    revenue: number;
    sales: number;
    uniqueClicks: number;
    rawClicks: number;
    confirmReg: number;
    rawReg: number;
    ltrev: number;
  }): PerformanceMetrics {
    return {
      ...summed,
      roas: this.safeDivide(summed.revenue, summed.cost),
      ltRoas: this.safeDivide(summed.ltrev, summed.cost),
      cprConfirm: this.safeDivide(summed.cost, summed.confirmReg),
      cprRaw: this.safeDivide(summed.cost, summed.rawReg),
      cps: this.safeDivide(summed.cost, summed.sales),
      rps: this.safeDivide(summed.revenue, summed.sales),
      cpcUnique: this.safeDivide(summed.cost, summed.uniqueClicks),
      cpcRaw: this.safeDivide(summed.cost, summed.rawClicks)
    };
  }

  /**
   * Safe division that handles divide by zero
   */
  private static safeDivide(numerator: number, denominator: number): number {
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Map database status to API status
   */
  private static mapStatus(dbStatus: string): string {
    const statusMap: Record<string, string> = {
      live: 'Active',
      paused: 'Paused',
      unknown: 'Completed'
    };
    return statusMap[dbStatus] || 'Active';
  }
}
