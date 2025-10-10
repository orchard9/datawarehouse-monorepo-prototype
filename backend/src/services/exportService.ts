/**
 * Export Service
 * Handles data export operations and format conversions
 */

import { getDataWarehouseDatabase } from '../database/datawarehouseConnection.js';
import {
  DataWarehouseCampaignWithMetrics,
  ExportHistory,
  ExportQuery
} from '../types/index.js';
import { ErrorUtils } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Data export service for various formats and custom reports
 */
export class ExportService {
  /**
   * Create CSV content from campaign data
   */
  static async createCsvExport(
    campaigns: DataWarehouseCampaignWithMetrics[],
    options: ExportQuery
  ): Promise<string> {
    try {
      const headers = this.buildCsvHeaders(options);
      const rows = campaigns.map(campaign => this.buildCsvRow(campaign, options));

      const csvContent = [headers.join(','), ...rows].join('\n');

      logger.info('CSV export created', {
        campaignCount: campaigns.length,
        includeMetrics: options.includeMetrics,
        includeHierarchy: options.includeHierarchy
      });

      return csvContent;

    } catch (error) {
      logger.error('Failed to create CSV export', {
        error: error instanceof Error ? error.message : String(error),
        campaignCount: campaigns.length
      });
      throw error;
    }
  }

  /**
   * Create JSON export from campaign data
   */
  static async createJsonExport(
    campaigns: DataWarehouseCampaignWithMetrics[],
    options: ExportQuery
  ): Promise<any> {
    try {
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          campaignCount: campaigns.length,
          dateRange: options.dateRange || null,
          includedFields: {
            hierarchy: options.includeHierarchy || false,
            metrics: options.includeMetrics || false,
            aggregatedMetrics: options.aggregateMetrics || false
          },
          customFields: options.customFields || []
        },
        campaigns: campaigns.map(campaign => this.filterCampaignFields(campaign, options))
      };

      logger.info('JSON export created', {
        campaignCount: campaigns.length,
        includeMetrics: options.includeMetrics,
        includeHierarchy: options.includeHierarchy
      });

      return exportData;

    } catch (error) {
      logger.error('Failed to create JSON export', {
        error: error instanceof Error ? error.message : String(error),
        campaignCount: campaigns.length
      });
      throw error;
    }
  }

  /**
   * Log export operation to history
   */
  static async logExportOperation(
    exportType: 'csv' | 'json' | 'custom',
    config: any,
    recordsExported: number,
    status: 'completed' | 'failed',
    errorMessage?: string,
    filePath?: string
  ): Promise<void> {
    const db = getDataWarehouseDatabase();

    try {
      const sql = `
        INSERT INTO export_history (
          export_type,
          export_config,
          file_path,
          records_exported,
          status,
          error_message,
          created_at,
          completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const now = new Date().toISOString();
      const params = [
        exportType,
        JSON.stringify(config),
        filePath || null,
        recordsExported,
        status,
        errorMessage || null,
        now,
        status === 'completed' ? now : null
      ];

      db.executeQuery(sql, params);

      logger.info('Export operation logged', {
        exportType,
        recordsExported,
        status
      });

    } catch (error) {
      logger.error('Failed to log export operation', {
        error: error instanceof Error ? error.message : String(error),
        exportType,
        recordsExported
      });
      // Don't throw here as this is logging only
    }
  }

  /**
   * Build CSV headers based on export options
   */
  private static buildCsvHeaders(options: ExportQuery): string[] {
    const headers = [
      'Campaign ID',
      'Campaign Name',
      'Description',
      'Is Serving',
      'Traffic Weight',
      'Created At',
      'Updated At',
      'Sync Timestamp'
    ];

    if (options.includeHierarchy) {
      headers.push(
        'Network',
        'Domain',
        'Placement',
        'Targeting',
        'Special',
        'Mapping Confidence'
      );
    }

    if (options.includeMetrics) {
      headers.push(
        'Total Sessions',
        'Total Registrations',
        'Total Messages',
        'Total Converted Users',
        'Total Accounts',
        'Registration Rate (%)',
        'Conversion Rate (%)',
        'Message Rate (%)',
        'Data Point Count',
        'Last Activity Date'
      );
    }

    // Add custom fields if specified
    if (options.customFields) {
      headers.push(...options.customFields);
    }

    return headers;
  }

  /**
   * Build CSV row for a campaign
   */
  private static buildCsvRow(
    campaign: DataWarehouseCampaignWithMetrics,
    options: ExportQuery
  ): string {
    const row: any[] = [
      campaign.id,
      this.escapeCsvValue(campaign.name),
      this.escapeCsvValue(campaign.description || ''),
      campaign.is_serving ? 'Yes' : 'No',
      campaign.traffic_weight,
      campaign.created_at,
      campaign.updated_at,
      campaign.sync_timestamp
    ];

    if (options.includeHierarchy) {
      if (campaign.hierarchy) {
        row.push(
          this.escapeCsvValue(campaign.hierarchy.network),
          this.escapeCsvValue(campaign.hierarchy.domain),
          this.escapeCsvValue(campaign.hierarchy.placement),
          this.escapeCsvValue(campaign.hierarchy.targeting),
          this.escapeCsvValue(campaign.hierarchy.special),
          campaign.hierarchy.mapping_confidence
        );
      } else {
        row.push('', '', '', '', '', '');
      }
    }

    if (options.includeMetrics && campaign.metrics) {
      row.push(
        campaign.metrics.totalSessions,
        campaign.metrics.totalRegistrations,
        campaign.metrics.totalMessages,
        campaign.metrics.totalConvertedUsers,
        campaign.metrics.totalAccounts,
        Math.round(campaign.metrics.registrationRate * 100) / 100,
        Math.round(campaign.metrics.conversionRate * 100) / 100,
        Math.round(campaign.metrics.messageRate * 100) / 100,
        campaign.metrics.dataPointCount,
        campaign.metrics.lastActivityDate || ''
      );
    }

    // Add custom fields (would need implementation based on requirements)
    if (options.customFields) {
      options.customFields.forEach(() => {
        row.push(''); // Placeholder for custom fields
      });
    }

    return row.join(',');
  }

  /**
   * Filter campaign fields based on export options
   */
  private static filterCampaignFields(
    campaign: DataWarehouseCampaignWithMetrics,
    options: ExportQuery
  ): any {
    const filtered: any = {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      is_serving: campaign.is_serving,
      traffic_weight: campaign.traffic_weight,
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
      sync_timestamp: campaign.sync_timestamp
    };

    if (options.includeHierarchy && campaign.hierarchy) {
      filtered.hierarchy = campaign.hierarchy;
    }

    if (options.includeMetrics && campaign.metrics) {
      filtered.metrics = campaign.metrics;
    }

    // Add custom fields if specified
    if (options.customFields) {
      filtered.customFields = {}; // Placeholder for custom field values
    }

    return filtered;
  }

  /**
   * Escape CSV values to handle quotes and commas
   */
  private static escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Generate filename for export
   */
  static generateExportFilename(type: 'csv' | 'json', prefix: string = 'datawarehouse_export'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}_${timestamp}.${type}`;
  }

  /**
   * Get export history
   */
  static async getExportHistory(limit: number = 50): Promise<ExportHistory[]> {
    const db = getDataWarehouseDatabase();

    try {
      const sql = `
        SELECT *
        FROM export_history
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const history = db.executeQuery<ExportHistory>(sql, [limit]);

      logger.info('Retrieved export history', { count: history.length });

      return history;

    } catch (error) {
      logger.error('Failed to get export history', {
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'getExportHistory');
      throw error;
    }
  }

  /**
   * Clean up old export records
   */
  static async cleanupOldExports(daysToKeep: number = 30): Promise<number> {
    const db = getDataWarehouseDatabase();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const sql = `
        DELETE FROM export_history
        WHERE created_at < ?
      `;

      const result = db.executeQuery(sql, [cutoffDate.toISOString()]);
      const deletedCount = (result as any).changes || 0;

      logger.info('Cleaned up old export records', {
        deletedCount,
        cutoffDate: cutoffDate.toISOString()
      });

      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup old exports', {
        error: error instanceof Error ? error.message : String(error)
      });
      ErrorUtils.handleDatabaseError(error, 'cleanupOldExports');
      throw error;
    }
  }

  /**
   * Validate export configuration
   */
  static validateExportConfig(config: ExportQuery): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate format
    if (!['csv', 'json'].includes(config.format)) {
      errors.push('Invalid format. Must be "csv" or "json".');
    }

    // Validate campaign IDs if provided
    if (config.campaignIds && config.campaignIds.length === 0) {
      errors.push('Campaign IDs array cannot be empty when provided.');
    }

    // Validate date range
    if (config.dateRange) {
      if (config.dateRange.startDate && config.dateRange.endDate) {
        const start = new Date(config.dateRange.startDate);
        const end = new Date(config.dateRange.endDate);

        if (start >= end) {
          errors.push('Start date must be before end date.');
        }

        // Check for reasonable date range (not more than 2 years)
        const maxRange = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
        if (end.getTime() - start.getTime() > maxRange) {
          errors.push('Date range cannot exceed 2 years.');
        }
      }
    }

    // Validate custom fields
    if (config.customFields && config.customFields.length > 20) {
      errors.push('Cannot specify more than 20 custom fields.');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default ExportService;