/**
 * Request validation middleware using Zod
 * Provides type-safe request validation with detailed error messages
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { RequestValidationError } from '../utils/errors.js';

/**
 * Validation middleware factory
 */
export function validateRequest(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query parameters
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }

      // Validate URL parameters
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = RequestValidationError.fromZodError(error);
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

/**
 * Common validation schemas
 */
export const ValidationSchemas = {
  // Pagination schemas
  pagination: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1)
      .refine(val => val > 0, { message: 'Page must be greater than 0' }),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20)
      .refine(val => val > 0 && val <= 100, { message: 'Limit must be between 1 and 100' })
  }),

  // Date range schemas
  dateRange: z.object({
    startDate: z.string().optional()
      .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid start date format' }),
    endDate: z.string().optional()
      .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid end date format' })
  }).refine(
    data => !data.startDate || !data.endDate || new Date(data.startDate) <= new Date(data.endDate),
    { message: 'Start date must be before or equal to end date' }
  ),

  // ID parameter schema
  idParam: z.object({
    id: z.string().transform(val => parseInt(val, 10))
      .refine(val => !isNaN(val) && val > 0, { message: 'ID must be a positive integer' })
  }),

  // Campaign query schema
  campaignQuery: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1)
      .refine(val => val > 0, { message: 'Page must be greater than 0' }),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20)
      .refine(val => val > 0 && val <= 100, { message: 'Limit must be between 1 and 100' }),
    status: z.string().optional()
      .refine(val => !val || ['active', 'paused', 'deleted'].includes(val.toLowerCase()),
        { message: 'Status must be one of: active, paused, deleted' }),
    organizationId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined)
      .refine(val => val === undefined || (!isNaN(val) && val > 0),
        { message: 'Organization ID must be a positive integer' }),
    programId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined)
      .refine(val => val === undefined || (!isNaN(val) && val > 0),
        { message: 'Program ID must be a positive integer' }),
    startDate: z.string().optional()
      .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid start date format' }),
    endDate: z.string().optional()
      .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid end date format' })
  }).refine(
    data => !data.startDate || !data.endDate || new Date(data.startDate) <= new Date(data.endDate),
    { message: 'Start date must be before or equal to end date' }
  ),

  // Metrics query schema
  metricsQuery: z.object({
    campaignId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined)
      .refine(val => val === undefined || (!isNaN(val) && val > 0),
        { message: 'Campaign ID must be a positive integer' }),
    startDate: z.string().optional()
      .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid start date format' }),
    endDate: z.string().optional()
      .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid end date format' }),
    groupBy: z.string().optional()
      .refine(val => !val || ['hour', 'day', 'week', 'month'].includes(val),
        { message: 'GroupBy must be one of: hour, day, week, month' }),
    aggregateBy: z.string().optional()
      .refine(val => !val || ['sum', 'avg', 'min', 'max'].includes(val),
        { message: 'AggregateBy must be one of: sum, avg, min, max' })
  }).refine(
    data => !data.startDate || !data.endDate || new Date(data.startDate) <= new Date(data.endDate),
    { message: 'Start date must be before or equal to end date' }
  ),

  // Export options schema
  exportOptions: z.object({
    format: z.enum(['csv', 'json', 'xlsx'], {
      errorMap: () => ({ message: 'Format must be one of: csv, json, xlsx' })
    }),
    includeMetrics: z.string().optional().transform(val => val === 'true')
      .or(z.boolean().optional()),
    campaignIds: z.string().optional()
      .transform(val => val ? val.split(',').map(id => parseInt(id.trim(), 10)) : undefined)
      .refine(val => !val || val.every(id => !isNaN(id) && id > 0),
        { message: 'Campaign IDs must be positive integers' }),
    startDate: z.string().optional()
      .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid start date format' }),
    endDate: z.string().optional()
      .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid end date format' })
  }).refine(
    data => !data.startDate || !data.endDate || new Date(data.startDate) <= new Date(data.endDate),
    { message: 'Start date must be before or equal to end date' }
  )
};

/**
 * Middleware to sanitize query parameters
 */
export function sanitizeQuery(req: Request, _res: Response, next: NextFunction): void {
  // Remove empty string values and convert to appropriate types
  for (const [key, value] of Object.entries(req.query)) {
    if (value === '' || value === null || value === undefined) {
      delete req.query[key];
    } else if (typeof value === 'string') {
      // Trim whitespace
      req.query[key] = value.trim();
    }
  }

  next();
}

/**
 * Middleware to validate content type for POST/PUT requests
 */
export function validateContentType(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');

    if (!contentType || !contentType.includes('application/json')) {
      res.status(400).json({
        success: false,
        error: 'Invalid Content-Type',
        message: 'Content-Type must be application/json',
        timestamp: new Date().toISOString()
      });
      return;
    }
  }

  next();
}

/**
 * Create validation middleware for specific endpoints
 */
export const validate = {
  // Campaign endpoints
  getCampaigns: validateRequest({
    query: ValidationSchemas.campaignQuery
  }),

  getCampaignById: validateRequest({
    params: ValidationSchemas.idParam
  }),

  getCampaignSummary: validateRequest({
    params: ValidationSchemas.idParam,
    query: ValidationSchemas.dateRange
  }),

  // Metrics endpoints
  getMetrics: validateRequest({
    query: ValidationSchemas.metricsQuery
  }),

  getCampaignMetrics: validateRequest({
    params: ValidationSchemas.idParam,
    query: ValidationSchemas.metricsQuery
  }),

  // Organization endpoints
  getPrograms: validateRequest({
    params: ValidationSchemas.idParam
  }),

  // Ad Set endpoints
  getAdSets: validateRequest({
    params: ValidationSchemas.idParam
  }),

  // Ad endpoints
  getAds: validateRequest({
    params: ValidationSchemas.idParam
  }),

  // Export endpoints
  exportData: validateRequest({
    query: ValidationSchemas.exportOptions
  })
};

export default {
  validateRequest,
  ValidationSchemas,
  sanitizeQuery,
  validateContentType,
  validate
};