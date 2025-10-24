/**
 * Data Warehouse Service Layer
 * Comprehensive business logic for data warehouse operations
 */

import { getDataWarehouseDatabase } from '../database/datawarehouseConnection.js';
import {
  DataWarehouseCampaign,
  DataWarehouseCampaignWithMetrics,
  DataWarehouseCampaignQuery,
  DataWarehouseMetricsQuery,
  HourlyData,
  CampaignHierarchy,
  SyncHistory,
  SyncStatusQuery,
  SyncStatusResponse,
  HierarchyMappingStats,
  AggregatedMetrics,
  HourlyMetricsSummary,
  CampaignPerformanceRanking,
  DataWarehouseHealthCheck,
  PaginatedResponse,
  PaginationMeta,
  CampaignActivity,
  CampaignActivityQuery,
  CampaignHierarchyResponse
} from '../types/index.js';
import { ErrorUtils, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { daysBetween, calculateOverlapDays, prorateCostForPeriod } from '../utils/dateUtils.js';

/**
 * Campaign-related data warehouse operations
 */
export class DataWarehouseCampaignService {
  /**
   * Get campaigns with optional filtering and pagination
   */
  static async getCampaigns(query: DataWarehouseCampaignQuery): Promise<PaginatedResponse<DataWarehouseCampaignWithMetrics>> {
    const db = getDataWarehouseDatabase();

    try {
      const {
        page = 1,
        limit = 1000,
        status,
        isServing,
        hasData,
        search,
        network,
        domain,
        placement,
        targeting,
        orderBy = 'created_at',
        orderDirection = 'desc',
        startDate,
        endDate
      } = query;

      ErrorUtils.validateRequest(limit <= 1000, 'Limit cannot exceed 1000');
      ErrorUtils.validateRequest(page >= 1, 'Page must be >= 1');

      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const params: any[] = [];

      // Build WHERE conditions
      if (status) {
        conditions.push('c.status = ?');
        params.push(status);
      }

      if (isServing !== undefined) {
        const dbValue = isServing ? 1 : 0;
        logger.info(`isServing filter: ${isServing} → SQL value: ${dbValue}`);
        conditions.push('c.is_serving = ?');
        params.push(dbValue);
      }

      if (search) {
        conditions.push('(c.name LIKE ? OR c.description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      if (hasData !== undefined) {
        if (hasData) {
          conditions.push('EXISTS (SELECT 1 FROM hourly_data hd WHERE hd.campaign_id = c.id)');
        } else {
          conditions.push('NOT EXISTS (SELECT 1 FROM hourly_data hd WHERE hd.campaign_id = c.id)');
        }
      }

      // Hierarchy filters
      if (network || domain || placement || targeting) {
        conditions.push('EXISTS (SELECT 1 FROM campaign_hierarchy ch WHERE ch.campaign_id = c.id');
        if (network) {
          conditions[conditions.length - 1] += ' AND ch.network = ?';
          params.push(network);
        }
        if (domain) {
          conditions[conditions.length - 1] += ' AND ch.domain = ?';
          params.push(domain);
        }
        if (placement) {
          conditions[conditions.length - 1] += ' AND ch.placement = ?';
          params.push(placement);
        }
        if (targeting) {
          conditions[conditions.length - 1] += ' AND ch.targeting = ?';
          params.push(targeting);
        }
        conditions[conditions.length - 1] += ')';
      }

      // Date range filters
      let startUnixHour: number | undefined;
      let endUnixHour: number | undefined;

      if (startDate || endDate) {
        conditions.push('EXISTS (SELECT 1 FROM hourly_data hd WHERE hd.campaign_id = c.id');
        if (startDate) {
          startUnixHour = Math.floor(new Date(startDate).getTime() / 1000 / 3600);
          conditions[conditions.length - 1] += ' AND hd.unix_hour >= ?';
          params.push(startUnixHour);
        }
        if (endDate) {
          endUnixHour = Math.floor(new Date(endDate).getTime() / 1000 / 3600);
          conditions[conditions.length - 1] += ' AND hd.unix_hour <= ?';
          params.push(endUnixHour);
        }
        conditions[conditions.length - 1] += ')';
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Build additional WHERE conditions for filtering hourly_data in the main aggregation query
      // This ensures SUM() aggregations only include data within the selected date range
      const dateFilterConditions: string[] = [];
      const dateFilterParams: any[] = [];

      if (startUnixHour !== undefined) {
        dateFilterConditions.push('(hd.unix_hour IS NULL OR hd.unix_hour >= ?)');
        dateFilterParams.push(startUnixHour);
      }

      if (endUnixHour !== undefined) {
        dateFilterConditions.push('(hd.unix_hour IS NULL OR hd.unix_hour <= ?)');
        dateFilterParams.push(endUnixHour);
      }

      // Combine base WHERE clause with date filter conditions for the main query
      const mainQueryWhereClause = whereClause +
        (dateFilterConditions.length > 0
          ? (whereClause ? ' AND ' : 'WHERE ') + dateFilterConditions.join(' AND ')
          : '');

      // Validate orderBy column and build order clause
      const validOrderColumns = ['name', 'created_at', 'updated_at', 'sync_timestamp', 'traffic_weight', 'sessions', 'registrations'];
      ErrorUtils.validateRequest(
        validOrderColumns.includes(orderBy),
        `Invalid orderBy column. Must be one of: ${validOrderColumns.join(', ')}`
      );

      let orderClause: string;
      if (orderBy === 'sessions') {
        orderClause = `ORDER BY total_sessions ${orderDirection.toUpperCase()}`;
      } else if (orderBy === 'registrations') {
        orderClause = `ORDER BY total_registrations ${orderDirection.toUpperCase()}`;
      } else {
        orderClause = `ORDER BY c.${orderBy} ${orderDirection.toUpperCase()}`;
      }

      // Get total count
      const countSql = `
        SELECT COUNT(*) as count
        FROM campaigns c
        ${whereClause}
      `;
      const countResult = db.executeQuerySingle<{ count: number }>(countSql, params);
      const total = countResult?.count || 0;

      // Get campaigns with metrics
      const sql = `
        SELECT
          c.id, c.name, c.description, c.tracking_url, c.is_serving, c.serving_url, c.traffic_weight,
          c.deleted_at, c.created_at, c.updated_at, c.slug, c.path, c.status, c.sync_timestamp,
          COALESCE(cco.cost, c.cost) as cost,
          COALESCE(cco.cost_status, c.cost_status, 'estimated') as cost_status,
          cco.override_reason as cost_override_reason,
          cco.overridden_by as cost_overridden_by,
          cco.overridden_at as cost_overridden_at,
          cco.start_date as cost_start_date,
          cco.end_date as cost_end_date,
          cco.billing_period as cost_billing_period,
          CASE WHEN cco.id IS NOT NULL THEN 1 ELSE 0 END as has_cost_override,
          COALESCE(cho.network, ch.network) as network,
          COALESCE(cho.domain, ch.domain) as domain,
          COALESCE(cho.placement, ch.placement) as placement,
          COALESCE(cho.targeting, ch.targeting) as targeting,
          COALESCE(cho.special, ch.special) as special,
          ch.mapping_confidence,
          COALESCE(SUM(hd.sessions), 0) as total_sessions,
          COALESCE(SUM(hd.registrations), 0) as total_registrations,
          COALESCE(SUM(hd.messages), 0) as total_messages,
          COALESCE(SUM(hd.converted_users), 0) as total_converted_users,
          COALESCE(SUM(hd.total_accounts), 0) as total_accounts,
          COALESCE(SUM(hd.facebook_accounts), 0) as total_facebook_accounts,
          COALESCE(SUM(hd.email_accounts), 0) as total_email_accounts,
          COALESCE(SUM(hd.google_accounts), 0) as total_google_accounts,
          COALESCE(SUM(hd.companion_chats), 0) as total_companion_chats,
          COALESCE(SUM(hd.chat_room_user_chats), 0) as total_chat_room_user_chats,
          COALESCE(SUM(hd.chat_room_simulation_chats), 0) as total_chat_room_simulation_chats,
          COALESCE(SUM(hd.total_user_chats), 0) as total_user_chats,
          COALESCE(SUM(hd.payment_methods), 0) as total_payment_methods,
          COALESCE(SUM(hd.payment_methods_canceled), 0) as total_payment_methods_canceled,
          COALESCE(SUM(hd.revenue_successful_cents), 0) as total_revenue_successful_cents,
          COALESCE(SUM(hd.revenue_successful_dollars), 0) as total_revenue_successful_dollars,
          COALESCE(SUM(hd.revenue_successful_count), 0) as total_revenue_successful_count,
          COALESCE(SUM(hd.revenue_failed_cents), 0) as total_revenue_failed_cents,
          COALESCE(SUM(hd.revenue_failed_dollars), 0) as total_revenue_failed_dollars,
          COALESCE(SUM(hd.revenue_failed_count), 0) as total_revenue_failed_count,
          COALESCE(SUM(hd.media), 0) as total_media,
          COALESCE(SUM(hd.terms_acceptances), 0) as total_terms_acceptances,
          COUNT(hd.unix_hour) as data_point_count,
          MIN(datetime(hd.unix_hour * 3600, 'unixepoch')) as first_activity_date,
          MAX(datetime(hd.unix_hour * 3600, 'unixepoch')) as last_activity_date
        FROM campaigns c
        LEFT JOIN campaign_hierarchy ch ON c.id = ch.campaign_id
        LEFT JOIN campaign_hierarchy_overrides cho ON c.id = cho.campaign_id AND cho.is_active = 1
        LEFT JOIN campaign_cost_overrides cco ON c.id = cco.campaign_id AND cco.is_active = 1
        LEFT JOIN hourly_data hd ON c.id = hd.campaign_id
        ${mainQueryWhereClause}
        GROUP BY c.id, ch.id, cco.id
        ${orderClause}
        LIMIT ? OFFSET ?
      `;

      const campaigns = db.executeQuery<any>(sql, [...params, ...dateFilterParams, limit, offset]);

      // Transform to typed response with metrics calculation
      const campaignsWithMetrics: DataWarehouseCampaignWithMetrics[] = campaigns.map(row => {
        // Calculate prorated cost if date filtering is active
        let calculatedCost = row.cost || 0;

        if (startDate && endDate && row.cost_start_date && row.cost_end_date) {
          // PRIORITY 1: Use explicit cost override dates if they exist
          const queryStartDate = new Date(startDate);
          const queryEndDate = new Date(endDate);
          const costStartDate = new Date(row.cost_start_date);
          const costEndDate = new Date(row.cost_end_date);

          // Calculate overlap days between query range and cost period
          const overlapDays = calculateOverlapDays(
            costStartDate, costEndDate,
            queryStartDate, queryEndDate
          );

          if (overlapDays > 0) {
            // Calculate total days in the cost period
            const periodDays = daysBetween(costStartDate, costEndDate);

            // Prorate the cost based on overlap
            calculatedCost = prorateCostForPeriod(row.cost || 0, periodDays, overlapDays);
          } else {
            // No overlap means zero cost for this date range
            calculatedCost = 0;
          }
        } else if (startDate && endDate && calculatedCost > 0 && row.first_activity_date && row.last_activity_date) {
          // FALLBACK: Prorate base costs using campaign activity dates
          const queryStartDate = new Date(startDate);
          const queryEndDate = new Date(endDate);
          const activityStartDate = new Date(row.first_activity_date);
          const activityEndDate = new Date(row.last_activity_date);

          // Calculate overlap days between query range and activity period
          const overlapDays = calculateOverlapDays(
            activityStartDate, activityEndDate,
            queryStartDate, queryEndDate
          );

          if (overlapDays > 0) {
            // Calculate total days in the activity period
            const activityDays = daysBetween(activityStartDate, activityEndDate);

            // Prorate the cost based on overlap with activity range
            calculatedCost = prorateCostForPeriod(row.cost || 0, activityDays, overlapDays);
          } else {
            // No overlap with activity range means zero cost for this date range
            calculatedCost = 0;
          }
        }

        const campaign: DataWarehouseCampaign = {
          id: row.id,
          name: row.name,
          description: row.description,
          tracking_url: row.tracking_url,
          is_serving: Boolean(row.is_serving),
          serving_url: row.serving_url,
          traffic_weight: row.traffic_weight,
          deleted_at: row.deleted_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          slug: row.slug,
          path: row.path,
          cost: calculatedCost,
          cost_status: row.cost_status || 'estimated',
          status: row.status || (row.is_serving ? 'live' : 'paused'),
          sync_timestamp: row.sync_timestamp
        };

        const totalSessions = row.total_sessions || 0;
        const totalRegistrations = row.total_registrations || 0;
        const totalMessages = row.total_messages || 0;

        const metrics = {
          totalSessions,
          totalRegistrations,
          totalMessages,
          totalConvertedUsers: row.total_converted_users || 0,
          totalAccounts: row.total_accounts || 0,
          totalCreditCards: row.total_credit_cards || 0,
          totalEmailAccounts: row.total_email_accounts || 0,
          totalGoogleAccounts: row.total_google_accounts || 0,
          totalFacebookAccounts: row.total_facebook_accounts || 0,
          totalCompanionChats: row.total_companion_chats || 0,
          totalChatRoomUserChats: row.total_chat_room_user_chats || 0,
          totalChatRoomSimulationChats: row.total_chat_room_simulation_chats || 0,
          totalTotalUserChats: row.total_total_user_chats || 0,
          totalPaymentMethods: row.total_payment_methods || 0,
          totalPaymentMethodsCanceled: row.total_payment_methods_canceled || 0,
          totalRevenueSuccessfulCents: row.total_revenue_successful_cents || 0,
          totalRevenueSuccessfulDollars: row.total_revenue_successful_dollars || 0,
          totalRevenueSuccessfulCount: row.total_revenue_successful_count || 0,
          totalRevenueFailedCents: row.total_revenue_failed_cents || 0,
          totalRevenueFailedDollars: row.total_revenue_failed_dollars || 0,
          totalRevenueFailedCount: row.total_revenue_failed_count || 0,
          totalMedia: row.total_media || 0,
          totalTermsAcceptances: row.total_terms_acceptances || 0,
          registrationRate: totalSessions > 0 ? (totalRegistrations / totalSessions) * 100 : 0,
          conversionRate: totalRegistrations > 0 ? (row.total_converted_users / totalRegistrations) * 100 : 0,
          messageRate: totalSessions > 0 ? (totalMessages / totalSessions) * 100 : 0,
          lastActivityDate: row.last_activity_date,
          dataPointCount: row.data_point_count || 0
        };

        const result: DataWarehouseCampaignWithMetrics = {
          ...campaign,
          metrics
        };

        if (row.network) {
          result.hierarchy = {
            id: 0, // Not needed for this response
            campaign_id: row.id,
            campaign_name: row.name,
            network: row.network,
            domain: row.domain,
            placement: row.placement,
            targeting: row.targeting,
            special: row.special,
            mapping_confidence: row.mapping_confidence,
            created_at: '',
            updated_at: ''
          };
        }

        return result;
      });

      const meta: PaginationMeta = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      };

      logger.info('Retrieved data warehouse campaigns', {
        count: campaignsWithMetrics.length,
        total,
        page,
        filters: { status, isServing, hasData, search, network, domain }
      });

      return {
        success: true,
        data: campaignsWithMetrics,
        meta,
        message: 'Campaigns retrieved successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get data warehouse campaigns', {
        error: error instanceof Error ? error.message : String(error),
        query
      });
      return ErrorUtils.handleDatabaseError(error, 'getCampaigns');
    }
  }

  /**
   * Get single campaign by ID with full details
   */
  static async getCampaignById(id: number): Promise<DataWarehouseCampaignWithMetrics> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(id) && id > 0, 'Campaign ID must be a positive number');

      const sql = `
        SELECT
          c.id, c.name, c.description, c.tracking_url, c.is_serving, c.serving_url, c.traffic_weight,
          c.deleted_at, c.created_at, c.updated_at, c.slug, c.path, c.status, c.sync_timestamp,
          COALESCE(cco.cost, c.cost) as cost,
          COALESCE(cco.cost_status, c.cost_status, 'estimated') as cost_status,
          cco.override_reason as cost_override_reason,
          cco.overridden_by as cost_overridden_by,
          cco.overridden_at as cost_overridden_at,
          cco.start_date as cost_start_date,
          cco.end_date as cost_end_date,
          cco.billing_period as cost_billing_period,
          CASE WHEN cco.id IS NOT NULL THEN 1 ELSE 0 END as has_cost_override,
          ch.id as hierarchy_id,
          COALESCE(cho.network, ch.network) as network,
          COALESCE(cho.domain, ch.domain) as domain,
          COALESCE(cho.placement, ch.placement) as placement,
          COALESCE(cho.targeting, ch.targeting) as targeting,
          COALESCE(cho.special, ch.special) as special,
          ch.mapping_confidence,
          ch.created_at as hierarchy_created_at,
          ch.updated_at as hierarchy_updated_at,
          COALESCE(SUM(hd.sessions), 0) as total_sessions,
          COALESCE(SUM(hd.registrations), 0) as total_registrations,
          COALESCE(SUM(hd.messages), 0) as total_messages,
          COALESCE(SUM(hd.converted_users), 0) as total_converted_users,
          COALESCE(SUM(hd.total_accounts), 0) as total_accounts,
          COALESCE(SUM(hd.credit_cards), 0) as total_credit_cards,
          COALESCE(SUM(hd.email_accounts), 0) as total_email_accounts,
          COALESCE(SUM(hd.google_accounts), 0) as total_google_accounts,
          COALESCE(SUM(hd.facebook_accounts), 0) as total_facebook_accounts,
          COALESCE(SUM(hd.companion_chats), 0) as total_companion_chats,
          COALESCE(SUM(hd.chat_room_user_chats), 0) as total_chat_room_user_chats,
          COALESCE(SUM(hd.chat_room_simulation_chats), 0) as total_chat_room_simulation_chats,
          COALESCE(SUM(hd.total_user_chats), 0) as total_total_user_chats,
          COALESCE(SUM(hd.payment_methods), 0) as total_payment_methods,
          COALESCE(SUM(hd.payment_methods_canceled), 0) as total_payment_methods_canceled,
          COALESCE(SUM(hd.revenue_successful_cents), 0) as total_revenue_successful_cents,
          COALESCE(SUM(hd.revenue_successful_dollars), 0) as total_revenue_successful_dollars,
          COALESCE(SUM(hd.revenue_successful_count), 0) as total_revenue_successful_count,
          COALESCE(SUM(hd.revenue_failed_cents), 0) as total_revenue_failed_cents,
          COALESCE(SUM(hd.revenue_failed_dollars), 0) as total_revenue_failed_dollars,
          COALESCE(SUM(hd.revenue_failed_count), 0) as total_revenue_failed_count,
          COALESCE(SUM(hd.media), 0) as total_media,
          COALESCE(SUM(hd.terms_acceptances), 0) as total_terms_acceptances,
          COUNT(hd.unix_hour) as data_point_count,
          MIN(datetime(hd.unix_hour * 3600, 'unixepoch')) as first_activity_date,
          MAX(datetime(hd.unix_hour * 3600, 'unixepoch')) as last_activity_date
        FROM campaigns c
        LEFT JOIN campaign_hierarchy ch ON c.id = ch.campaign_id
        LEFT JOIN campaign_hierarchy_overrides cho ON c.id = cho.campaign_id AND cho.is_active = 1
        LEFT JOIN campaign_cost_overrides cco ON c.id = cco.campaign_id AND cco.is_active = 1
        LEFT JOIN hourly_data hd ON c.id = hd.campaign_id
        WHERE c.id = ?
        GROUP BY c.id, ch.id, cco.id
      `;

      const dbResult = db.executeQuerySingle<any>(sql, [id]);
      ErrorUtils.assertFound(dbResult, 'Campaign not found');

      const campaign: DataWarehouseCampaign = {
        id: dbResult.id,
        name: dbResult.name,
        description: dbResult.description,
        tracking_url: dbResult.tracking_url,
        is_serving: Boolean(dbResult.is_serving),
        serving_url: dbResult.serving_url,
        traffic_weight: dbResult.traffic_weight,
        deleted_at: dbResult.deleted_at,
        created_at: dbResult.created_at,
        updated_at: dbResult.updated_at,
        slug: dbResult.slug,
        path: dbResult.path,
        cost: dbResult.cost || 0,
        cost_status: dbResult.cost_status || 'estimated',
        status: dbResult.status || (dbResult.is_serving ? 'live' : 'paused'),
        sync_timestamp: dbResult.sync_timestamp
      };

      const hierarchy: CampaignHierarchy | undefined = dbResult.hierarchy_id ? {
        id: dbResult.hierarchy_id,
        campaign_id: dbResult.id,
        campaign_name: dbResult.name,
        network: dbResult.network,
        domain: dbResult.domain,
        placement: dbResult.placement,
        targeting: dbResult.targeting,
        special: dbResult.special,
        mapping_confidence: dbResult.mapping_confidence,
        created_at: dbResult.hierarchy_created_at,
        updated_at: dbResult.hierarchy_updated_at
      } : undefined;

      const totalSessions = dbResult.total_sessions || 0;
      const totalRegistrations = dbResult.total_registrations || 0;
      const totalMessages = dbResult.total_messages || 0;

      const metrics = {
        totalSessions,
        totalRegistrations,
        totalMessages,
        totalConvertedUsers: dbResult.total_converted_users || 0,
        totalAccounts: dbResult.total_accounts || 0,
        registrationRate: totalSessions > 0 ? (totalRegistrations / totalSessions) * 100 : 0,
        conversionRate: totalRegistrations > 0 ? (dbResult.total_converted_users / totalRegistrations) * 100 : 0,
        messageRate: totalSessions > 0 ? (totalMessages / totalSessions) * 100 : 0,
        lastActivityDate: dbResult.last_activity_date,
        dataPointCount: dbResult.data_point_count || 0
      };

      logger.info('Retrieved campaign details', {
        campaignId: id,
        name: campaign.name,
        hasHierarchy: !!hierarchy,
        dataPoints: metrics.dataPointCount
      });

      const campaignWithMetrics: DataWarehouseCampaignWithMetrics = {
        ...campaign,
        metrics
      };

      if (hierarchy) {
        campaignWithMetrics.hierarchy = hierarchy;
      }

      return campaignWithMetrics;

    } catch (error) {
      logger.error('Failed to get campaign by ID', {
        campaignId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'getCampaignById');
      throw error;
    }
  }

  /**
   * Get campaign metrics summary
   */
  static async getCampaignMetrics(campaignId: number, query: DataWarehouseMetricsQuery): Promise<{
    campaign: DataWarehouseCampaign;
    metrics: HourlyData[];
    aggregated: AggregatedMetrics;
  }> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');

      // First verify campaign exists
      const campaign = await this.getCampaignById(campaignId);

      const {
        startDate,
        endDate,
        hourStart,
        hourEnd,
        includeTotals = true
      } = query;

      const conditions: string[] = ['campaign_id = ?'];
      const params: any[] = [campaignId];

      // Date range filters
      if (startDate) {
        const startUnixHour = Math.floor(new Date(startDate).getTime() / 1000 / 3600);
        conditions.push('unix_hour >= ?');
        params.push(startUnixHour);
      }

      if (endDate) {
        const endUnixHour = Math.floor(new Date(endDate).getTime() / 1000 / 3600);
        conditions.push('unix_hour <= ?');
        params.push(endUnixHour);
      }

      // Hour range filters (0-23)
      if (hourStart !== undefined) {
        conditions.push('(unix_hour % 24) >= ?');
        params.push(hourStart);
      }

      if (hourEnd !== undefined) {
        conditions.push('(unix_hour % 24) <= ?');
        params.push(hourEnd);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get hourly metrics
      const metricsSql = `
        SELECT *
        FROM hourly_data
        ${whereClause}
        ORDER BY unix_hour ASC
      `;

      const metrics = db.executeQuery<HourlyData>(metricsSql, params);

      // Calculate aggregated metrics
      let aggregated: AggregatedMetrics;

      if (includeTotals && metrics.length > 0) {
        const totals = metrics.reduce((acc, metric) => ({
          totalSessions: acc.totalSessions + metric.sessions,
          totalRegistrations: acc.totalRegistrations + metric.registrations,
          totalMessages: acc.totalMessages + metric.messages,
          totalConvertedUsers: acc.totalConvertedUsers + metric.converted_users,
          totalAccounts: acc.totalAccounts + metric.total_accounts,
          totalCreditCards: acc.totalCreditCards + metric.credit_cards,
          totalEmailAccounts: acc.totalEmailAccounts + metric.email_accounts,
          totalGoogleAccounts: acc.totalGoogleAccounts + metric.google_accounts,
          totalCompanionChats: acc.totalCompanionChats + metric.companion_chats,
          totalChatRoomUserChats: acc.totalChatRoomUserChats + metric.chat_room_user_chats,
          totalMedia: acc.totalMedia + metric.media,
          totalPaymentMethods: acc.totalPaymentMethods + metric.payment_methods,
          totalTermsAcceptances: acc.totalTermsAcceptances + metric.terms_acceptances
        }), {
          totalSessions: 0,
          totalRegistrations: 0,
          totalMessages: 0,
          totalConvertedUsers: 0,
          totalAccounts: 0,
          totalCreditCards: 0,
          totalEmailAccounts: 0,
          totalGoogleAccounts: 0,
          totalCompanionChats: 0,
          totalChatRoomUserChats: 0,
          totalMedia: 0,
          totalPaymentMethods: 0,
          totalTermsAcceptances: 0
        });

        aggregated = {
          period: `${startDate || 'beginning'} to ${endDate || 'latest'}`,
          campaignCount: 1,
          ...totals,
          avgRegistrationRate: totals.totalSessions > 0 ? (totals.totalRegistrations / totals.totalSessions) * 100 : 0,
          avgConversionRate: totals.totalRegistrations > 0 ? (totals.totalConvertedUsers / totals.totalRegistrations) * 100 : 0,
          avgMessageRate: totals.totalSessions > 0 ? (totals.totalMessages / totals.totalSessions) * 100 : 0,
          avgAccountCreationRate: totals.totalSessions > 0 ? (totals.totalAccounts / totals.totalSessions) * 100 : 0
        };
      } else {
        aggregated = {
          period: 'No data available',
          campaignCount: 1,
          totalSessions: 0,
          totalRegistrations: 0,
          totalMessages: 0,
          totalConvertedUsers: 0,
          totalAccounts: 0,
          totalCreditCards: 0,
          totalEmailAccounts: 0,
          totalGoogleAccounts: 0,
          totalCompanionChats: 0,
          totalChatRoomUserChats: 0,
          totalMedia: 0,
          totalPaymentMethods: 0,
          totalTermsAcceptances: 0,
          avgRegistrationRate: 0,
          avgConversionRate: 0,
          avgMessageRate: 0,
          avgAccountCreationRate: 0
        };
      }

      logger.info('Retrieved campaign metrics', {
        campaignId,
        metricsCount: metrics.length,
        totalSessions: aggregated.totalSessions,
        dateRange: `${startDate || 'beginning'} to ${endDate || 'latest'}`
      });

      return {
        campaign,
        metrics,
        aggregated
      };

    } catch (error) {
      logger.error('Failed to get campaign metrics', {
        campaignId,
        error: error instanceof Error ? error.message : String(error),
        query
      });
      ErrorUtils.handleDatabaseError(error, 'getCampaignMetrics');
      throw error;
    }
  }

  /**
   * Get campaign hierarchy with organization, program, ad sets, and ads
   * Returns merged hierarchy (auto-mapping + active overrides)
   */
  static async getCampaignHierarchy(campaignId: number): Promise<CampaignHierarchyResponse> {
    const db = getDataWarehouseDatabase();

    try {
      // Get the campaign first to ensure it exists
      const campaign = await DataWarehouseCampaignService.getCampaignById(campaignId);

      // Get merged hierarchy (includes overrides if any) using Python call
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const pythonScript = `
import sys
import json
sys.path.insert(0, '${process.cwd()}/../datawarehouse-job/src')
from database.operations import DatabaseOperations
from database.schema import initialize_database

conn = initialize_database('${process.cwd()}/../datawarehouse-job/datawarehouse.db')
db_ops = DatabaseOperations(conn)
merged = db_ops.get_merged_hierarchy(${campaignId})
print(json.dumps(merged) if merged else 'null')
conn.close()
`;

      const { stdout } = await execAsync(`python3 -c "${pythonScript.replace(/\n/g, '; ')}"`);
      const hierarchy = stdout.trim() === 'null' ? null : JSON.parse(stdout.trim());

      // For now, since we don't have the full organization/program structure in the database,
      // we'll return null for organization and program
      // This can be enhanced when the full hierarchy is implemented
      const organization = null;
      const program = null;

      // Get ad sets (if they exist in the database)
      // Since the current schema doesn't have ad_sets table, return empty array
      const adSets: any[] = [];

      // Get ads (if they exist in the database)
      // Since the current schema doesn't have ads table, return empty array
      const ads: any[] = [];

      logger.info('Campaign hierarchy retrieved successfully', {
        campaignId,
        hasHierarchy: hierarchy !== null,
        hasOverride: hierarchy?.has_override || false,
        adSetsCount: adSets.length,
        adsCount: ads.length
      });

      return {
        campaign: campaign,
        hierarchy: hierarchy || null,
        organization,
        program,
        adSets,
        ads
      };

    } catch (error) {
      return ErrorUtils.handleDatabaseError(error, 'getCampaignHierarchy');
    }
  }

  /**
   * Update campaign cost (creates override that persists across syncs)
   */
  static async updateCampaignCost(
    campaignId: number,
    cost: number,
    cost_status: 'confirmed' | 'api_sourced' = 'confirmed',
    start_date: string,
    end_date: string,
    billing_period: string = 'custom',
    overridden_by: string,
    override_reason?: string
  ): Promise<DataWarehouseCampaign> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');
      ErrorUtils.validateRequest(!isNaN(cost) && cost >= 0, 'Cost must be a non-negative number');
      ErrorUtils.validateRequest(overridden_by && overridden_by.length > 0, 'overridden_by is required');
      ErrorUtils.validateRequest(
        ['confirmed', 'api_sourced'].includes(cost_status),
        'cost_status must be either "confirmed" or "api_sourced"'
      );
      ErrorUtils.validateRequest(start_date && start_date.length > 0, 'start_date is required');
      ErrorUtils.validateRequest(end_date && end_date.length > 0, 'end_date is required');
      ErrorUtils.validateRequest(
        new Date(end_date) >= new Date(start_date),
        'end_date must be greater than or equal to start_date'
      );

      // Verify campaign exists first
      await this.getCampaignById(campaignId);

      // Deactivate any existing active override for this campaign
      const deactivateSql = `
        UPDATE campaign_cost_overrides
        SET is_active = 0,
            updated_at = datetime('now')
        WHERE campaign_id = ? AND is_active = 1
      `;
      db.executeWriteOperation(deactivateSql, [campaignId]);

      // Insert new cost override
      const insertSql = `
        INSERT INTO campaign_cost_overrides (
          campaign_id,
          cost,
          cost_status,
          start_date,
          end_date,
          billing_period,
          override_reason,
          overridden_by,
          overridden_at,
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'), datetime('now'))
      `;
      db.executeWriteOperation(insertSql, [
        campaignId,
        cost,
        cost_status,
        start_date,
        end_date,
        billing_period,
        override_reason || null,
        overridden_by
      ]);

      // Get updated campaign (COALESCE in getCampaignById will return override value)
      const updatedCampaign = await this.getCampaignById(campaignId);

      logger.info('Created campaign cost override', {
        campaignId,
        cost,
        cost_status,
        start_date,
        end_date,
        billing_period,
        overridden_by,
        name: updatedCampaign.name
      });

      // Log activity
      const costFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cost);
      this.logCampaignActivity(
        campaignId,
        'cost_update',
        `Updated cost to ${costFormatted} (${cost_status === 'confirmed' ? 'Confirmed' : 'API Sourced'})`,
        {
          cost,
          cost_status,
          start_date,
          end_date,
          billing_period,
          reason: override_reason,
          campaign_name: updatedCampaign.name
        },
        overridden_by,
        'web_ui'
      );

      return updatedCampaign;

    } catch (error) {
      logger.error('Failed to create campaign cost override', {
        campaignId,
        cost,
        cost_status,
        overridden_by,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'updateCampaignCost');
      throw error;
    }
  }

  /**
   * Delete (deactivate) campaign cost override
   */
  static async deleteCostOverride(campaignId: number, overridden_by: string): Promise<{ success: boolean }> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');
      ErrorUtils.validateRequest(overridden_by && overridden_by.length > 0, 'overridden_by is required');

      // Verify campaign exists first
      await this.getCampaignById(campaignId);

      // Deactivate active cost override
      const deactivateSql = `
        UPDATE campaign_cost_overrides
        SET is_active = 0,
            updated_at = datetime('now')
        WHERE campaign_id = ? AND is_active = 1
      `;
      db.executeWriteOperation(deactivateSql, [campaignId]);

      const success = true;

      logger.info('Deleted cost override', {
        campaignId,
        overridden_by,
        success
      });

      // Log activity
      const campaign = await this.getCampaignById(campaignId);
      this.logCampaignActivity(
        campaignId,
        'cost_delete',
        `Removed cost override`,
        {
          campaign_name: campaign.name
        },
        overridden_by,
        'web_ui'
      );

      return { success };

    } catch (error) {
      logger.error('Failed to delete cost override', {
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'deleteCostOverride');
      throw error;
    }
  }

  /**
   * Get cost override history for a campaign
   */
  static async getCostOverrideHistory(campaignId: number, limit: number = 10): Promise<any[]> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');

      // Get cost override history
      const sql = `
        SELECT
          id,
          campaign_id,
          cost,
          cost_status,
          override_reason,
          overridden_by,
          overridden_at,
          is_active,
          created_at,
          updated_at
        FROM campaign_cost_overrides
        WHERE campaign_id = ?
        ORDER BY overridden_at DESC
        LIMIT ?
      `;

      const rows = db.getRecords(sql, [campaignId, limit]);

      logger.info('Retrieved cost override history', {
        campaignId,
        historyCount: rows.length
      });

      return rows.map(row => ({
        id: row.id,
        campaign_id: row.campaign_id,
        cost: row.cost,
        cost_status: row.cost_status,
        override_reason: row.override_reason,
        overridden_by: row.overridden_by,
        overridden_at: row.overridden_at,
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

    } catch (error) {
      logger.error('Failed to get cost override history', {
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'getCostOverrideHistory');
      throw error;
    }
  }

  /**
   * Get campaign cost for a specific date range with proration
   * Calculates cost based on overlapping billing periods and fills gaps with estimated cost
   */
  static async getCampaignCostForDateRange(
    campaignId: number,
    startDate: string,
    endDate: string
  ): Promise<{
    total_cost: number;
    breakdown: Array<{
      start_date: string;
      end_date: string;
      cost: number;
      daily_rate: number;
      days: number;
      cost_status: string;
      billing_period?: string;
      override_id?: number;
    }>;
  }> {
    const db = getDataWarehouseDatabase();
    const { parseDate, daysBetween, calculateOverlapDays, prorateCostForPeriod } = await import('../utils/dateUtils.js');

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');
      ErrorUtils.validateRequest(startDate && endDate, 'Start date and end date are required');

      const queryStart = parseDate(startDate);
      const queryEnd = parseDate(endDate);
      const queryDays = daysBetween(queryStart, queryEnd);

      // Get campaign data for estimated cost
      const campaign = await this.getCampaignById(campaignId);
      const estimatedTotalCost = campaign.cost || 0;

      // Get all cost overrides that overlap with the query date range
      const overrideSql = `
        SELECT
          id,
          cost,
          cost_status,
          start_date,
          end_date,
          billing_period
        FROM campaign_cost_overrides
        WHERE campaign_id = ?
          AND is_active = 1
          AND date(end_date) >= date(?)
          AND date(start_date) <= date(?)
        ORDER BY start_date ASC
      `;

      const overrides = db.getRecords(overrideSql, [campaignId, startDate, endDate]);

      const breakdown: Array<{
        start_date: string;
        end_date: string;
        cost: number;
        daily_rate: number;
        days: number;
        cost_status: string;
        billing_period?: string;
        override_id?: number;
      }> = [];

      let totalCost = 0;
      let coveredDays = 0;

      // Process each overlapping cost override
      for (const override of overrides) {
        const periodStart = parseDate(override.start_date);
        const periodEnd = parseDate(override.end_date);
        const periodDays = daysBetween(periodStart, periodEnd);
        const overlapDays = calculateOverlapDays(periodStart, periodEnd, queryStart, queryEnd);

        if (overlapDays > 0) {
          const proratedCost = prorateCostForPeriod(override.cost, periodDays, overlapDays);
          const dailyRate = override.cost / periodDays;

          // Determine actual overlap start/end within query range
          const overlapStart = periodStart > queryStart ? periodStart : queryStart;
          const overlapEnd = periodEnd < queryEnd ? periodEnd : queryEnd;

          breakdown.push({
            start_date: overlapStart.toISOString().split('T')[0],
            end_date: overlapEnd.toISOString().split('T')[0],
            cost: proratedCost,
            daily_rate: dailyRate,
            days: overlapDays,
            cost_status: override.cost_status,
            billing_period: override.billing_period,
            override_id: override.id,
          });

          totalCost += proratedCost;
          coveredDays += overlapDays;
        }
      }

      // For days not covered by overrides, use estimated cost (proportionally allocated)
      const uncoveredDays = queryDays - coveredDays;
      if (uncoveredDays > 0 && estimatedTotalCost > 0) {
        // Get total sessions for all time to calculate daily estimated rate
        const sessionSql = `
          SELECT COALESCE(SUM(sessions), 0) as total_sessions
          FROM hourly_data
          WHERE campaign_id = ?
        `;
        const sessionResult = db.getRecord(sessionSql, [campaignId]);
        const totalSessions = sessionResult?.total_sessions || 0;

        // Calculate estimated daily rate (assuming even distribution)
        // If we have session data, use it; otherwise just divide cost by assumed 30 days
        const estimatedDailyRate = totalSessions > 0
          ? estimatedTotalCost / Math.max(totalSessions / 100, 30) // Rough estimate based on sessions
          : estimatedTotalCost / 30; // Fallback to monthly rate

        const estimatedCost = estimatedDailyRate * uncoveredDays;

        breakdown.push({
          start_date: startDate,
          end_date: endDate,
          cost: estimatedCost,
          daily_rate: estimatedDailyRate,
          days: uncoveredDays,
          cost_status: 'estimated',
        });

        totalCost += estimatedCost;
      }

      logger.info('Calculated campaign cost for date range', {
        campaignId,
        startDate,
        endDate,
        queryDays,
        coveredDays,
        totalCost,
        breakdownCount: breakdown.length,
      });

      return {
        total_cost: totalCost,
        breakdown,
      };

    } catch (error) {
      logger.error('Failed to get campaign cost for date range', {
        campaignId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : String(error),
      });
      ErrorUtils.handleDatabaseError(error, 'getCampaignCostForDateRange');
      throw error;
    }
  }

  /**
   * Update campaign status
   */
  static async updateCampaignStatus(campaignId: number, status: 'live' | 'paused' | 'unknown'): Promise<DataWarehouseCampaign> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');
      ErrorUtils.validateRequest(['live', 'paused', 'unknown'].includes(status), 'Status must be one of: live, paused, unknown');

      // Verify campaign exists first
      await this.getCampaignById(campaignId);

      // Update status
      const updateSql = `
        UPDATE campaigns
        SET status = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `;

      db.executeWriteOperation(updateSql, [status, campaignId]);

      // Get updated campaign
      const updatedCampaign = await this.getCampaignById(campaignId);

      logger.info('Updated campaign status', {
        campaignId,
        status,
        name: updatedCampaign.name
      });

      // Log activity
      const statusLabels = { live: 'Live', paused: 'Paused', unknown: 'Unknown' };
      this.logCampaignActivity(
        campaignId,
        'status_change',
        `Changed status to ${statusLabels[status]}`,
        { status, campaign_name: updatedCampaign.name },
        undefined,
        'web_ui'
      );

      return {
        id: updatedCampaign.id,
        name: updatedCampaign.name,
        description: updatedCampaign.description,
        tracking_url: updatedCampaign.tracking_url,
        is_serving: updatedCampaign.is_serving,
        serving_url: updatedCampaign.serving_url,
        traffic_weight: updatedCampaign.traffic_weight,
        deleted_at: updatedCampaign.deleted_at,
        created_at: updatedCampaign.created_at,
        updated_at: updatedCampaign.updated_at,
        slug: updatedCampaign.slug,
        path: updatedCampaign.path,
        cost: updatedCampaign.cost,
        status: status,
        sync_timestamp: updatedCampaign.sync_timestamp
      };

    } catch (error) {
      logger.error('Failed to update campaign status', {
        campaignId,
        status,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'updateCampaignStatus');
      throw error;
    }
  }

  /**
   * Update campaign account manager
   */
  static async updateAccountManager(campaignId: number, accountManager: string | null): Promise<DataWarehouseCampaign> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');
      ErrorUtils.validateRequest(
        accountManager === null || (typeof accountManager === 'string' && accountManager.length <= 255),
        'account_manager must be a string with max 255 characters or null'
      );

      // Verify campaign exists first
      await this.getCampaignById(campaignId);

      // Update account manager
      const updateSql = `
        UPDATE campaigns
        SET account_manager = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `;

      db.executeWriteOperation(updateSql, [accountManager, campaignId]);

      // Get updated campaign
      const updatedCampaign = await this.getCampaignById(campaignId);

      logger.info('Updated campaign account manager', {
        campaignId,
        account_manager: accountManager || 'None',
        name: updatedCampaign.name
      });

      // Log activity
      const description = accountManager
        ? `Changed account manager to ${accountManager}`
        : 'Removed account manager';

      this.logCampaignActivity(
        campaignId,
        'manual_edit',
        description,
        { account_manager: accountManager, campaign_name: updatedCampaign.name },
        undefined,
        'web_ui'
      );

      return updatedCampaign;

    } catch (error) {
      logger.error('Failed to update campaign account manager', {
        campaignId,
        accountManager,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'updateAccountManager');
      throw error;
    }
  }

  /**
   * Update campaign contact info and credentials
   */
  static async updateContactInfo(campaignId: number, contactInfo: string | null): Promise<DataWarehouseCampaign> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');
      ErrorUtils.validateRequest(
        contactInfo === null || typeof contactInfo === 'string',
        'contact_info_credentials must be a string or null'
      );

      // Verify campaign exists first
      await this.getCampaignById(campaignId);

      // Update contact info
      const updateSql = `
        UPDATE campaigns
        SET contact_info_credentials = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `;

      db.executeWriteOperation(updateSql, [contactInfo, campaignId]);

      // Get updated campaign
      const updatedCampaign = await this.getCampaignById(campaignId);

      logger.info('Updated campaign contact info', {
        campaignId,
        hasContactInfo: !!contactInfo,
        name: updatedCampaign.name
      });

      // Log activity
      const description = contactInfo
        ? 'Updated contact information and credentials'
        : 'Removed contact information';

      this.logCampaignActivity(
        campaignId,
        'manual_edit',
        description,
        { has_contact_info: !!contactInfo, campaign_name: updatedCampaign.name },
        undefined,
        'web_ui'
      );

      return updatedCampaign;

    } catch (error) {
      logger.error('Failed to update campaign contact info', {
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'updateContactInfo');
      throw error;
    }
  }

  /**
   * Create a new campaign manually
   * Generates ID in the 1000000+ range for manual campaigns
   */
  static async createCampaign(campaignData: {
    name: string;
    description?: string;
    tracking_url?: string;
    status: 'live' | 'paused' | 'unknown';
    account_manager?: string;
    contact_info_credentials?: string;
    cost?: number;
    cost_status?: 'estimated' | 'confirmed';
    hierarchy: {
      network: string;
      domain: string;
      placement: string;
      targeting: string;
      special: string;
    };
  }): Promise<DataWarehouseCampaign> {
    const db = getDataWarehouseDatabase();

    try {
      // Validate required fields
      ErrorUtils.validateRequest(
        campaignData.name && campaignData.name.length > 0 && campaignData.name.length <= 255,
        'Campaign name is required and must be max 255 characters'
      );
      ErrorUtils.validateRequest(
        ['live', 'paused', 'unknown'].includes(campaignData.status),
        'Status must be one of: live, paused, unknown'
      );

      // Validate hierarchy
      ErrorUtils.validateRequest(
        campaignData.hierarchy &&
        campaignData.hierarchy.network &&
        campaignData.hierarchy.domain &&
        campaignData.hierarchy.placement &&
        campaignData.hierarchy.targeting &&
        campaignData.hierarchy.special,
        'All hierarchy fields (network, domain, placement, targeting, special) are required'
      );

      // Validate cost if provided
      if (campaignData.cost !== undefined && campaignData.cost !== null) {
        ErrorUtils.validateRequest(
          campaignData.cost >= 0,
          'Cost must be a positive number'
        );
      }

      // Generate campaign ID in the 1000000+ range
      const getMaxIdSql = `
        SELECT MAX(id) as max_id
        FROM campaigns
        WHERE source = 'manual'
      `;
      const result = db.executeQuerySingle<{ max_id: number | null }>(getMaxIdSql, []);
      const nextId = result?.max_id ? result.max_id + 1 : 1000000;

      logger.info('Creating new manual campaign', {
        generatedId: nextId,
        name: campaignData.name,
        status: campaignData.status
      });

      // Insert campaign record
      const now = new Date().toISOString();
      const insertCampaignSql = `
        INSERT INTO campaigns (
          id,
          name,
          description,
          tracking_url,
          status,
          account_manager,
          contact_info_credentials,
          cost,
          cost_status,
          source,
          is_serving,
          created_at,
          updated_at,
          sync_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 0, ?, ?, ?)
      `;

      db.executeWriteOperation(insertCampaignSql, [
        nextId,
        campaignData.name,
        campaignData.description || null,
        campaignData.tracking_url || null,
        campaignData.status,
        campaignData.account_manager || null,
        campaignData.contact_info_credentials || null,
        campaignData.cost || null,
        campaignData.cost_status || 'estimated',
        now,
        now,
        now
      ]);

      // Insert hierarchy record
      const insertHierarchySql = `
        INSERT INTO campaign_hierarchy (
          campaign_id,
          campaign_name,
          network,
          domain,
          placement,
          targeting,
          special,
          mapping_confidence,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1.0, datetime('now'), datetime('now'))
      `;

      db.executeWriteOperation(insertHierarchySql, [
        nextId,
        campaignData.name,
        campaignData.hierarchy.network,
        campaignData.hierarchy.domain,
        campaignData.hierarchy.placement,
        campaignData.hierarchy.targeting,
        campaignData.hierarchy.special
      ]);

      // Log activity
      this.logCampaignActivity(
        nextId,
        'manual_edit',
        `Campaign created manually: ${campaignData.name}`,
        {
          name: campaignData.name,
          status: campaignData.status,
          hierarchy: campaignData.hierarchy,
          created_by: 'manual'
        },
        undefined,
        'web_ui'
      );

      // Get and return the created campaign
      const createdCampaign = await this.getCampaignById(nextId);
      return createdCampaign;
    } catch (error) {
      logger.error('Failed to create campaign', {
        campaignName: campaignData.name,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'createCampaign');
      throw error;
    }
  }

  /**
   * Log campaign activity
   * Records user actions and system changes to campaigns
   */
  static logCampaignActivity(
    campaignId: number,
    activityType: 'sync' | 'hierarchy_update' | 'status_change' | 'cost_update' | 'cost_delete' | 'data_received' | 'manual_edit',
    description: string,
    metadata?: Record<string, any>,
    userId?: string,
    source: 'etl' | 'web_ui' | 'api' | 'system' = 'web_ui'
  ): void {
    const db = getDataWarehouseDatabase();

    try {
      const insertSql = `
        INSERT INTO campaign_activity (
          campaign_id,
          activity_type,
          description,
          metadata,
          user_id,
          source,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `;

      db.executeWriteOperation(insertSql, [
        campaignId,
        activityType,
        description,
        metadata ? JSON.stringify(metadata) : null,
        userId || null,
        source
      ]);

      logger.debug('Campaign activity logged', {
        campaignId,
        activityType,
        description,
        source
      });
    } catch (error) {
      // Log error but don't fail the main operation
      logger.error('Failed to log campaign activity', {
        campaignId,
        activityType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get campaign activity log
   */
  static async getCampaignActivity(campaignId: number, query: CampaignActivityQuery): Promise<PaginatedResponse<CampaignActivity>> {
    const db = getDataWarehouseDatabase();

    try {
      // Verify campaign exists first
      await DataWarehouseCampaignService.getCampaignById(campaignId);

      const {
        page = 1,
        limit = 50
      } = query;

      ErrorUtils.validateRequest(limit <= 1000, 'Limit cannot exceed 1000');
      ErrorUtils.validateRequest(page >= 1, 'Page must be >= 1');

      const offset = (page - 1) * limit;

      // Query campaign-specific activity from campaign_activity table
      const activitySql = `
        SELECT
          id,
          campaign_id,
          activity_type,
          description,
          metadata,
          created_at,
          user_id,
          source
        FROM campaign_activity
        WHERE campaign_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      // Get total count for this campaign
      const countSql = `
        SELECT COUNT(*) as count
        FROM campaign_activity
        WHERE campaign_id = ?
      `;
      const countResult = db.executeQuerySingle<{ count: number }>(countSql, [campaignId]);
      const total = countResult?.count || 0;

      // Get activities
      const activities = db.executeQuery<any>(activitySql, [campaignId, limit, offset]);

      // Transform to match CampaignActivity interface
      const transformedActivities: CampaignActivity[] = activities.map(row => ({
        id: row.id,
        campaign_id: row.campaign_id,
        activity_type: row.activity_type,
        description: row.description,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        created_at: row.created_at,
        user_id: row.user_id,
        source: row.source
      }));

      const meta: PaginationMeta = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      };

      logger.info('Campaign activity retrieved successfully', {
        campaignId,
        activitiesCount: transformedActivities.length,
        total,
        page,
        limit
      });

      return {
        success: true,
        data: transformedActivities,
        meta,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return ErrorUtils.handleDatabaseError(error, 'getCampaignActivity');
    }
  }
}

/**
 * Metrics-related data warehouse operations
 */
export class DataWarehouseMetricsService {
  /**
   * Get hourly metrics with optional aggregation
   */
  static async getHourlyMetrics(query: DataWarehouseMetricsQuery): Promise<HourlyMetricsSummary[]> {
    const db = getDataWarehouseDatabase();

    try {
      const {
        campaignId,
        campaignIds,
        startDate,
        endDate,
        groupBy = 'hour',
        hourStart,
        hourEnd
      } = query;

      const conditions: string[] = [];
      const params: any[] = [];

      // Campaign filters
      if (campaignId) {
        conditions.push('campaign_id = ?');
        params.push(campaignId);
      } else if (campaignIds && campaignIds.length > 0) {
        const placeholders = campaignIds.map(() => '?').join(',');
        conditions.push(`campaign_id IN (${placeholders})`);
        params.push(...campaignIds);
      }

      // Date range filters
      if (startDate) {
        const startUnixHour = Math.floor(new Date(startDate).getTime() / 1000 / 3600);
        conditions.push('unix_hour >= ?');
        params.push(startUnixHour);
      }

      if (endDate) {
        const endUnixHour = Math.floor(new Date(endDate).getTime() / 1000 / 3600);
        conditions.push('unix_hour <= ?');
        params.push(endUnixHour);
      }

      // Hour range filters
      if (hourStart !== undefined) {
        conditions.push('(unix_hour % 24) >= ?');
        params.push(hourStart);
      }

      if (hourEnd !== undefined) {
        conditions.push('(unix_hour % 24) <= ?');
        params.push(hourEnd);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Build aggregation based on groupBy
      let groupByClause = '';
      let selectClause = 'unix_hour';

      switch (groupBy) {
        case 'hour':
          groupByClause = 'GROUP BY unix_hour';
          selectClause = 'unix_hour';
          break;
        case 'day':
          groupByClause = 'GROUP BY unix_hour / 24';
          selectClause = '(unix_hour / 24) * 24 as unix_hour';
          break;
        case 'week':
          groupByClause = 'GROUP BY unix_hour / (24 * 7)';
          selectClause = '(unix_hour / (24 * 7)) * (24 * 7) as unix_hour';
          break;
        case 'month':
          groupByClause = 'GROUP BY strftime("%Y-%m", datetime(unix_hour * 3600, "unixepoch"))';
          selectClause = 'MIN(unix_hour) as unix_hour';
          break;
      }

      const sql = `
        SELECT
          ${selectClause},
          datetime(unix_hour * 3600, 'unixepoch') as hour_date,
          COUNT(DISTINCT campaign_id) as campaign_count,
          SUM(credit_cards) as credit_cards,
          SUM(email_accounts) as email_accounts,
          SUM(google_accounts) as google_accounts,
          SUM(facebook_accounts) as facebook_accounts,
          SUM(sessions) as sessions,
          SUM(total_accounts) as total_accounts,
          SUM(registrations) as registrations,
          SUM(messages) as messages,
          SUM(companion_chats) as companion_chats,
          SUM(chat_room_user_chats) as chat_room_user_chats,
          SUM(chat_room_simulation_chats) as chat_room_simulation_chats,
          SUM(total_user_chats) as total_user_chats,
          SUM(media) as media,
          SUM(payment_methods) as payment_methods,
          SUM(payment_methods_canceled) as payment_methods_canceled,
          SUM(revenue_successful_cents) as revenue_successful_cents,
          SUM(revenue_successful_dollars) as revenue_successful_dollars,
          SUM(revenue_successful_count) as revenue_successful_count,
          SUM(revenue_failed_cents) as revenue_failed_cents,
          SUM(revenue_failed_dollars) as revenue_failed_dollars,
          SUM(revenue_failed_count) as revenue_failed_count,
          SUM(converted_users) as converted_users,
          SUM(terms_acceptances) as terms_acceptances
        FROM hourly_data
        ${whereClause}
        ${groupByClause}
        ORDER BY unix_hour ASC
      `;

      const results = db.executeQuery<any>(sql, params);

      const hourlyMetrics: HourlyMetricsSummary[] = results.map(row => ({
        unix_hour: row.unix_hour,
        hour_date: row.hour_date,
        campaign_count: row.campaign_count,
        metrics: {
          credit_cards: row.credit_cards || 0,
          email_accounts: row.email_accounts || 0,
          google_accounts: row.google_accounts || 0,
          facebook_accounts: row.facebook_accounts || 0,
          sessions: row.sessions || 0,
          total_accounts: row.total_accounts || 0,
          registrations: row.registrations || 0,
          messages: row.messages || 0,
          companion_chats: row.companion_chats || 0,
          chat_room_user_chats: row.chat_room_user_chats || 0,
          chat_room_simulation_chats: row.chat_room_simulation_chats || 0,
          total_user_chats: row.total_user_chats || 0,
          media: row.media || 0,
          payment_methods: row.payment_methods || 0,
          payment_methods_canceled: row.payment_methods_canceled || 0,
          revenue_successful_cents: row.revenue_successful_cents || 0,
          revenue_successful_dollars: row.revenue_successful_dollars || 0,
          revenue_successful_count: row.revenue_successful_count || 0,
          revenue_failed_cents: row.revenue_failed_cents || 0,
          revenue_failed_dollars: row.revenue_failed_dollars || 0,
          revenue_failed_count: row.revenue_failed_count || 0,
          converted_users: row.converted_users || 0,
          terms_acceptances: row.terms_acceptances || 0,
          sync_timestamp: ''
        }
      }));

      logger.info('Retrieved hourly metrics', {
        count: hourlyMetrics.length,
        groupBy,
        dateRange: `${startDate || 'beginning'} to ${endDate || 'latest'}`,
        campaignFilter: campaignId ? `single(${campaignId})` : campaignIds ? `multiple(${campaignIds.length})` : 'all'
      });

      return hourlyMetrics;

    } catch (error) {
      logger.error('Failed to get hourly metrics', {
        error: error instanceof Error ? error.message : String(error),
        query
      });
      ErrorUtils.handleDatabaseError(error, 'getHourlyMetrics');
      throw error;
    }
  }

  /**
   * Get aggregated metrics across campaigns
   */
  static async getAggregatedMetrics(query: DataWarehouseMetricsQuery): Promise<AggregatedMetrics> {
    const db = getDataWarehouseDatabase();

    try {
      const {
        campaignIds,
        startDate,
        endDate,
        aggregateBy = 'sum'
      } = query;

      const conditions: string[] = [];
      const params: any[] = [];

      // Campaign filters
      if (campaignIds && campaignIds.length > 0) {
        const placeholders = campaignIds.map(() => '?').join(',');
        conditions.push(`campaign_id IN (${placeholders})`);
        params.push(...campaignIds);
      }

      // Date range filters
      if (startDate) {
        const startUnixHour = Math.floor(new Date(startDate).getTime() / 1000 / 3600);
        conditions.push('unix_hour >= ?');
        params.push(startUnixHour);
      }

      if (endDate) {
        const endUnixHour = Math.floor(new Date(endDate).getTime() / 1000 / 3600);
        conditions.push('unix_hour <= ?');
        params.push(endUnixHour);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Build aggregation function
      const aggFunc = aggregateBy.toUpperCase();
      ErrorUtils.validateRequest(
        ['SUM', 'AVG', 'MIN', 'MAX'].includes(aggFunc),
        'Invalid aggregateBy value. Must be one of: sum, avg, min, max'
      );

      const sql = `
        SELECT
          COUNT(DISTINCT campaign_id) as campaign_count,
          ${aggFunc}(credit_cards) as total_credit_cards,
          ${aggFunc}(email_accounts) as total_email_accounts,
          ${aggFunc}(google_accounts) as total_google_accounts,
          ${aggFunc}(sessions) as total_sessions,
          ${aggFunc}(total_accounts) as total_accounts,
          ${aggFunc}(registrations) as total_registrations,
          ${aggFunc}(messages) as total_messages,
          ${aggFunc}(companion_chats) as total_companion_chats,
          ${aggFunc}(chat_room_user_chats) as total_chat_room_user_chats,
          ${aggFunc}(media) as total_media,
          ${aggFunc}(payment_methods) as total_payment_methods,
          ${aggFunc}(converted_users) as total_converted_users,
          ${aggFunc}(terms_acceptances) as total_terms_acceptances
        FROM hourly_data
        ${whereClause}
      `;

      const result = db.executeQuerySingle<any>(sql, params);

      if (!result) {
        throw new NotFoundError('No metrics data found for the specified criteria');
      }

      const totalSessions = result.total_sessions || 0;
      const totalRegistrations = result.total_registrations || 0;
      const totalMessages = result.total_messages || 0;
      const totalAccounts = result.total_accounts || 0;

      const aggregated: AggregatedMetrics = {
        period: `${startDate || 'beginning'} to ${endDate || 'latest'}`,
        campaignCount: result.campaign_count || 0,
        totalSessions,
        totalRegistrations,
        totalMessages,
        totalConvertedUsers: result.total_converted_users || 0,
        totalAccounts,
        totalCreditCards: result.total_credit_cards || 0,
        totalEmailAccounts: result.total_email_accounts || 0,
        totalGoogleAccounts: result.total_google_accounts || 0,
        totalCompanionChats: result.total_companion_chats || 0,
        totalChatRoomUserChats: result.total_chat_room_user_chats || 0,
        totalMedia: result.total_media || 0,
        totalPaymentMethods: result.total_payment_methods || 0,
        totalTermsAcceptances: result.total_terms_acceptances || 0,
        avgRegistrationRate: totalSessions > 0 ? (totalRegistrations / totalSessions) * 100 : 0,
        avgConversionRate: totalRegistrations > 0 ? (result.total_converted_users / totalRegistrations) * 100 : 0,
        avgMessageRate: totalSessions > 0 ? (totalMessages / totalSessions) * 100 : 0,
        avgAccountCreationRate: totalSessions > 0 ? (totalAccounts / totalSessions) * 100 : 0
      };

      logger.info('Calculated aggregated metrics', {
        campaignCount: aggregated.campaignCount,
        totalSessions: aggregated.totalSessions,
        aggregateBy,
        period: aggregated.period
      });

      return aggregated;

    } catch (error) {
      logger.error('Failed to get aggregated metrics', {
        error: error instanceof Error ? error.message : String(error),
        query
      });
      ErrorUtils.handleDatabaseError(error, 'getAggregatedMetrics');
      throw error;
    }
  }

  /**
   * Get performance KPIs and rankings
   */
  static async getPerformanceKPIs(query: DataWarehouseMetricsQuery): Promise<{
    topPerformers: CampaignPerformanceRanking[];
    overallKPIs: {
      totalCampaigns: number;
      activeCampaigns: number;
      totalSessions: number;
      avgRegistrationRate: number;
      avgConversionRate: number;
      topNetworks: Array<{ network: string; sessionCount: number; campaignCount: number }>;
    };
  }> {
    const db = getDataWarehouseDatabase();

    try {
      const { startDate, endDate } = query;
      const limit = 10;

      const conditions: string[] = [];
      const params: any[] = [];

      // Date range filters
      if (startDate) {
        const startUnixHour = Math.floor(new Date(startDate).getTime() / 1000 / 3600);
        conditions.push('hd.unix_hour >= ?');
        params.push(startUnixHour);
      }

      if (endDate) {
        const endUnixHour = Math.floor(new Date(endDate).getTime() / 1000 / 3600);
        conditions.push('hd.unix_hour <= ?');
        params.push(endUnixHour);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get top performing campaigns
      const topPerformersSql = `
        SELECT
          c.*,
          ch.network,
          ch.domain,
          ch.placement,
          ch.targeting,
          ch.special,
          ch.mapping_confidence,
          SUM(hd.sessions) as total_sessions,
          SUM(hd.registrations) as total_registrations,
          SUM(hd.messages) as total_messages,
          SUM(hd.converted_users) as total_converted_users,
          CASE
            WHEN SUM(hd.sessions) > 0 THEN (SUM(hd.registrations) * 1.0 / SUM(hd.sessions)) * 100
            ELSE 0
          END as registration_rate,
          CASE
            WHEN SUM(hd.registrations) > 0 THEN (SUM(hd.converted_users) * 1.0 / SUM(hd.registrations)) * 100
            ELSE 0
          END as conversion_rate,
          CASE
            WHEN SUM(hd.sessions) > 0 THEN (SUM(hd.messages) * 1.0 / SUM(hd.sessions)) * 100
            ELSE 0
          END as message_rate,
          -- Performance score calculation (weighted)
          (SUM(hd.sessions) * 0.3 +
           SUM(hd.registrations) * 0.4 +
           SUM(hd.converted_users) * 0.3) as performance_score
        FROM campaigns c
        LEFT JOIN campaign_hierarchy ch ON c.id = ch.campaign_id
        LEFT JOIN hourly_data hd ON c.id = hd.campaign_id
        ${whereClause}
        GROUP BY c.id, ch.id
        HAVING SUM(hd.sessions) > 0
        ORDER BY performance_score DESC
        LIMIT ?
      `;

      const topPerformersResults = db.executeQuery<any>(topPerformersSql, [...params, limit]);

      const topPerformers: CampaignPerformanceRanking[] = topPerformersResults.map((row, index) => {
        const ranking: CampaignPerformanceRanking = {
          campaign: {
            id: row.id,
            name: row.name,
            description: row.description,
            tracking_url: row.tracking_url,
            is_serving: Boolean(row.is_serving),
            serving_url: row.serving_url,
            traffic_weight: row.traffic_weight,
            deleted_at: row.deleted_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
            slug: row.slug,
            path: row.path,
            cost: row.cost || 0,
            status: row.status || 'unknown',
            sync_timestamp: row.sync_timestamp
          },
          rank: index + 1,
          score: row.performance_score || 0,
          metrics: {
            sessions: row.total_sessions || 0,
            registrations: row.total_registrations || 0,
            messages: row.total_messages || 0,
            convertedUsers: row.total_converted_users || 0,
            registrationRate: row.registration_rate || 0,
            conversionRate: row.conversion_rate || 0,
            messageRate: row.message_rate || 0
          }
        };

        if (row.network) {
          ranking.hierarchy = {
            id: 0,
            campaign_id: row.id,
            campaign_name: row.name,
            network: row.network,
            domain: row.domain,
            placement: row.placement,
            targeting: row.targeting,
            special: row.special,
            mapping_confidence: row.mapping_confidence,
            created_at: '',
            updated_at: ''
          };
        }

        return ranking;
      });

      // Get overall KPIs
      const overallKPIsSql = `
        SELECT
          COUNT(DISTINCT c.id) as total_campaigns,
          COUNT(DISTINCT CASE WHEN c.is_serving = 1 THEN c.id END) as active_campaigns,
          COALESCE(SUM(hd.sessions), 0) as total_sessions,
          CASE
            WHEN SUM(hd.sessions) > 0 THEN (SUM(hd.registrations) * 1.0 / SUM(hd.sessions)) * 100
            ELSE 0
          END as avg_registration_rate,
          CASE
            WHEN SUM(hd.registrations) > 0 THEN (SUM(hd.converted_users) * 1.0 / SUM(hd.registrations)) * 100
            ELSE 0
          END as avg_conversion_rate
        FROM campaigns c
        LEFT JOIN hourly_data hd ON c.id = hd.campaign_id
        ${whereClause}
      `;

      const overallKPIsResult = db.executeQuerySingle<any>(overallKPIsSql, params);

      // Get top networks
      const topNetworksSql = `
        SELECT
          ch.network,
          SUM(hd.sessions) as session_count,
          COUNT(DISTINCT c.id) as campaign_count
        FROM campaigns c
        LEFT JOIN campaign_hierarchy ch ON c.id = ch.campaign_id
        LEFT JOIN hourly_data hd ON c.id = hd.campaign_id
        ${whereClause}
        GROUP BY ch.network
        HAVING ch.network IS NOT NULL AND SUM(hd.sessions) > 0
        ORDER BY session_count DESC
        LIMIT 5
      `;

      const topNetworksResults = db.executeQuery<any>(topNetworksSql, params);

      const overallKPIs = {
        totalCampaigns: overallKPIsResult?.total_campaigns || 0,
        activeCampaigns: overallKPIsResult?.active_campaigns || 0,
        totalSessions: overallKPIsResult?.total_sessions || 0,
        avgRegistrationRate: overallKPIsResult?.avg_registration_rate || 0,
        avgConversionRate: overallKPIsResult?.avg_conversion_rate || 0,
        topNetworks: topNetworksResults.map(row => ({
          network: row.network,
          sessionCount: row.session_count || 0,
          campaignCount: row.campaign_count || 0
        }))
      };

      logger.info('Calculated performance KPIs', {
        topPerformersCount: topPerformers.length,
        totalCampaigns: overallKPIs.totalCampaigns,
        activeCampaigns: overallKPIs.activeCampaigns,
        topNetworksCount: overallKPIs.topNetworks.length
      });

      return {
        topPerformers,
        overallKPIs
      };

    } catch (error) {
      logger.error('Failed to get performance KPIs', {
        error: error instanceof Error ? error.message : String(error),
        query
      });
      ErrorUtils.handleDatabaseError(error, 'getPerformanceKPIs');
      throw error;
    }
  }
}

/**
 * Hierarchy-related data warehouse operations
 */
export class DataWarehouseHierarchyService {
  /**
   * Get complete hierarchy tree
   */
  static async getHierarchyTree(): Promise<{
    networks: Array<{
      network: string;
      domains: Array<{
        domain: string;
        placements: Array<{
          placement: string;
          targetingOptions: string[];
          campaignCount: number;
        }>;
        campaignCount: number;
      }>;
      campaignCount: number;
    }>;
    unmappedCampaigns: number;
    totalCampaigns: number;
  }> {
    const db = getDataWarehouseDatabase();

    try {
      // Get hierarchy structure
      const hierarchySql = `
        SELECT
          ch.network,
          ch.domain,
          ch.placement,
          ch.targeting,
          COUNT(DISTINCT ch.campaign_id) as campaign_count
        FROM campaign_hierarchy ch
        GROUP BY ch.network, ch.domain, ch.placement, ch.targeting
        ORDER BY ch.network, ch.domain, ch.placement, ch.targeting
      `;

      const hierarchyResults = db.executeQuery<any>(hierarchySql);

      // Get unmapped campaigns count
      const unmappedSql = `
        SELECT COUNT(*) as count
        FROM campaigns c
        WHERE NOT EXISTS (
          SELECT 1 FROM campaign_hierarchy ch
          WHERE ch.campaign_id = c.id
        )
      `;

      const unmappedResult = db.executeQuerySingle<{ count: number }>(unmappedSql);

      // Get total campaigns count
      const totalSql = `SELECT COUNT(*) as count FROM campaigns`;
      const totalResult = db.executeQuerySingle<{ count: number }>(totalSql);

      // Build hierarchy tree
      const networkMap = new Map<string, any>();

      for (const row of hierarchyResults) {
        if (!networkMap.has(row.network)) {
          networkMap.set(row.network, {
            network: row.network,
            domains: new Map<string, any>(),
            campaignCount: 0
          });
        }

        const network = networkMap.get(row.network);
        const domainMap = network.domains;

        if (!domainMap.has(row.domain)) {
          domainMap.set(row.domain, {
            domain: row.domain,
            placements: new Map<string, any>(),
            campaignCount: 0
          });
        }

        const domain = domainMap.get(row.domain);
        const placementMap = domain.placements;

        if (!placementMap.has(row.placement)) {
          placementMap.set(row.placement, {
            placement: row.placement,
            targetingOptions: new Set<string>(),
            campaignCount: 0
          });
        }

        const placement = placementMap.get(row.placement);
        placement.targetingOptions.add(row.targeting);
        placement.campaignCount += row.campaign_count;
        domain.campaignCount += row.campaign_count;
        network.campaignCount += row.campaign_count;
      }

      // Convert maps to arrays
      const networks = Array.from(networkMap.values()).map(network => ({
        network: network.network as string,
        domains: Array.from(network.domains.values()).map((domain: any) => ({
          domain: domain.domain as string,
          placements: Array.from(domain.placements.values()).map((placement: any) => ({
            placement: placement.placement as string,
            targetingOptions: Array.from(placement.targetingOptions) as string[],
            campaignCount: placement.campaignCount as number
          })),
          campaignCount: domain.campaignCount as number
        })),
        campaignCount: network.campaignCount as number
      }));

      const result = {
        networks,
        unmappedCampaigns: unmappedResult?.count || 0,
        totalCampaigns: totalResult?.count || 0
      };

      logger.info('Built hierarchy tree', {
        networksCount: networks.length,
        unmappedCampaigns: result.unmappedCampaigns,
        totalCampaigns: result.totalCampaigns
      });

      return result;

    } catch (error) {
      logger.error('Failed to get hierarchy tree', {
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'getHierarchyTree');
      throw error;
    }
  }

  /**
   * Get hierarchy mapping statistics
   */
  static async getHierarchyMappingStats(): Promise<HierarchyMappingStats> {
    const db = getDataWarehouseDatabase();

    try {
      // Get basic mapping stats
      const basicStatsSql = `
        SELECT
          COUNT(DISTINCT c.id) as total_campaigns,
          COUNT(DISTINCT ch.campaign_id) as mapped_campaigns
        FROM campaigns c
        LEFT JOIN campaign_hierarchy ch ON c.id = ch.campaign_id
      `;

      const basicStats = db.executeQuerySingle<any>(basicStatsSql);

      const totalCampaigns = basicStats?.total_campaigns || 0;
      const mappedCampaigns = basicStats?.mapped_campaigns || 0;
      const unmappedCampaigns = totalCampaigns - mappedCampaigns;
      const mappingCoverage = totalCampaigns > 0 ? (mappedCampaigns / totalCampaigns) * 100 : 0;

      // Get network distribution
      const networksSql = `
        SELECT
          network,
          COUNT(*) as count
        FROM campaign_hierarchy
        GROUP BY network
        ORDER BY count DESC
      `;

      const networksResults = db.executeQuery<any>(networksSql);
      const networks = networksResults.map(row => ({
        network: row.network,
        count: row.count,
        percentage: mappedCampaigns > 0 ? (row.count / mappedCampaigns) * 100 : 0
      }));

      // Get domain distribution
      const domainsSql = `
        SELECT
          domain,
          COUNT(*) as count
        FROM campaign_hierarchy
        GROUP BY domain
        ORDER BY count DESC
        LIMIT 10
      `;

      const domainsResults = db.executeQuery<any>(domainsSql);
      const domains = domainsResults.map(row => ({
        domain: row.domain,
        count: row.count,
        percentage: mappedCampaigns > 0 ? (row.count / mappedCampaigns) * 100 : 0
      }));

      // Get placement distribution
      const placementsSql = `
        SELECT
          placement,
          COUNT(*) as count
        FROM campaign_hierarchy
        GROUP BY placement
        ORDER BY count DESC
        LIMIT 10
      `;

      const placementsResults = db.executeQuery<any>(placementsSql);
      const placements = placementsResults.map(row => ({
        placement: row.placement,
        count: row.count,
        percentage: mappedCampaigns > 0 ? (row.count / mappedCampaigns) * 100 : 0
      }));

      // Get confidence distribution
      const confidenceSql = `
        SELECT
          CASE
            WHEN mapping_confidence >= 0.9 THEN '0.9-1.0'
            WHEN mapping_confidence >= 0.7 THEN '0.7-0.9'
            WHEN mapping_confidence >= 0.5 THEN '0.5-0.7'
            ELSE '0.0-0.5'
          END as confidence_range,
          COUNT(*) as count
        FROM campaign_hierarchy
        GROUP BY confidence_range
        ORDER BY confidence_range DESC
      `;

      const confidenceResults = db.executeQuery<any>(confidenceSql);
      const confidenceDistribution = confidenceResults.map(row => ({
        range: row.confidence_range,
        count: row.count,
        percentage: mappedCampaigns > 0 ? (row.count / mappedCampaigns) * 100 : 0
      }));

      const stats: HierarchyMappingStats = {
        totalCampaigns,
        mappedCampaigns,
        unmappedCampaigns,
        mappingCoverage,
        networks,
        domains,
        placements,
        confidenceDistribution
      };

      logger.info('Generated hierarchy mapping stats', {
        totalCampaigns,
        mappedCampaigns,
        mappingCoverage: Math.round(mappingCoverage * 100) / 100,
        networksCount: networks.length
      });

      return stats;

    } catch (error) {
      logger.error('Failed to get hierarchy mapping stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'getHierarchyMappingStats');
      throw error;
    }
  }

  /**
   * Get campaign hierarchy mapping
   */
  static async getCampaignHierarchyMapping(campaignId: number): Promise<CampaignHierarchy | null> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');

      const sql = `
        SELECT ch.*, c.name as campaign_name
        FROM campaign_hierarchy ch
        JOIN campaigns c ON ch.campaign_id = c.id
        WHERE ch.campaign_id = ?
      `;

      const result = db.executeQuerySingle<any>(sql, [campaignId]);

      if (!result) {
        return null;
      }

      const hierarchy: CampaignHierarchy = {
        id: result.id,
        campaign_id: result.campaign_id,
        campaign_name: result.campaign_name,
        network: result.network,
        domain: result.domain,
        placement: result.placement,
        targeting: result.targeting,
        special: result.special,
        mapping_confidence: result.mapping_confidence,
        created_at: result.created_at,
        updated_at: result.updated_at
      };

      logger.info('Retrieved campaign hierarchy mapping', {
        campaignId,
        network: hierarchy.network,
        domain: hierarchy.domain,
        confidence: hierarchy.mapping_confidence
      });

      return hierarchy;

    } catch (error) {
      logger.error('Failed to get campaign hierarchy mapping', {
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'getCampaignHierarchyMapping');
      throw error;
    }
  }
}

/**
 * Sync and health monitoring operations
 */
export class DataWarehouseSyncService {
  /**
   * Get sync status and history
   */
  static async getSyncStatus(query: SyncStatusQuery): Promise<SyncStatusResponse> {
    const db = getDataWarehouseDatabase();

    try {
      const { syncType, status, limit = 10, includeCurrent = true } = query;

      const conditions: string[] = [];
      const params: any[] = [];

      if (syncType) {
        conditions.push('sync_type = ?');
        params.push(syncType);
      }

      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get current running sync
      const current: {
        isRunning: boolean;
        syncType?: string;
        startTime?: string;
        progress?: number;
      } = {
        isRunning: false
      };

      if (includeCurrent) {
        const currentSql = `
          SELECT *
          FROM sync_history
          WHERE status = 'running'
          ORDER BY start_time DESC
          LIMIT 1
        `;

        const currentSync = db.executeQuerySingle<SyncHistory>(currentSql);

        if (currentSync) {
          current.isRunning = true;
          current.syncType = currentSync.sync_type;
          current.startTime = currentSync.start_time;
          current.progress = currentSync.records_processed; // Could be enhanced with actual progress calculation
        }
      }

      // Get recent sync history
      const recentSql = `
        SELECT *
        FROM sync_history
        ${whereClause}
        ORDER BY start_time DESC
        LIMIT ?
      `;

      const recent = db.executeQuery<SyncHistory>(recentSql, [...params, limit]);

      // Calculate summary statistics
      const summarySql = `
        SELECT
          COUNT(*) as total_syncs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
          MAX(CASE WHEN status = 'completed' THEN start_time END) as last_successful_sync,
          MAX(CASE WHEN status = 'failed' THEN start_time END) as last_failed_sync,
          AVG(CASE WHEN status = 'completed' THEN records_processed ELSE NULL END) as avg_records_processed,
          AVG(
            CASE
              WHEN status = 'completed' AND end_time IS NOT NULL
              THEN (julianday(end_time) - julianday(start_time)) * 24 * 60
              ELSE NULL
            END
          ) as avg_sync_duration_minutes
        FROM sync_history
        ${whereClause}
      `;

      const summaryResult = db.executeQuerySingle<any>(summarySql, params);

      const totalSyncs = summaryResult?.total_syncs || 0;
      const successfulSyncs = summaryResult?.successful_syncs || 0;

      const summary = {
        totalSyncs,
        successfulSyncs,
        failedSyncs: summaryResult?.failed_syncs || 0,
        successRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0,
        lastSuccessfulSync: summaryResult?.last_successful_sync,
        lastFailedSync: summaryResult?.last_failed_sync,
        avgRecordsProcessed: Math.round(summaryResult?.avg_records_processed || 0),
        avgSyncDuration: Math.round(summaryResult?.avg_sync_duration_minutes || 0)
      };

      const response: SyncStatusResponse = {
        current,
        recent,
        summary
      };

      logger.info('Retrieved sync status', {
        isRunning: current.isRunning,
        recentCount: recent.length,
        successRate: Math.round(summary.successRate * 100) / 100
      });

      return response;

    } catch (error) {
      logger.error('Failed to get sync status', {
        error: error instanceof Error ? error.message : String(error),
        query
      });
      ErrorUtils.handleDatabaseError(error, 'getSyncStatus');
      throw error;
    }
  }

  /**
   * Get sync history
   */
  static async getSyncHistory(query: SyncStatusQuery): Promise<PaginatedResponse<SyncHistory>> {
    const db = getDataWarehouseDatabase();

    try {
      const {
        syncType,
        status,
        limit = 20
      } = query;

      const page = 1; // Simple implementation for now
      const offset = (page - 1) * limit;

      const conditions: string[] = [];
      const params: any[] = [];

      if (syncType) {
        conditions.push('sync_type = ?');
        params.push(syncType);
      }

      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countSql = `
        SELECT COUNT(*) as count
        FROM sync_history
        ${whereClause}
      `;

      const countResult = db.executeQuerySingle<{ count: number }>(countSql, params);
      const total = countResult?.count || 0;

      // Get sync history
      const sql = `
        SELECT *
        FROM sync_history
        ${whereClause}
        ORDER BY start_time DESC
        LIMIT ? OFFSET ?
      `;

      const syncHistory = db.executeQuery<SyncHistory>(sql, [...params, limit, offset]);

      const meta: PaginationMeta = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      };

      logger.info('Retrieved sync history', {
        count: syncHistory.length,
        total,
        filters: { syncType, status }
      });

      return {
        success: true,
        data: syncHistory,
        meta,
        message: 'Sync history retrieved successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get sync history', {
        error: error instanceof Error ? error.message : String(error),
        query
      });
      ErrorUtils.handleDatabaseError(error, 'getSyncHistory');
      throw error;
    }
  }

  /**
   * Get comprehensive health check
   */
  static async getHealthCheck(): Promise<DataWarehouseHealthCheck> {
    const db = getDataWarehouseDatabase();
    const startTime = Date.now();

    try {
      // Get database health from connection
      const dbHealth = await db.healthCheck();

      // Get data quality metrics
      const dataQualitySql = `
        SELECT
          COUNT(DISTINCT c.id) as total_campaigns,
          COUNT(DISTINCT hd.campaign_id) as campaigns_with_data,
          COUNT(DISTINCT ch.campaign_id) as campaigns_with_hierarchy,
          COUNT(hd.campaign_id) as total_data_points,
          MIN(datetime(hd.unix_hour * 3600, 'unixepoch')) as oldest_data_point,
          MAX(datetime(hd.unix_hour * 3600, 'unixepoch')) as newest_data_point,
          COUNT(CASE WHEN hd.unix_hour >= ? THEN 1 END) as recent_data_points
        FROM campaigns c
        LEFT JOIN hourly_data hd ON c.id = hd.campaign_id
        LEFT JOIN campaign_hierarchy ch ON c.id = ch.campaign_id
      `;

      // Calculate recent threshold (last 24 hours)
      const recentThreshold = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000 / 3600);
      const dataQualityResult = db.executeQuerySingle<any>(dataQualitySql, [recentThreshold]);

      const totalCampaigns = dataQualityResult?.total_campaigns || 0;
      const campaignsWithData = dataQualityResult?.campaigns_with_data || 0;
      const campaignsWithoutData = totalCampaigns - campaignsWithData;
      const campaignsWithHierarchy = dataQualityResult?.campaigns_with_hierarchy || 0;

      const dataQuality = {
        campaignsWithData,
        campaignsWithoutData,
        dataCompleteness: totalCampaigns > 0 ? (campaignsWithData / totalCampaigns) * 100 : 0,
        hierarchyMappingCoverage: totalCampaigns > 0 ? (campaignsWithHierarchy / totalCampaigns) * 100 : 0,
        recentDataPoints: dataQualityResult?.recent_data_points || 0,
        oldestDataPoint: dataQualityResult?.oldest_data_point,
        newestDataPoint: dataQualityResult?.newest_data_point
      };

      const responseTime = Date.now() - startTime;
      const uptime = process.uptime();

      // Determine API status
      let apiStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
      if (responseTime > 5000) {
        apiStatus = 'degraded';
      }
      if (!dbHealth.connected || dbHealth.dataFreshness.isStale) {
        apiStatus = 'degraded';
      }

      const healthCheck: DataWarehouseHealthCheck = {
        database: dbHealth,
        dataQuality,
        api: {
          status: apiStatus,
          responseTime,
          uptime
        }
      };

      logger.info('Generated health check report', {
        apiStatus,
        responseTime,
        dbConnected: dbHealth.connected,
        dataFreshness: dbHealth.dataFreshness.hoursSinceLastSync,
        campaignsWithData,
        totalCampaigns
      });

      return healthCheck;

    } catch (error) {
      logger.error('Failed to generate health check', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Return basic health check on error
      return {
        database: {
          connected: false,
          path: '',
          size: null,
          tables: [],
          tableCounts: {},
          lastSync: null,
          dataFreshness: {
            hoursSinceLastSync: null,
            isStale: true
          },
          performance: {
            queryTime: Date.now() - startTime,
            cacheHitRate: 'unknown'
          }
        },
        dataQuality: {
          campaignsWithData: 0,
          campaignsWithoutData: 0,
          dataCompleteness: 0,
          hierarchyMappingCoverage: 0,
          recentDataPoints: 0,
          oldestDataPoint: null,
          newestDataPoint: null
        },
        api: {
          status: 'down',
          responseTime: Date.now() - startTime,
          uptime: process.uptime()
        }
      };
    }
  }
}

/**
 * Hierarchy Override operations
 * Allows manual corrections to auto-generated hierarchy mappings
 */
export class DataWarehouseHierarchyOverrideService {
  /**
   * Update campaign hierarchy with manual override
   */
  static async updateHierarchyOverride(
    campaignId: number,
    overrideData: {
      network?: string;
      domain?: string;
      placement?: string;
      targeting?: string;
      special?: string;
      override_reason?: string;
      overridden_by: string;
    }
  ): Promise<{ success: boolean; hierarchy: CampaignHierarchy }> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');
      ErrorUtils.validateRequest(overrideData.overridden_by, 'overridden_by is required');

      // Verify campaign exists
      const campaign = await DataWarehouseCampaignService.getCampaignById(campaignId);

      // Get existing override (if any) before deactivating to preserve unchanged fields
      const existingOverrideSql = `
        SELECT network, domain, placement, targeting, special
        FROM campaign_hierarchy_overrides
        WHERE campaign_id = ? AND is_active = 1
      `;
      const existingOverride = db.executeQuerySingle<any>(existingOverrideSql, [campaignId]);

      // Merge new values with existing override values (preserve unchanged fields)
      const mergedOverride = {
        network: overrideData.network !== undefined ? overrideData.network : (existingOverride?.network || null),
        domain: overrideData.domain !== undefined ? overrideData.domain : (existingOverride?.domain || null),
        placement: overrideData.placement !== undefined ? overrideData.placement : (existingOverride?.placement || null),
        targeting: overrideData.targeting !== undefined ? overrideData.targeting : (existingOverride?.targeting || null),
        special: overrideData.special !== undefined ? overrideData.special : (existingOverride?.special || null),
      };

      // Deactivate existing override if any
      const deactivateSql = `
        UPDATE campaign_hierarchy_overrides
        SET is_active = 0
        WHERE campaign_id = ? AND is_active = 1
      `;
      db.executeWriteOperation(deactivateSql, [campaignId]);

      // Insert new override with merged values
      const insertSql = `
        INSERT INTO campaign_hierarchy_overrides (
          campaign_id, network, domain, placement, targeting, special,
          override_reason, overridden_by, overridden_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
      `;

      db.executeWriteOperation(insertSql, [
        campaignId,
        mergedOverride.network,
        mergedOverride.domain,
        mergedOverride.placement,
        mergedOverride.targeting,
        mergedOverride.special,
        overrideData.override_reason || null,
        overrideData.overridden_by
      ]);

      // Get merged hierarchy (base + override)
      const mergedSql = `
        SELECT
          ch.id,
          ch.campaign_id,
          ch.campaign_name,
          COALESCE(cho.network, ch.network) as network,
          COALESCE(cho.domain, ch.domain) as domain,
          COALESCE(cho.placement, ch.placement) as placement,
          COALESCE(cho.targeting, ch.targeting) as targeting,
          COALESCE(cho.special, ch.special) as special,
          ch.mapping_confidence,
          ch.created_at,
          ch.updated_at,
          CASE WHEN cho.id IS NOT NULL THEN 1 ELSE 0 END as has_override,
          cho.override_reason,
          cho.overridden_by,
          cho.overridden_at
        FROM campaign_hierarchy ch
        LEFT JOIN campaign_hierarchy_overrides cho ON ch.campaign_id = cho.campaign_id AND cho.is_active = 1
        WHERE ch.campaign_id = ?
      `;

      const mergedResult = db.executeQuerySingle<any>(mergedSql, [campaignId]);

      if (!mergedResult) {
        throw new NotFoundError('Campaign hierarchy not found after override');
      }

      const mergedHierarchy: CampaignHierarchy = {
        id: mergedResult.id,
        campaign_id: mergedResult.campaign_id,
        campaign_name: mergedResult.campaign_name,
        network: mergedResult.network,
        domain: mergedResult.domain,
        placement: mergedResult.placement,
        targeting: mergedResult.targeting,
        special: mergedResult.special,
        mapping_confidence: mergedResult.mapping_confidence,
        created_at: mergedResult.created_at,
        updated_at: mergedResult.updated_at
      };

      logger.info('Updated hierarchy override', {
        campaignId,
        overriddenBy: overrideData.overridden_by,
        fields: Object.keys(overrideData).filter(k => k !== 'overridden_by' && overrideData[k as keyof typeof overrideData])
      });

      // Log activity
      const changedFields = Object.keys(overrideData)
        .filter(k => k !== 'overridden_by' && k !== 'override_reason' && overrideData[k as keyof typeof overrideData])
        .map(k => k.charAt(0).toUpperCase() + k.slice(1))
        .join(', ');

      DataWarehouseCampaignService.logCampaignActivity(
        campaignId,
        'hierarchy_update',
        `Updated hierarchy: ${changedFields || 'No fields changed'}`,
        {
          network: overrideData.network,
          domain: overrideData.domain,
          placement: overrideData.placement,
          targeting: overrideData.targeting,
          special: overrideData.special,
          reason: overrideData.override_reason
        },
        overrideData.overridden_by,
        'web_ui'
      );

      return {
        success: true,
        hierarchy: mergedHierarchy
      };

    } catch (error) {
      logger.error('Failed to update hierarchy override', {
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'updateHierarchyOverride');
      throw error;
    }
  }

  /**
   * Delete (deactivate) hierarchy override
   */
  static async deleteHierarchyOverride(campaignId: number, overridden_by: string): Promise<{ success: boolean }> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');

      // Call Python to delete override
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const pythonScript = `
import sys
sys.path.insert(0, '${process.cwd()}/../datawarehouse-job/src')
from database.operations import DatabaseOperations
from database.schema import initialize_database

conn = initialize_database('${process.cwd()}/../datawarehouse-job/datawarehouse.db')
db_ops = DatabaseOperations(conn)
success = db_ops.delete_hierarchy_override(${campaignId}, '${overridden_by}')
print('true' if success else 'false')
conn.close()
`;

      const { stdout } = await execAsync(`python3 -c "${pythonScript.replace(/\n/g, '; ')}"`);
      const success = stdout.trim() === 'true';

      logger.info('Deleted hierarchy override', {
        campaignId,
        success
      });

      return { success };

    } catch (error) {
      logger.error('Failed to delete hierarchy override', {
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'deleteHierarchyOverride');
      throw error;
    }
  }

  /**
   * Get hierarchy override history for a campaign
   */
  static async getHierarchyOverrideHistory(campaignId: number, limit: number = 10): Promise<any[]> {
    const db = getDataWarehouseDatabase();

    try {
      ErrorUtils.validateRequest(!isNaN(campaignId) && campaignId > 0, 'Campaign ID must be a positive number');

      // Call Python to get history
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const pythonScript = `
import sys
import json
sys.path.insert(0, '${process.cwd()}/../datawarehouse-job/src')
from database.operations import DatabaseOperations
from database.schema import initialize_database

conn = initialize_database('${process.cwd()}/../datawarehouse-job/datawarehouse.db')
db_ops = DatabaseOperations(conn)
history = db_ops.get_hierarchy_override_history(${campaignId}, ${limit})
print(json.dumps(history))
conn.close()
`;

      const { stdout } = await execAsync(`python3 -c "${pythonScript.replace(/\n/g, '; ')}"`);
      const history = JSON.parse(stdout.trim());

      logger.info('Retrieved hierarchy override history', {
        campaignId,
        historyCount: history.length
      });

      return history;

    } catch (error) {
      logger.error('Failed to get hierarchy override history', {
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'getHierarchyOverrideHistory');
      throw error;
    }
  }
}

export default DataWarehouseCampaignService;