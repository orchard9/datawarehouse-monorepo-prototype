/**
 * Campaign service layer
 * Provides business logic for campaign-related operations
 */

import { getQueries } from '../database/queries.js';
import logger from '../utils/logger.js';
import { ErrorUtils, NotFoundError } from '../utils/errors.js';
import {
  Campaign,
  CampaignQuery,
  CampaignSummary,
  AdSet,
  Ad,
  PaginationMeta
} from '../types/index.js';

/**
 * Campaign service class
 */
export class CampaignService {
  private queries = getQueries();

  /**
   * Get campaigns with filtering and pagination
   */
  async getCampaigns(query: CampaignQuery = {}): Promise<{ campaigns: Campaign[]; meta: PaginationMeta }> {
    try {
      logger.debug('Getting campaigns', { query });

      const result = this.queries.getCampaigns(query);

      logger.info('Retrieved campaigns', {
        count: result.campaigns.length,
        totalCount: result.meta.total,
        page: result.meta.page
      });

      return result;
    } catch (error) {
      logger.error('Failed to get campaigns', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorUtils.handleDatabaseError(error, 'getCampaigns');
    }
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(id: number): Promise<Campaign> {
    try {
      logger.debug('Getting campaign by ID', { id });

      const campaign = this.queries.getCampaignById(id);
      ErrorUtils.assertFound(campaign, `Campaign with ID ${id} not found`);

      logger.info('Retrieved campaign', { id, name: campaign!.name });

      return campaign!;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to get campaign by ID', {
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorUtils.handleDatabaseError(error, 'getCampaignById');
    }
  }

  /**
   * Get campaign summary with aggregated metrics
   */
  async getCampaignSummary(
    id: number,
    startDate?: string,
    endDate?: string
  ): Promise<CampaignSummary> {
    try {
      logger.debug('Getting campaign summary', { id, startDate, endDate });

      const summary = this.queries.getCampaignSummary(id, startDate, endDate);
      ErrorUtils.assertFound(summary, `Campaign with ID ${id} not found`);

      logger.info('Retrieved campaign summary', {
        id,
        campaignName: summary!.campaign.name,
        totalImpressions: summary!.metrics.totalImpressions,
        totalSpend: summary!.metrics.totalSpend,
        dateRange: summary!.dateRange
      });

      return summary!;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to get campaign summary', {
        id,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorUtils.handleDatabaseError(error, 'getCampaignSummary');
    }
  }

  /**
   * Get ad sets for a campaign
   */
  async getAdSetsByCampaign(campaignId: number): Promise<AdSet[]> {
    try {
      // First verify campaign exists
      await this.getCampaignById(campaignId);

      logger.debug('Getting ad sets for campaign', { campaignId });

      const adSets = this.queries.getAdSetsByCampaign(campaignId);

      logger.info('Retrieved ad sets', {
        campaignId,
        count: adSets.length
      });

      return adSets;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to get ad sets', {
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorUtils.handleDatabaseError(error, 'getAdSetsByCampaign');
    }
  }

  /**
   * Get ads for an ad set
   */
  async getAdsByAdSet(adSetId: number): Promise<Ad[]> {
    try {
      logger.debug('Getting ads for ad set', { adSetId });

      const ads = this.queries.getAdsByAdSet(adSetId);

      logger.info('Retrieved ads', {
        adSetId,
        count: ads.length
      });

      return ads;
    } catch (error) {
      logger.error('Failed to get ads', {
        adSetId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorUtils.handleDatabaseError(error, 'getAdsByAdSet');
    }
  }

  /**
   * Get campaign hierarchy (campaign with ad sets and ads)
   */
  async getCampaignHierarchy(campaignId: number): Promise<{
    campaign: Campaign;
    adSets: Array<AdSet & { ads: Ad[] }>;
  }> {
    try {
      logger.debug('Getting campaign hierarchy', { campaignId });

      // Get campaign
      const campaign = await this.getCampaignById(campaignId);

      // Get ad sets
      const adSets = await this.getAdSetsByCampaign(campaignId);

      // Get ads for each ad set
      const adSetsWithAds = await Promise.all(
        adSets.map(async (adSet) => {
          const ads = await this.getAdsByAdSet(adSet.id);
          return { ...adSet, ads };
        })
      );

      logger.info('Retrieved campaign hierarchy', {
        campaignId,
        adSetsCount: adSetsWithAds.length,
        totalAds: adSetsWithAds.reduce((sum, adSet) => sum + adSet.ads.length, 0)
      });

      return {
        campaign,
        adSets: adSetsWithAds
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to get campaign hierarchy', {
        campaignId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorUtils.handleDatabaseError(error, 'getCampaignHierarchy');
    }
  }

  /**
   * Search campaigns by name
   */
  async searchCampaigns(searchTerm: string, limit: number = 10): Promise<Campaign[]> {
    try {
      logger.debug('Searching campaigns', { searchTerm, limit });

      // Use the existing getCampaigns method with a filter
      // Note: This is a simple implementation. For better performance,
      // you might want to add a dedicated search method to the queries class
      const { campaigns } = this.queries.getCampaigns({ limit: 100 }); // Get more to filter

      const filteredCampaigns = campaigns
        .filter(campaign =>
          campaign.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice(0, limit);

      logger.info('Search completed', {
        searchTerm,
        resultsCount: filteredCampaigns.length
      });

      return filteredCampaigns;
    } catch (error) {
      logger.error('Failed to search campaigns', {
        searchTerm,
        limit,
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorUtils.handleDatabaseError(error, 'searchCampaigns');
    }
  }

  /**
   * Get campaign performance ranking
   */
  async getCampaignPerformanceRanking(
    metric: 'impressions' | 'clicks' | 'conversions' | 'spend' | 'revenue' | 'roas' = 'roas',
    limit: number = 10,
    startDate?: string,
    endDate?: string
  ): Promise<CampaignSummary[]> {
    try {
      logger.debug('Getting campaign performance ranking', {
        metric,
        limit,
        startDate,
        endDate
      });

      // Get all campaigns first
      const { campaigns } = this.queries.getCampaigns({ limit: 1000 }); // Get all campaigns

      // Get summaries for each campaign
      const summaries = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            return this.queries.getCampaignSummary(campaign.id, startDate, endDate);
          } catch (error) {
            // If campaign has no metrics, return null
            return null;
          }
        })
      );

      // Filter out null summaries and sort by the specified metric
      const validSummaries = summaries.filter((summary): summary is CampaignSummary =>
        summary !== null && summary.metrics.totalImpressions > 0
      );

      const sortedSummaries = validSummaries.sort((a, b) => {
        const aValue = this.getMetricValue(a, metric);
        const bValue = this.getMetricValue(b, metric);
        return bValue - aValue; // Descending order
      });

      const topPerformers = sortedSummaries.slice(0, limit);

      logger.info('Retrieved campaign performance ranking', {
        metric,
        totalCampaigns: validSummaries.length,
        topPerformersCount: topPerformers.length
      });

      return topPerformers;
    } catch (error) {
      logger.error('Failed to get campaign performance ranking', {
        metric,
        limit,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorUtils.handleDatabaseError(error, 'getCampaignPerformanceRanking');
    }
  }

  /**
   * Helper method to get metric value from campaign summary
   */
  private getMetricValue(summary: CampaignSummary, metric: string): number {
    switch (metric) {
      case 'impressions':
        return summary.metrics.totalImpressions;
      case 'clicks':
        return summary.metrics.totalClicks;
      case 'conversions':
        return summary.metrics.totalConversions;
      case 'spend':
        return summary.metrics.totalSpend;
      case 'revenue':
        return summary.metrics.totalRevenue;
      case 'roas':
        return summary.metrics.avgRoas;
      default:
        return 0;
    }
  }
}

// Create singleton instance
let campaignServiceInstance: CampaignService | null = null;

/**
 * Get the singleton campaign service instance
 */
export function getCampaignService(): CampaignService {
  if (!campaignServiceInstance) {
    campaignServiceInstance = new CampaignService();
  }
  return campaignServiceInstance;
}

export default CampaignService;