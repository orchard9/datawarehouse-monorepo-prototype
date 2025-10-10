/**
 * SQLite database connection and management
 * Provides a robust connection to the data warehouse SQLite database
 */

import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { appConfig } from '../config/index.js';
import logger from '../utils/logger.js';
import { DatabaseConfig } from '../types/index.js';

/**
 * Database connection manager
 */
class DatabaseConnection {
  private db: DatabaseType | null = null;
  private config: DatabaseConfig;

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = {
      path: config?.path || appConfig.databasePath,
      options: {
        ...(config?.options?.verbose && { verbose: config.options.verbose }),
        readonly: config?.options?.readonly !== false, // Default to true for data warehouse
        fileMustExist: config?.options?.fileMustExist !== false, // Default to true
        timeout: config?.options?.timeout || 5000,
        ...config?.options
      }
    };
  }

  /**
   * Initialize the database connection
   */
  async connect(): Promise<void> {
    try {
      // Validate database file exists
      if (this.config.options?.fileMustExist && !fs.existsSync(this.config.path)) {
        throw new Error(`Database file does not exist: ${this.config.path}`);
      }

      // Ensure directory exists if creating new database
      if (!this.config.options?.readonly && !fs.existsSync(this.config.path)) {
        const dir = path.dirname(this.config.path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // Create database connection
      this.db = new Database(this.config.path, this.config.options);

      // Configure database settings
      this.configureDatabase();

      // Verify connection and schema
      await this.verifyConnection();

      logger.info('Database connection established', {
        path: this.config.path,
        readonly: this.config.options?.readonly,
        size: this.getDatabaseSize()
      });

    } catch (error) {
      logger.error('Failed to connect to database', {
        path: this.config.path,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Configure database settings for optimal performance
   */
  private configureDatabase(): void {
    if (!this.db) return;

    // Set pragmas for better performance and reliability
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging
    this.db.pragma('synchronous = NORMAL'); // Balance performance and safety
    this.db.pragma('cache_size = 10000'); // 10MB cache
    this.db.pragma('temp_store = memory'); // Store temp tables in memory
    this.db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O

    logger.debug('Database pragmas configured');
  }

  /**
   * Verify database connection and basic schema
   */
  private async verifyConnection(): Promise<void> {
    if (!this.db) {
      throw new Error('Database connection not established');
    }

    try {
      // Test query to verify connection
      const result = this.db.prepare('SELECT 1 as test').get();
      if (!result || (result as any).test !== 1) {
        throw new Error('Database connection test failed');
      }

      // Verify expected tables exist
      const tables = this.getTableNames();
      const expectedTables = ['organizations', 'programs', 'campaigns', 'ad_sets', 'ads', 'campaign_metrics'];

      const missingTables = expectedTables.filter(table => !tables.includes(table));
      if (missingTables.length > 0) {
        logger.warn('Some expected tables are missing from database', {
          missingTables,
          availableTables: tables
        });
      }

      logger.debug('Database connection verified', {
        tablesFound: tables.length,
        expectedTables: expectedTables.length
      });

    } catch (error) {
      throw new Error(`Database verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the database instance
   */
  getDatabase(): DatabaseType {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.db !== null && this.db.open;
  }

  /**
   * Get database file size in bytes
   */
  getDatabaseSize(): number | null {
    try {
      if (!fs.existsSync(this.config.path)) return null;
      const stats = fs.statSync(this.config.path);
      return stats.size;
    } catch (error) {
      logger.error('Failed to get database size', { error: error instanceof Error ? error.message : String(error) });
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
      logger.error('Failed to get table names', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Get database schema information
   */
  getSchemaInfo(): Record<string, Array<{ name: string; type: string; pk: number; dflt_value: any; notnull: number }>> {
    if (!this.db) return {};

    const schema: Record<string, Array<{ name: string; type: string; pk: number; dflt_value: any; notnull: number }>> = {};
    const tableNames = this.getTableNames();

    for (const tableName of tableNames) {
      try {
        const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: any;
          pk: number;
        }>;

        schema[tableName] = columns.map(col => ({
          name: col.name,
          type: col.type,
          pk: col.pk,
          dflt_value: col.dflt_value,
          notnull: col.notnull
        }));
      } catch (error) {
        logger.error(`Failed to get schema for table ${tableName}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return schema;
  }

  /**
   * Execute a health check on the database
   */
  async healthCheck(): Promise<{
    connected: boolean;
    path: string;
    size: number | null;
    tables: string[];
    readonly: boolean;
  }> {
    return {
      connected: this.isConnected(),
      path: this.config.path,
      size: this.getDatabaseSize(),
      tables: this.getTableNames(),
      readonly: this.config.options?.readonly || false
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
        logger.info('Database connection closed');
      } catch (error) {
        logger.error('Error closing database connection', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }
  }

  /**
   * Create a transaction wrapper
   */
  transaction<T>(fn: (db: DatabaseType) => T): T {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const transaction = this.db.transaction(fn);
    return transaction(this.db);
  }
}

// Create singleton instance
let dbInstance: DatabaseConnection | null = null;

/**
 * Get the singleton database connection instance
 */
export function getDatabase(): DatabaseConnection {
  if (!dbInstance) {
    dbInstance = new DatabaseConnection();
  }
  return dbInstance;
}

/**
 * Initialize the database connection
 */
export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  await db.connect();
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

export default DatabaseConnection;
export { DatabaseConnection };