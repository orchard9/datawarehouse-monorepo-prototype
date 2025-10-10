/**
 * Configuration management for Orchard9 Data Warehouse Backend
 * Handles environment variables with proper typing and validation
 */

import { config } from 'dotenv';
import path from 'path';
import { AppConfig } from '../types/index.js';

// Load environment variables from .env file
config();

/**
 * Validates and returns the application configuration
 * @returns {AppConfig} Validated configuration object
 */
function getConfig(): AppConfig {

  // Helper function to parse number values
  const parseNumber = (value: string | undefined, defaultValue: number): number => {
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  // Helper function to parse array values
  const parseArray = (value: string | undefined): string[] | undefined => {
    if (!value) return undefined;
    return value.split(',').map(item => item.trim()).filter(Boolean);
  };

  // Helper function to parse CORS origin
  const parseCorsOrigin = (value: string | undefined): string | string[] | boolean => {
    if (!value) return true; // Allow all origins in development
    if (value.toLowerCase() === 'false') return false;
    if (value.toLowerCase() === 'true') return true;
    if (value.includes(',')) return parseArray(value) || [];
    return value;
  };

  // Get database path - default to the datawarehouse-job directory
  const getDatabasePath = (): string => {
    const envPath = process.env.DATABASE_PATH;
    if (envPath) return envPath;

    // Default to the sibling datawarehouse-job directory
    return path.resolve(process.cwd(), '..', 'datawarehouse-job', 'datawarehouse.db');
  };

  const config: AppConfig = {
    port: parseNumber(process.env.PORT, 37951),
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development',
    databasePath: getDatabasePath(),
    logLevel: (process.env.LOG_LEVEL as AppConfig['logLevel']) || 'info',
    corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
    rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000), // 15 minutes
    rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 100), // 100 requests per window
  };

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Validates the configuration object
 * @param {AppConfig} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}. Must be between 1 and 65535.`);
  }

  // Validate node environment
  const validNodeEnvs = ['development', 'production', 'test'];
  if (!validNodeEnvs.includes(config.nodeEnv)) {
    errors.push(`Invalid NODE_ENV: ${config.nodeEnv}. Must be one of: ${validNodeEnvs.join(', ')}.`);
  }

  // Validate log level
  const validLogLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
  if (!validLogLevels.includes(config.logLevel)) {
    errors.push(`Invalid LOG_LEVEL: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}.`);
  }

  // Validate database path
  if (!config.databasePath || config.databasePath.trim() === '') {
    errors.push('Database path is required.');
  }

  // Validate rate limiting
  if (config.rateLimitWindowMs < 1000) {
    errors.push('Rate limit window must be at least 1000ms (1 second).');
  }

  if (config.rateLimitMax < 1) {
    errors.push('Rate limit max must be at least 1.');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Returns whether the application is in development mode
 */
export const isDevelopment = (): boolean => {
  return getConfig().nodeEnv === 'development';
};

/**
 * Returns whether the application is in production mode
 */
export const isProduction = (): boolean => {
  return getConfig().nodeEnv === 'production';
};

/**
 * Returns whether the application is in test mode
 */
export const isTest = (): boolean => {
  return getConfig().nodeEnv === 'test';
};

// Export the configuration
export const appConfig = getConfig();

// Export individual config values for convenience
export const {
  port,
  nodeEnv,
  databasePath,
  logLevel,
  corsOrigin,
  rateLimitWindowMs,
  rateLimitMax
} = appConfig;

export default appConfig;