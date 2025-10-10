/**
 * Database query utilities for common operations
 * Provides type-safe database queries for the data warehouse
 */

import { Database as DatabaseType } from 'better-sqlite3';
import { getDatabase } from './connection.js';
import logger from '../utils/logger.js';
import {
  Organization,
  Program,
  Campaign,
  AdSet,
  Ad,
  CampaignQuery,
  MetricsQuery,
  PaginationMeta,
  CampaignSummary,
  PerformanceMetrics
} from '../types/index.js';

/**
 * Database query utilities class
 */
export class DatabaseQueries {
  private db: DatabaseType;

  constructor() {
    this.db = getDatabase().getDatabase();
  }

  /**
   * Calculate pagination metadata
   */
  private calculatePaginationMeta(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }

  /**
   * Get all organizations
   */
  getOrganizations(): Organization[] {
    const startTime = Date.now();
    try {
      const query = `
        SELECT id, name, created_at, updated_at
        FROM organizations
        ORDER BY name
      `;

      const result = this.db.prepare(query).all() as Organization[];
      logger.logDatabase('SELECT', 'organizations', Date.now() - startTime);
      return result;
    } catch (error) {
      logger.error('Failed to get organizations', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Get programs by organization ID
   */
  getProgramsByOrganization(organizationId: number): Program[] {
    const startTime = Date.now();
    try {
      const query = `
        SELECT id, organization_id, name, description, created_at, updated_at
        FROM programs
        WHERE organization_id = ?
        ORDER BY name
      `;

      const result = this.db.prepare(query).all(organizationId) as Program[];
      logger.logDatabase('SELECT', 'programs', Date.now() - startTime, { organizationId });
      return result;
    } catch (error) {
      logger.error('Failed to get programs', {
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get campaigns with filtering and pagination
   */
  getCampaigns(query: CampaignQuery = {}): { campaigns: Campaign[]; meta: PaginationMeta } {
    const startTime = Date.now();
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    try {
      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];

      if (query.organizationId) {
        conditions.push('p.organization_id = ?');
        params.push(query.organizationId);
      }

      if (query.programId) {
        conditions.push('c.program_id = ?');
        params.push(query.programId);
      }

      if (query.status) {
        conditions.push('c.status = ?');
        params.push(query.status);
      }

      if (query.startDate) {
        conditions.push('c.created_at >= ?');
        params.push(query.startDate);
      }

      if (query.endDate) {
        conditions.push('c.created_at <= ?');
        params.push(query.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM campaigns c
        LEFT JOIN programs p ON c.program_id = p.id
        ${whereClause}
      `;

      const totalResult = this.db.prepare(countQuery).get(...params) as { total: number };
      const total = totalResult.total;

      // Get campaigns
      const campaignsQuery = `
        SELECT c.id, c.program_id, c.name, c.status, c.objective,
               c.created_at, c.updated_at, c.start_date, c.end_date
        FROM campaigns c
        LEFT JOIN programs p ON c.program_id = p.id
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const campaigns = this.db.prepare(campaignsQuery).all(...params, limit, offset) as Campaign[];

      const meta = this.calculatePaginationMeta(page, limit, total);

      logger.logDatabase('SELECT', 'campaigns', Date.now() - startTime, {
        page,
        limit,
        total,
        conditions: conditions.length
      });

      return { campaigns, meta };
    } catch (error) {
      logger.error('Failed to get campaigns', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get campaign by ID
   */
  getCampaignById(id: number): Campaign | null {
    const startTime = Date.now();
    try {
      const query = `
        SELECT id, program_id, name, status, objective,
               created_at, updated_at, start_date, end_date
        FROM campaigns
        WHERE id = ?
      `;

      const result = this.db.prepare(query).get(id) as Campaign | undefined;
      logger.logDatabase('SELECT', 'campaigns', Date.now() - startTime, { id });
      return result || null;
    } catch (error) {
      logger.error('Failed to get campaign by ID', {
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get campaign metrics with filtering and aggregation
   */
  getCampaignMetrics(query: MetricsQuery = {}): PerformanceMetrics[] {
    const startTime = Date.now();
    try {
      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];

      if (query.campaignId) {
        conditions.push('campaign_id = ?');
        params.push(query.campaignId);
      }

      if (query.startDate) {
        conditions.push('date >= ?');
        params.push(query.startDate);
      }

      if (query.endDate) {
        conditions.push('date <= ?');
        params.push(query.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Build GROUP BY clause based on groupBy parameter
      let groupByClause = '';
      let selectPeriod = 'date as period';

      switch (query.groupBy) {
        case 'hour':
          selectPeriod = "date || ' ' || printf('%02d:00', hour) as period";
          groupByClause = 'GROUP BY date, hour';
          break;
        case 'day':
          selectPeriod = 'date as period';
          groupByClause = 'GROUP BY date';
          break;
        case 'week':
          selectPeriod = "strftime('%Y-W%W', date) as period";
          groupByClause = "GROUP BY strftime('%Y-W%W', date)";
          break;
        case 'month':
          selectPeriod = "strftime('%Y-%m', date) as period";
          groupByClause = "GROUP BY strftime('%Y-%m', date)";
          break;
        default:
          groupByClause = 'GROUP BY date';
      }

      // Build aggregation based on aggregateBy parameter
      const aggregateFunc = query.aggregateBy || 'sum';
      const aggregations = {
        impressions: `${aggregateFunc.toUpperCase()}(impressions) as impressions`,
        clicks: `${aggregateFunc.toUpperCase()}(clicks) as clicks`,
        conversions: `${aggregateFunc.toUpperCase()}(conversions) as conversions`,
        spend: `${aggregateFunc.toUpperCase()}(spend) as spend`,
        revenue: `${aggregateFunc.toUpperCase()}(revenue) as revenue`
      };

      const metricsQuery = `
        SELECT
          ${selectPeriod},
          ${Object.values(aggregations).join(', ')},
          CASE
            WHEN SUM(impressions) > 0 THEN ROUND(CAST(SUM(clicks) AS FLOAT) / SUM(impressions) * 100, 4)
            ELSE 0
          END as ctr,
          CASE
            WHEN SUM(clicks) > 0 THEN ROUND(CAST(SUM(spend) AS FLOAT) / SUM(clicks), 4)
            ELSE 0
          END as cpc,
          CASE
            WHEN SUM(impressions) > 0 THEN ROUND(CAST(SUM(spend) AS FLOAT) / SUM(impressions) * 1000, 4)
            ELSE 0
          END as cpm,
          CASE
            WHEN SUM(spend) > 0 THEN ROUND(CAST(SUM(revenue) AS FLOAT) / SUM(spend), 4)
            ELSE 0
          END as roas
        FROM campaign_metrics
        ${whereClause}
        ${groupByClause}
        ORDER BY period
      `;

      const result = this.db.prepare(metricsQuery).all(...params) as PerformanceMetrics[];

      logger.logDatabase('SELECT', 'campaign_metrics', Date.now() - startTime, {
        campaignId: query.campaignId,
        groupBy: query.groupBy,
        aggregateBy: query.aggregateBy,
        resultCount: result.length
      });

      return result;
    } catch (error) {
      logger.error('Failed to get campaign metrics', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get campaign summary with aggregated metrics
   */
  getCampaignSummary(campaignId: number, startDate?: string, endDate?: string): CampaignSummary | null {
    const startTime = Date.now();
    try {
      // Get campaign details
      const campaign = this.getCampaignById(campaignId);
      if (!campaign) return null;

      // Build date filter
      const conditions: string[] = ['campaign_id = ?'];
      const params: any[] = [campaignId];

      if (startDate) {
        conditions.push('date >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('date <= ?');
        params.push(endDate);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get aggregated metrics
      const metricsQuery = `
        SELECT
          SUM(impressions) as totalImpressions,
          SUM(clicks) as totalClicks,
          SUM(conversions) as totalConversions,
          SUM(spend) as totalSpend,
          SUM(revenue) as totalRevenue,
          CASE
            WHEN SUM(impressions) > 0 THEN ROUND(CAST(SUM(clicks) AS FLOAT) / SUM(impressions) * 100, 4)
            ELSE 0
          END as avgCtr,
          CASE
            WHEN SUM(clicks) > 0 THEN ROUND(CAST(SUM(spend) AS FLOAT) / SUM(clicks), 4)
            ELSE 0
          END as avgCpc,
          CASE
            WHEN SUM(impressions) > 0 THEN ROUND(CAST(SUM(spend) AS FLOAT) / SUM(impressions) * 1000, 4)
            ELSE 0
          END as avgCpm,
          CASE
            WHEN SUM(spend) > 0 THEN ROUND(CAST(SUM(revenue) AS FLOAT) / SUM(spend), 4)
            ELSE 0
          END as avgRoas,
          MIN(date) as minDate,
          MAX(date) as maxDate
        FROM campaign_metrics
        ${whereClause}
      `;

      const metrics = this.db.prepare(metricsQuery).get(...params) as any;

      if (!metrics || metrics.totalImpressions === null) {
        return {
          campaign,
          metrics: {
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            totalSpend: 0,
            totalRevenue: 0,
            avgCtr: 0,
            avgCpc: 0,
            avgCpm: 0,
            avgRoas: 0
          },
          dateRange: {
            startDate: startDate || '',
            endDate: endDate || ''
          }
        };
      }

      logger.logDatabase('SELECT', 'campaign_metrics', Date.now() - startTime, {
        campaignId,
        dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'all time'
      });

      return {
        campaign,
        metrics: {
          totalImpressions: metrics.totalImpressions || 0,
          totalClicks: metrics.totalClicks || 0,
          totalConversions: metrics.totalConversions || 0,
          totalSpend: metrics.totalSpend || 0,
          totalRevenue: metrics.totalRevenue || 0,
          avgCtr: metrics.avgCtr || 0,
          avgCpc: metrics.avgCpc || 0,
          avgCpm: metrics.avgCpm || 0,
          avgRoas: metrics.avgRoas || 0
        },
        dateRange: {
          startDate: metrics.minDate || startDate || '',
          endDate: metrics.maxDate || endDate || ''
        }
      };
    } catch (error) {
      logger.error('Failed to get campaign summary', {
        campaignId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get ad sets by campaign ID
   */
  getAdSetsByCampaign(campaignId: number): AdSet[] {
    const startTime = Date.now();
    try {
      const query = `
        SELECT id, campaign_id, name, status, targeting, created_at, updated_at
        FROM ad_sets
        WHERE campaign_id = ?
        ORDER BY name
      `;

      const result = this.db.prepare(query).all(campaignId) as AdSet[];
      logger.logDatabase('SELECT', 'ad_sets', Date.now() - startTime, { campaignId });
      return result;
    } catch (error) {
      logger.error('Failed to get ad sets', {
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get ads by ad set ID
   */
  getAdsByAdSet(adSetId: number): Ad[] {
    const startTime = Date.now();
    try {
      const query = `
        SELECT id, ad_set_id, name, status, creative_type, created_at, updated_at
        FROM ads
        WHERE ad_set_id = ?
        ORDER BY name
      `;

      const result = this.db.prepare(query).all(adSetId) as Ad[];
      logger.logDatabase('SELECT', 'ads', Date.now() - startTime, { adSetId });
      return result;
    } catch (error) {
      logger.error('Failed to get ads', {
        adSetId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Create singleton instance
let queriesInstance: DatabaseQueries | null = null;

/**
 * Get the singleton database queries instance
 */
export function getQueries(): DatabaseQueries {
  if (!queriesInstance) {
    queriesInstance = new DatabaseQueries();
  }
  return queriesInstance;
}

export default DatabaseQueries;