/**
 * Metrics service layer
 * Provides business logic for metrics and analytics operations
 */

import { getQueries } from '../database/queries.js';
import logger from '../utils/logger.js';
import { ErrorUtils, BadRequestError } from '../utils/errors.js';
import {
  MetricsQuery,
  PerformanceMetrics
} from '../types/index.js';

/**
 * Metrics service class
 */
export class MetricsService {
  private queries = getQueries();

  /**
   * Get campaign metrics with filtering and aggregation
   */
  async getMetrics(query: MetricsQuery = {}): Promise<PerformanceMetrics[]> {
    try {
      logger.debug('Getting metrics', { query });

      // Validate date range
      this.validateDateRange(query.startDate, query.endDate);

      const metrics = this.queries.getCampaignMetrics(query);

      logger.info('Retrieved metrics', {
        count: metrics.length,
        campaignId: query.campaignId,
        groupBy: query.groupBy,
        aggregateBy: query.aggregateBy
      });

      return metrics;
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }

      logger.error('Failed to get metrics', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorUtils.handleDatabaseError(error, 'getMetrics');
    }
  }

  /**
   * Get campaign-specific metrics
   */
  async getCampaignMetrics(
    campaignId: number,
    query: Omit<MetricsQuery, 'campaignId'> = {}
  ): Promise<PerformanceMetrics[]> {
    try {
      logger.debug('Getting campaign metrics', { campaignId, query });

      const metricsQuery: MetricsQuery = {
        ...query,
        campaignId
      };

      return await this.getMetrics(metricsQuery);
    } catch (error) {
      logger.error('Failed to get campaign metrics', {
        campaignId,
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get metrics trends over time
   */
  async getMetricsTrends(
    campaignId?: number,
    startDate?: string,
    endDate?: string,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<{
    trends: PerformanceMetrics[];
    summary: {
      totalPeriods: number;
      growthRate: number;
      bestPerformingPeriod: PerformanceMetrics | null;
      worstPerformingPeriod: PerformanceMetrics | null;
    };
  }> {
    try {
      logger.debug('Getting metrics trends', {
        campaignId,
        startDate,
        endDate,
        groupBy
      });

      // Get the trending data
      const trends = await this.getMetrics({
        campaignId,
        startDate,
        endDate,
        groupBy,
        aggregateBy: 'sum'
      });

      // Calculate summary statistics
      const summary = this.calculateTrendsSummary(trends);

      logger.info('Retrieved metrics trends', {
        campaignId,
        trendsCount: trends.length,
        groupBy,
        growthRate: summary.growthRate
      });

      return { trends, summary };
    } catch (error) {
      logger.error('Failed to get metrics trends', {
        campaignId,
        startDate,
        endDate,
        groupBy,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get performance comparison between campaigns
   */
  async comparePerformance(
    campaignIds: number[],
    startDate?: string,
    endDate?: string,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<{
    campaigns: Array<{
      campaignId: number;
      metrics: PerformanceMetrics[];
      totals: PerformanceMetrics;
    }>;
    comparison: {
      topPerformer: { campaignId: number; metric: string; value: number };
      insights: string[];
    };
  }> {
    try {
      logger.debug('Comparing campaign performance', {
        campaignIds,
        startDate,
        endDate,
        groupBy
      });

      if (campaignIds.length === 0) {
        throw new BadRequestError('At least one campaign ID is required for comparison');
      }

      if (campaignIds.length > 10) {
        throw new BadRequestError('Cannot compare more than 10 campaigns at once');
      }

      // Get metrics for each campaign
      const campaigns = await Promise.all(
        campaignIds.map(async (campaignId) => {
          const metrics = await this.getCampaignMetrics(campaignId, {
            startDate,
            endDate,
            groupBy,
            aggregateBy: 'sum'
          });

          // Calculate totals
          const totals = this.calculateTotals(metrics);

          return {
            campaignId,
            metrics,
            totals
          };
        })
      );

      // Generate comparison insights
      const comparison = this.generateComparisonInsights(campaigns);

      logger.info('Completed performance comparison', {
        campaignCount: campaigns.length,
        topPerformer: comparison.topPerformer,
        insightsCount: comparison.insights.length
      });

      return { campaigns, comparison };
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }

      logger.error('Failed to compare performance', {
        campaignIds,
        startDate,
        endDate,
        groupBy,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get top performing periods
   */
  async getTopPerformingPeriods(
    metric: 'impressions' | 'clicks' | 'conversions' | 'revenue' | 'roas' = 'roas',
    limit: number = 10,
    campaignId?: number,
    startDate?: string,
    endDate?: string,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<PerformanceMetrics[]> {
    try {
      logger.debug('Getting top performing periods', {
        metric,
        limit,
        campaignId,
        startDate,
        endDate,
        groupBy
      });

      const metrics = await this.getMetrics({
        campaignId,
        startDate,
        endDate,
        groupBy,
        aggregateBy: 'sum'
      });

      // Sort by the specified metric and take top performers
      const sortedMetrics = metrics.sort((a, b) => {
        const aValue = this.getMetricValue(a, metric);
        const bValue = this.getMetricValue(b, metric);
        return bValue - aValue; // Descending order
      });

      const topPerformers = sortedMetrics.slice(0, limit);

      logger.info('Retrieved top performing periods', {
        metric,
        topPerformersCount: topPerformers.length,
        totalPeriods: metrics.length
      });

      return topPerformers;
    } catch (error) {
      logger.error('Failed to get top performing periods', {
        metric,
        limit,
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Calculate metrics aggregations
   */
  async getAggregatedMetrics(
    campaignIds?: number[],
    startDate?: string,
    endDate?: string
  ): Promise<{
    totals: PerformanceMetrics;
    averages: PerformanceMetrics;
    campaignCount: number;
  }> {
    try {
      logger.debug('Getting aggregated metrics', {
        campaignIds,
        startDate,
        endDate
      });

      let allMetrics: PerformanceMetrics[] = [];

      if (campaignIds && campaignIds.length > 0) {
        // Get metrics for specific campaigns
        const metricsPromises = campaignIds.map(campaignId =>
          this.getCampaignMetrics(campaignId, { startDate, endDate, aggregateBy: 'sum' })
        );
        const campaignMetrics = await Promise.all(metricsPromises);
        allMetrics = campaignMetrics.flat();
      } else {
        // Get metrics for all campaigns
        allMetrics = await this.getMetrics({ startDate, endDate, aggregateBy: 'sum' });
      }

      // Calculate totals and averages
      const totals = this.calculateTotals(allMetrics);
      const averages = this.calculateAverages(allMetrics);

      const uniqueCampaigns = new Set(
        campaignIds || allMetrics.map((_, index) => index) // Approximate unique campaigns
      ).size;

      logger.info('Calculated aggregated metrics', {
        totalRecords: allMetrics.length,
        campaignCount: uniqueCampaigns,
        totalRevenue: totals.revenue,
        avgRoas: averages.roas
      });

      return {
        totals,
        averages,
        campaignCount: uniqueCampaigns
      };
    } catch (error) {
      logger.error('Failed to get aggregated metrics', {
        campaignIds,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate date range
   */
  private validateDateRange(startDate?: string, endDate?: string): void {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        throw new BadRequestError('Start date must be before or equal to end date');
      }

      // Check for reasonable date range (not more than 2 years)
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 730) {
        throw new BadRequestError('Date range cannot exceed 2 years');
      }
    }
  }

  /**
   * Calculate trends summary
   */
  private calculateTrendsSummary(trends: PerformanceMetrics[]): {
    totalPeriods: number;
    growthRate: number;
    bestPerformingPeriod: PerformanceMetrics | null;
    worstPerformingPeriod: PerformanceMetrics | null;
  } {
    if (trends.length === 0) {
      return {
        totalPeriods: 0,
        growthRate: 0,
        bestPerformingPeriod: null,
        worstPerformingPeriod: null
      };
    }

    // Calculate growth rate based on revenue
    let growthRate = 0;
    if (trends.length > 1) {
      const firstPeriod = trends[0]?.revenue || 0;
      const lastPeriod = trends[trends.length - 1]?.revenue || 0;
      if (firstPeriod > 0) {
        growthRate = ((lastPeriod - firstPeriod) / firstPeriod) * 100;
      }
    }

    // Find best and worst performing periods (by ROAS)
    const sortedByRoas = [...trends].sort((a, b) => b.roas - a.roas);

    return {
      totalPeriods: trends.length,
      growthRate: Math.round(growthRate * 100) / 100,
      bestPerformingPeriod: sortedByRoas[0] || null,
      worstPerformingPeriod: sortedByRoas[sortedByRoas.length - 1] || null
    };
  }

  /**
   * Generate comparison insights
   */
  private generateComparisonInsights(campaigns: Array<{
    campaignId: number;
    metrics: PerformanceMetrics[];
    totals: PerformanceMetrics;
  }>): {
    topPerformer: { campaignId: number; metric: string; value: number };
    insights: string[];
  } {
    const insights: string[] = [];

    // Find top performer by ROAS
    let topPerformer = { campaignId: 0, metric: 'roas', value: 0 };
    for (const campaign of campaigns) {
      if (campaign.totals.roas > topPerformer.value) {
        topPerformer = {
          campaignId: campaign.campaignId,
          metric: 'roas',
          value: campaign.totals.roas
        };
      }
    }

    // Generate insights
    const avgRoas = campaigns.reduce((sum, c) => sum + c.totals.roas, 0) / campaigns.length;
    const totalSpend = campaigns.reduce((sum, c) => sum + c.totals.spend, 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + c.totals.revenue, 0);

    insights.push(`Overall ROAS across all campaigns: ${Math.round(avgRoas * 100) / 100}`);
    insights.push(`Total spend: $${Math.round(totalSpend * 100) / 100}`);
    insights.push(`Total revenue: $${Math.round(totalRevenue * 100) / 100}`);

    if (campaigns.length > 1) {
      const bestCampaign = campaigns.find(c => c.campaignId === topPerformer.campaignId);
      if (bestCampaign) {
        insights.push(`Campaign ${topPerformer.campaignId} has the highest ROAS at ${Math.round(topPerformer.value * 100) / 100}`);
      }
    }

    return { topPerformer, insights };
  }

  /**
   * Calculate totals from metrics array
   */
  private calculateTotals(metrics: PerformanceMetrics[]): PerformanceMetrics {
    if (metrics.length === 0) {
      return {
        period: 'total',
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        roas: 0
      };
    }

    const totals = metrics.reduce((acc, metric) => ({
      impressions: acc.impressions + metric.impressions,
      clicks: acc.clicks + metric.clicks,
      conversions: acc.conversions + metric.conversions,
      spend: acc.spend + metric.spend,
      revenue: acc.revenue + metric.revenue
    }), { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 });

    return {
      period: 'total',
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
      roas: totals.spend > 0 ? totals.revenue / totals.spend : 0
    };
  }

  /**
   * Calculate averages from metrics array
   */
  private calculateAverages(metrics: PerformanceMetrics[]): PerformanceMetrics {
    if (metrics.length === 0) {
      return this.calculateTotals(metrics);
    }

    const totals = this.calculateTotals(metrics);
    const count = metrics.length;

    return {
      period: 'average',
      impressions: Math.round(totals.impressions / count),
      clicks: Math.round(totals.clicks / count),
      conversions: Math.round(totals.conversions / count),
      spend: Math.round((totals.spend / count) * 100) / 100,
      revenue: Math.round((totals.revenue / count) * 100) / 100,
      ctr: Math.round((totals.ctr / count) * 100) / 100,
      cpc: Math.round((totals.cpc / count) * 100) / 100,
      cpm: Math.round((totals.cpm / count) * 100) / 100,
      roas: Math.round((totals.roas / count) * 100) / 100
    };
  }

  /**
   * Get metric value from performance metrics object
   */
  private getMetricValue(metrics: PerformanceMetrics, metric: string): number {
    switch (metric) {
      case 'impressions':
        return metrics.impressions;
      case 'clicks':
        return metrics.clicks;
      case 'conversions':
        return metrics.conversions;
      case 'revenue':
        return metrics.revenue;
      case 'roas':
        return metrics.roas;
      default:
        return 0;
    }
  }
}

// Create singleton instance
let metricsServiceInstance: MetricsService | null = null;

/**
 * Get the singleton metrics service instance
 */
export function getMetricsService(): MetricsService {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new MetricsService();
  }
  return metricsServiceInstance;
}

export default MetricsService;