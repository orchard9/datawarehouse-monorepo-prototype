/**
 * Data Warehouse SQLite connection and management
 * Provides read-only access to the data warehouse SQLite database
 */

import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * Data warehouse database connection manager
 * Optimized for read-only access to analytical data
 */
class DataWarehouseConnection {
  private db: DatabaseType | null = null;
  private dbPath: string;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private isHealthy: boolean = false;

  constructor() {
    // Default to datawarehouse.db in the datawarehouse-job directory
    this.dbPath = process.env.PEACHAI_DB_PATH ||
      path.join(process.cwd(), '..', 'datawarehouse-job', 'datawarehouse.db');
  }

  /**
   * Initialize the data warehouse database connection
   */
  async connect(): Promise<void> {
    try {
      // Validate database file exists
      if (!fs.existsSync(this.dbPath)) {
        throw new Error(`Data warehouse database file does not exist: ${this.dbPath}`);
      }

      // Create read-only database connection
      this.db = new Database(this.dbPath, {
        readonly: true,
        fileMustExist: true,
        timeout: 10000 // 10 second timeout for read operations
      });

      // Configure database settings for optimal read performance
      this.configureDatabase();

      // Verify connection and schema
      await this.verifyConnection();

      this.isHealthy = true;
      this.retryCount = 0;

      logger.info('Data warehouse database connection established', {
        path: this.dbPath,
        size: this.getDatabaseSize(),
        tables: this.getTableNames().length
      });

    } catch (error) {
      this.isHealthy = false;
      logger.error('Failed to connect to data warehouse database', {
        path: this.dbPath,
        error: error instanceof Error ? error.message : String(error),
        retryCount: this.retryCount
      });

      // Implement retry logic for connection failures
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.info(`Retrying data warehouse connection (${this.retryCount}/${this.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * this.retryCount)); // Exponential backoff
        return this.connect();
      }

      throw error;
    }
  }

  /**
   * Configure database settings for optimal read performance
   */
  private configureDatabase(): void {
    if (!this.db) return;

    try {
      // Optimize for read-only analytical queries
      this.db.pragma('cache_size = 20000'); // 20MB cache for better read performance
      this.db.pragma('temp_store = memory'); // Store temp tables in memory
      this.db.pragma('mmap_size = 536870912'); // 512MB memory-mapped I/O
      this.db.pragma('query_only = true'); // Ensure read-only mode

      // Additional read optimizations
      this.db.pragma('synchronous = OFF'); // Safe for read-only
      this.db.pragma('journal_mode = OFF'); // No journaling needed for read-only

      logger.debug('Data warehouse database pragmas configured for read optimization');
    } catch (error) {
      logger.warn('Failed to configure some database pragmas', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Verify database connection and validate schema
   */
  private async verifyConnection(): Promise<void> {
    if (!this.db) {
      throw new Error('Data warehouse database connection not established');
    }

    try {
      // Test basic connectivity
      const result = this.db.prepare('SELECT 1 as test').get();
      if (!result || (result as any).test !== 1) {
        throw new Error('Data warehouse database connection test failed');
      }

      // Verify expected data warehouse tables exist
      const tables = this.getTableNames();
      const expectedTables = [
        'campaigns',
        'hourly_data',
        'campaign_hierarchy',
        'hierarchy_rules',
        'sync_history',
        'export_history'
      ];

      const missingTables = expectedTables.filter(table => !tables.includes(table));
      if (missingTables.length > 0) {
        logger.warn('Some expected data warehouse tables are missing', {
          missingTables,
          availableTables: tables
        });
      }

      // Verify data freshness
      const lastSyncResult = this.db.prepare(`
        SELECT MAX(start_time) as last_sync
        FROM sync_history
        WHERE status = 'completed'
      `).get() as { last_sync: string | null } | undefined;

      if (lastSyncResult?.last_sync) {
        const lastSync = new Date(lastSyncResult.last_sync);
        const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

        if (hoursSinceSync > 24) {
          logger.warn('Data warehouse data may be stale', {
            lastSync: lastSyncResult.last_sync,
            hoursSinceSync: Math.round(hoursSinceSync)
          });
        }
      }

      logger.debug('Data warehouse database connection verified', {
        tablesFound: tables.length,
        expectedTables: expectedTables.length,
        lastSync: lastSyncResult?.last_sync
      });

    } catch (error) {
      throw new Error(`Data warehouse database verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the database instance with health check
   */
  getDatabase(): DatabaseType {
    if (!this.db || !this.isHealthy) {
      throw new Error('Data warehouse database not connected or unhealthy. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Check if database is connected and healthy
   */
  isConnected(): boolean {
    return this.db !== null && this.db.open && this.isHealthy;
  }

  /**
   * Get database file size in bytes
   */
  getDatabaseSize(): number | null {
    try {
      if (!fs.existsSync(this.dbPath)) return null;
      const stats = fs.statSync(this.dbPath);
      return stats.size;
    } catch (error) {
      logger.error('Failed to get data warehouse database size', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get list of table names in the database
   */
  getTableNames(): string[] {
    if (!this.db) return [];

    try {
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as Array<{ name: string }>;

      return tables.map(table => table.name);
    } catch (error) {
      logger.error('Failed to get data warehouse table names', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get table record counts for health monitoring
   */
  getTableCounts(): Record<string, number> {
    if (!this.db) return {};

    const counts: Record<string, number> = {};
    const tableNames = this.getTableNames();

    for (const tableName of tableNames) {
      try {
        const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
        counts[tableName] = result.count;
      } catch (error) {
        logger.error(`Failed to get count for table ${tableName}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        counts[tableName] = -1; // Indicate error
      }
    }

    return counts;
  }

  /**
   * Execute a health check on the data warehouse database
   */
  async healthCheck(): Promise<{
    connected: boolean;
    path: string;
    size: number | null;
    tables: string[];
    tableCounts: Record<string, number>;
    lastSync: string | null;
    dataFreshness: {
      hoursSinceLastSync: number | null;
      isStale: boolean;
    };
    performance: {
      queryTime: number;
      cacheHitRate: string;
    };
  }> {
    const startTime = Date.now();
    let queryTime = 0;
    let cacheHitRate = 'unknown';
    let lastSync: string | null = null;
    let hoursSinceLastSync: number | null = null;

    try {
      // Test query performance
      if (this.db) {
        this.db.prepare('SELECT COUNT(*) FROM campaigns').get();
        queryTime = Date.now() - startTime;

        // Get cache statistics
        try {
          const cacheStats = this.db.pragma('cache_spill') as any;
          cacheHitRate = cacheStats ? cacheStats.toString() : 'unknown';
        } catch {
          // Cache stats not available in all SQLite versions
        }

        // Get sync information
        try {
          const syncResult = this.db.prepare(`
            SELECT start_time FROM sync_history
            WHERE status = 'completed'
            ORDER BY start_time DESC
            LIMIT 1
          `).get() as { start_time: string } | undefined;

          if (syncResult) {
            lastSync = syncResult.start_time;
            hoursSinceLastSync = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
          }
        } catch (error) {
          logger.warn('Failed to get sync information', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      logger.error('Health check query failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return {
      connected: this.isConnected(),
      path: this.dbPath,
      size: this.getDatabaseSize(),
      tables: this.getTableNames(),
      tableCounts: this.getTableCounts(),
      lastSync,
      dataFreshness: {
        hoursSinceLastSync,
        isStale: hoursSinceLastSync !== null && hoursSinceLastSync > 24
      },
      performance: {
        queryTime,
        cacheHitRate
      }
    };
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        this.isHealthy = false;
        logger.info('Data warehouse database connection closed');
      } catch (error) {
        logger.error('Error closing data warehouse database connection', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }
  }

  /**
   * Execute a prepared statement with error handling and logging
   */
  executeQuery<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) {
      throw new Error('Data warehouse database not connected');
    }

    try {
      const startTime = Date.now();
      const stmt = this.db.prepare(sql);
      const result = stmt.all(params) as T[];
      const queryTime = Date.now() - startTime;

      if (queryTime > 1000) { // Log slow queries
        logger.warn('Slow data warehouse query detected', {
          sql: sql.substring(0, 100) + '...',
          queryTime,
          paramCount: params.length,
          resultCount: result.length
        });
      }

      return result;
    } catch (error) {
      logger.error('Data warehouse query execution failed', {
        sql: sql.substring(0, 100) + '...',
        error: error instanceof Error ? error.message : String(error),
        paramCount: params.length
      });
      throw error;
    }
  }

  /**
   * Execute a single row query
   */
  executeQuerySingle<T = any>(sql: string, params: any[] = []): T | null {
    if (!this.db) {
      throw new Error('Data warehouse database not connected');
    }

    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.get(params) as T | undefined;
      return result || null;
    } catch (error) {
      logger.error('Data warehouse single query execution failed', {
        sql: sql.substring(0, 100) + '...',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Create singleton instance for data warehouse
let dataWarehouseInstance: DataWarehouseConnection | null = null;

/**
 * Get the singleton data warehouse database connection instance
 */
export function getDataWarehouseDatabase(): DataWarehouseConnection {
  if (!dataWarehouseInstance) {
    dataWarehouseInstance = new DataWarehouseConnection();
  }
  return dataWarehouseInstance;
}

/**
 * Initialize the data warehouse database connection
 */
export async function initializeDataWarehouseDatabase(): Promise<void> {
  const db = getDataWarehouseDatabase();
  await db.connect();
}

/**
 * Close the data warehouse database connection
 */
export async function closeDataWarehouseDatabase(): Promise<void> {
  if (dataWarehouseInstance) {
    await dataWarehouseInstance.close();
    dataWarehouseInstance = null;
  }
}

export default DataWarehouseConnection;
export { DataWarehouseConnection };