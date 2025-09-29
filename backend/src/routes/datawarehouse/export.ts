/**
 * Data Warehouse Export & Reporting Routes
 * API endpoints for data export and custom report generation
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ErrorUtils } from '../../utils/errors.js';
import { DataWarehouseCampaignService, DataWarehouseMetricsService } from '../../services/dataWarehouseService.js';
import { ExportQuery, DataWarehouseMetricsQuery, DataWarehouseCampaignQuery } from '../../types/index.js';
import logger from '../../utils/logger.js';

const router = Router();

// Validation schemas
const ExportQuerySchema = z.object({
  format: z.enum(['csv', 'json']),
  campaignIds: z.string().transform((val) => {
    if (!val) return undefined;
    return val.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0);
  }).optional(),
  includeHierarchy: z.coerce.boolean().optional(),
  includeMetrics: z.coerce.boolean().optional(),
  aggregateMetrics: z.coerce.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  customFields: z.string().transform((val) => {
    if (!val) return undefined;
    return val.split(',').map(field => field.trim()).filter(field => field.length > 0);
  }).optional()
});

const CustomReportSchema = z.object({
  reportType: z.enum(['campaign_performance', 'network_analysis', 'conversion_funnel', 'time_series']),
  campaigns: z.array(z.number().int().min(1)).optional(),
  networks: z.array(z.string()).optional(),
  domains: z.array(z.string()).optional(),
  dateRange: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).optional(),
  metrics: z.array(z.enum([
    'sessions', 'registrations', 'messages', 'converted_users',
    'total_accounts', 'credit_cards', 'email_accounts'
  ])).optional(),
  format: z.enum(['json', 'csv']).optional(),
  includeCharts: z.boolean().optional()
});

// Validation middleware
const validateExportQuery = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedQuery = ExportQuerySchema.parse(req.query);
    req.query = validatedQuery as any;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        value: (err as any).input ?? 'unknown'
      }));

      res.error('Validation failed', 400, {
        code: 'VALIDATION_ERROR',
        errors: validationErrors
      });
      return;
    }
    next(error);
  }
};

const validateCustomReport = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedBody = CustomReportSchema.parse(req.body);
    req.body = validatedBody;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        value: (err as any).input ?? 'unknown'
      }));

      res.error('Validation failed', 400, {
        code: 'VALIDATION_ERROR',
        errors: validationErrors
      });
      return;
    }
    next(error);
  }
};

/**
 * GET /api/datawarehouse/export/csv
 * Export data as CSV format
 */
router.get('/csv', validateExportQuery, ErrorUtils.catchAsync(async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as ExportQuery;

  logger.info('Exporting data as CSV', {
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Get campaigns data
  const campaignQuery: DataWarehouseCampaignQuery = {
    ...(query.campaignIds && { campaignIds: query.campaignIds }),
    startDate: query.dateRange?.startDate,
    endDate: query.dateRange?.endDate,
    limit: 1000 // Set a reasonable limit for exports
  };

  const campaignsResult = await DataWarehouseCampaignService.getCampaigns(campaignQuery);
  const campaigns = campaignsResult.data;

  if (!campaigns || campaigns.length === 0) {
    res.error('No campaigns found for export', 404, { code: 'NO_DATA_FOUND' });
    return;
  }

  // Build CSV content
  const csvContent = await buildCsvContent(campaigns, query);

  // Set response headers for file download
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `datawarehouse_export_${timestamp}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  logger.info('CSV export completed', {
    filename,
    campaignCount: campaigns.length,
    includeMetrics: query.includeMetrics,
    includeHierarchy: query.includeHierarchy
  });

  res.send(csvContent);
}));

/**
 * GET /api/datawarehouse/export/json
 * Export data as JSON format
 */
router.get('/json', validateExportQuery, ErrorUtils.catchAsync(async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as ExportQuery;

  logger.info('Exporting data as JSON', {
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Get campaigns data
  const campaignQuery: DataWarehouseCampaignQuery = {
    ...(query.campaignIds && { campaignIds: query.campaignIds }),
    startDate: query.dateRange?.startDate,
    endDate: query.dateRange?.endDate,
    limit: 1000 // Set a reasonable limit for exports
  };

  const campaignsResult = await DataWarehouseCampaignService.getCampaigns(campaignQuery);
  const campaigns = campaignsResult.data;

  if (!campaigns || campaigns.length === 0) {
    res.error('No campaigns found for export', 404, { code: 'NO_DATA_FOUND' });
    return;
  }

  // Build export data structure
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      campaignCount: campaigns.length,
      dateRange: {
        startDate: query.dateRange?.startDate || null,
        endDate: query.dateRange?.endDate || null
      },
      includedFields: {
        hierarchy: query.includeHierarchy || false,
        metrics: query.includeMetrics || false,
        aggregatedMetrics: query.aggregateMetrics || false
      }
    },
    campaigns: campaigns.map(campaign => {
      const exportCampaign: any = {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        is_serving: campaign.is_serving,
        traffic_weight: campaign.traffic_weight,
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
        sync_timestamp: campaign.sync_timestamp
      };

      if (query.includeHierarchy && campaign.hierarchy) {
        exportCampaign.hierarchy = campaign.hierarchy;
      }

      if (query.includeMetrics && campaign.metrics) {
        exportCampaign.metrics = campaign.metrics;
      }

      return exportCampaign;
    })
  };

  // Set response headers for file download
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `datawarehouse_export_${timestamp}.json`;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  logger.info('JSON export completed', {
    filename,
    campaignCount: campaigns.length,
    includeMetrics: query.includeMetrics,
    includeHierarchy: query.includeHierarchy
  });

  res.json(exportData);
}));

/**
 * POST /api/datawarehouse/export/custom
 * Generate custom reports with advanced filtering and analytics
 */
router.post('/custom', validateCustomReport, ErrorUtils.catchAsync(async (req: Request, res: Response): Promise<void> => {
  const reportConfig = req.body;

  logger.info('Generating custom report', {
    reportType: reportConfig.reportType,
    dateRange: reportConfig.dateRange,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  let reportData: any = {};

  switch (reportConfig.reportType) {
    case 'campaign_performance':
      reportData = await generateCampaignPerformanceReport(reportConfig);
      break;

    case 'network_analysis':
      reportData = await generateNetworkAnalysisReport(reportConfig);
      break;

    case 'conversion_funnel':
      reportData = await generateConversionFunnelReport(reportConfig);
      break;

    case 'time_series':
      reportData = await generateTimeSeriesReport(reportConfig);
      break;

    default:
      res.error('Unsupported report type', 400, { code: 'INVALID_REPORT_TYPE' });
      return;
  }

  const report = {
    metadata: {
      reportType: reportConfig.reportType,
      generatedAt: new Date().toISOString(),
      dateRange: reportConfig.dateRange,
      parameters: reportConfig
    },
    data: reportData
  };

  if (reportConfig.format === 'csv') {
    const csvContent = await convertReportToCsv(report);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${reportConfig.reportType}_report_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } else {
    res.success(report, 'Custom report generated successfully');
  }

  logger.info('Custom report generated', {
    reportType: reportConfig.reportType,
    format: reportConfig.format || 'json',
    dataPoints: Array.isArray(reportData) ? reportData.length : Object.keys(reportData).length
  });
}));

/**
 * Helper function to build CSV content from campaigns data
 */
async function buildCsvContent(campaigns: any[], query: ExportQuery): Promise<string> {
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

  if (query.includeHierarchy) {
    headers.push('Network', 'Domain', 'Placement', 'Targeting', 'Special', 'Mapping Confidence');
  }

  if (query.includeMetrics) {
    headers.push(
      'Total Sessions',
      'Total Registrations',
      'Total Messages',
      'Total Converted Users',
      'Total Accounts',
      'Registration Rate',
      'Conversion Rate',
      'Message Rate',
      'Data Point Count'
    );
  }

  const rows = campaigns.map(campaign => {
    const row = [
      campaign.id,
      `"${campaign.name}"`,
      `"${campaign.description || ''}"`,
      campaign.is_serving,
      campaign.traffic_weight,
      campaign.created_at,
      campaign.updated_at,
      campaign.sync_timestamp
    ];

    if (query.includeHierarchy) {
      if (campaign.hierarchy) {
        row.push(
          `"${campaign.hierarchy.network}"`,
          `"${campaign.hierarchy.domain}"`,
          `"${campaign.hierarchy.placement}"`,
          `"${campaign.hierarchy.targeting}"`,
          `"${campaign.hierarchy.special}"`,
          campaign.hierarchy.mapping_confidence
        );
      } else {
        row.push('', '', '', '', '', '');
      }
    }

    if (query.includeMetrics && campaign.metrics) {
      row.push(
        campaign.metrics.totalSessions,
        campaign.metrics.totalRegistrations,
        campaign.metrics.totalMessages,
        campaign.metrics.totalConvertedUsers,
        campaign.metrics.totalAccounts,
        Math.round(campaign.metrics.registrationRate * 100) / 100,
        Math.round(campaign.metrics.conversionRate * 100) / 100,
        Math.round(campaign.metrics.messageRate * 100) / 100,
        campaign.metrics.dataPointCount
      );
    }

    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generate campaign performance report
 */
async function generateCampaignPerformanceReport(config: any) {
  const metricsQuery: DataWarehouseMetricsQuery = {
    campaignIds: config.campaigns,
    startDate: config.dateRange.startDate,
    endDate: config.dateRange.endDate
  };

  const performanceData = await DataWarehouseMetricsService.getPerformanceKPIs(metricsQuery);
  return performanceData;
}

/**
 * Generate network analysis report
 */
async function generateNetworkAnalysisReport(config: any) {
  const metricsQuery: DataWarehouseMetricsQuery = {
    startDate: config.dateRange.startDate,
    endDate: config.dateRange.endDate
  };

  const performanceData = await DataWarehouseMetricsService.getPerformanceKPIs(metricsQuery);

  return {
    networkSummary: performanceData.overallKPIs.topNetworks,
    topPerformers: performanceData.topPerformers.filter(performer =>
      !config.networks || config.networks.includes(performer.hierarchy?.network)
    )
  };
}

/**
 * Generate conversion funnel report
 */
async function generateConversionFunnelReport(config: any) {
  const metricsQuery: DataWarehouseMetricsQuery = {
    campaignIds: config.campaigns,
    startDate: config.dateRange.startDate,
    endDate: config.dateRange.endDate
  };

  const aggregatedData = await DataWarehouseMetricsService.getAggregatedMetrics(metricsQuery);

  const funnelSteps = [
    { step: 'Sessions', value: aggregatedData.totalSessions },
    { step: 'Accounts Created', value: aggregatedData.totalAccounts },
    { step: 'Registrations', value: aggregatedData.totalRegistrations },
    { step: 'Messages Sent', value: aggregatedData.totalMessages },
    { step: 'Conversions', value: aggregatedData.totalConvertedUsers }
  ];

  // Calculate conversion rates between steps
  const conversionRates = funnelSteps.map((step, index) => {
    if (index === 0) return { ...step, conversionRate: 100 };

    const previousValue = funnelSteps[index - 1]?.value || 0;
    const conversionRate = previousValue > 0 ? (step.value / previousValue) * 100 : 0;

    return { ...step, conversionRate: Math.round(conversionRate * 100) / 100 };
  });

  return {
    funnelSteps: conversionRates,
    summary: {
      totalSessions: aggregatedData.totalSessions,
      overallConversionRate: aggregatedData.avgConversionRate,
      dropoffPoints: identifyDropoffPoints(conversionRates)
    }
  };
}

/**
 * Generate time series report
 */
async function generateTimeSeriesReport(config: any) {
  const metricsQuery: DataWarehouseMetricsQuery = {
    campaignIds: config.campaigns,
    startDate: config.dateRange.startDate,
    endDate: config.dateRange.endDate,
    groupBy: config.groupBy || 'day'
  };

  const timeSeriesData = await DataWarehouseMetricsService.getHourlyMetrics(metricsQuery);

  return {
    timeSeriesData: timeSeriesData.map(point => ({
      period: point.hour_date,
      ...point.metrics
    })),
    trends: calculateTrends(timeSeriesData),
    periodicity: config.groupBy || 'day'
  };
}

/**
 * Helper function to identify dropoff points in conversion funnel
 */
function identifyDropoffPoints(funnelSteps: any[]): string[] {
  const dropoffs: string[] = [];

  for (let i = 1; i < funnelSteps.length; i++) {
    const currentRate = funnelSteps[i].conversionRate;
    const previousRate = funnelSteps[i - 1].conversionRate;

    // Identify significant dropoffs (>20% decrease)
    if (currentRate < previousRate * 0.8) {
      dropoffs.push(`High dropoff from ${funnelSteps[i - 1].step} to ${funnelSteps[i].step} (${Math.round((previousRate - currentRate) * 100) / 100}% decrease)`);
    }
  }

  return dropoffs.length > 0 ? dropoffs : ['No significant dropoff points identified'];
}

/**
 * Helper function to calculate trends in time series data
 */
function calculateTrends(timeSeriesData: any[]): any {
  if (timeSeriesData.length < 2) {
    return { trend: 'insufficient_data', direction: 'stable' };
  }

  if (timeSeriesData.length === 0) {
    return { trend: 'no_data', direction: 'stable', metrics: { sessionsChange: 0, registrationsChange: 0, overallTrend: 'neutral' } };
  }

  const firstPoint = timeSeriesData[0];
  const lastPoint = timeSeriesData[timeSeriesData.length - 1];

  if (!firstPoint || !lastPoint) {
    return { trend: 'no_data', direction: 'stable', metrics: { sessionsChange: 0, registrationsChange: 0, overallTrend: 'neutral' } };
  }

  const sessionsTrend = lastPoint.metrics.sessions - firstPoint.metrics.sessions;
  const registrationsTrend = lastPoint.metrics.registrations - firstPoint.metrics.registrations;

  return {
    trend: 'calculated',
    direction: sessionsTrend > 0 ? 'increasing' : sessionsTrend < 0 ? 'decreasing' : 'stable',
    metrics: {
      sessionsChange: sessionsTrend,
      registrationsChange: registrationsTrend,
      overallTrend: sessionsTrend > 0 ? 'positive' : sessionsTrend < 0 ? 'negative' : 'neutral'
    }
  };
}

/**
 * Helper function to convert report data to CSV format
 */
async function convertReportToCsv(report: any): Promise<string> {
  // This is a simplified CSV conversion - could be enhanced based on report type
  const headers = Object.keys(report.data);
  let csvContent = headers.join(',') + '\n';

  // Add basic conversion logic - would need enhancement for complex nested data
  if (Array.isArray(report.data)) {
    report.data.forEach((item: any) => {
      const values = Object.values(item).map(value =>
        typeof value === 'string' ? `"${value}"` : value
      );
      csvContent += values.join(',') + '\n';
    });
  }

  return csvContent;
}

export default router;