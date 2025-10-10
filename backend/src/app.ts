import express from 'express';
import { Server } from 'http';

// Import configuration and utilities
import { appConfig } from './config/index.js';
import logger from './utils/logger.js';
// import { initializeDatabase } from './database/connection.js';
import { initializeDataWarehouseDatabase } from './database/datawarehouseConnection.js';

// Import middleware
import { addResponseUtils } from './utils/response.js';
import {
  configureCors,
  configureHelmet,
  configureRateLimit,
  requestLogger,
  securityHeaders,
  sanitizeInput
} from './middleware/security.js';
import { sanitizeQuery, validateContentType } from './middleware/validation.js';
import {
  errorHandler,
  notFoundHandler,
  requestTimeout,
  handleUnhandledRejection,
  handleUncaughtException
} from './middleware/errorHandler.js';

// Import routes
import routes from './routes/index.js';

/**
 * Express application configuration and setup
 */
class App {
  public app: express.Application;
  private server: Server | null = null;

  constructor() {
    this.app = express();
    this.setupErrorHandlers();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Setup global error handlers
   */
  private setupErrorHandlers(): void {
    handleUnhandledRejection();
    handleUncaughtException();
  }

  /**
   * Initialize middleware for the Express application
   */
  private initializeMiddleware(): void {
    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(configureHelmet());
    this.app.use(configureCors());
    this.app.use(configureRateLimit());

    // Request timeout
    this.app.use(requestTimeout(30000)); // 30 seconds

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Custom middleware
    this.app.use(addResponseUtils);
    this.app.use(securityHeaders);
    this.app.use(sanitizeInput);
    this.app.use(sanitizeQuery);
    this.app.use(validateContentType);
    this.app.use(requestLogger);
  }

  /**
   * Initialize application routes
   */
  private initializeRoutes(): void {
    // Mount all routes
    this.app.use('/', routes);

    // Handle 404 for unmatched routes
    this.app.use(notFoundHandler);
  }

  /**
   * Initialize error handling middleware
   */
  private initializeErrorHandling(): void {
    // Global error handler (must be last)
    this.app.use(errorHandler);
  }

  /**
   * Start the Express server
   */
  public async listen(port: number): Promise<void> {
    try {
      // Initialize database connections
      logger.info('Initializing database connections...');
      // TODO: Temporarily disable main database for data warehouse verification
      // await initializeDatabase();
      logger.info('Main database connection skipped for data warehouse verification');

      // Initialize data warehouse database connection
      try {
        await initializeDataWarehouseDatabase();
        logger.info('Data warehouse database connection established successfully');
      } catch (dwError) {
        logger.warn('Data warehouse database connection failed - data warehouse endpoints may be unavailable', {
          error: dwError instanceof Error ? dwError.message : String(dwError)
        });
        // Don't fail startup if data warehouse is unavailable
      }

      // Start the server
      return new Promise((resolve, reject) => {
        this.server = this.app.listen(port, () => {
          logger.info(`🚀 Orchard9 Data Warehouse Backend running on port ${port}`, {
            port,
            environment: appConfig.nodeEnv,
            databasePath: appConfig.databasePath
          });
          logger.info(`📊 Health check: http://localhost:${port}/health`);
          logger.info(`🌐 API documentation: http://localhost:${port}/api`);
          logger.info(`📈 Campaigns API: http://localhost:${port}/api/campaigns`);
          logger.info(`📊 Metrics API: http://localhost:${port}/api/metrics`);
          logger.info(`🏢 Data Warehouse API: http://localhost:${port}/api/datawarehouse`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('Server failed to start', { error: error.message });
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Failed to start application', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Gracefully shutdown the server
   */
  public async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        logger.info('🛑 Shutting down server gracefully...');
        this.server.close(async () => {
          try {
            // Close database connections
            // const { closeDatabase } = await import('./database/connection.js');
            const { closeDataWarehouseDatabase } = await import('./database/datawarehouseConnection.js');

            // await closeDatabase();
            logger.info('Main database connection was not used');

            try {
              await closeDataWarehouseDatabase();
              logger.info('Data warehouse database connection closed');
            } catch (dwError) {
              logger.warn('Error closing data warehouse database connection', {
                error: dwError instanceof Error ? dwError.message : String(dwError)
              });
            }
          } catch (error) {
            logger.error('Error closing database connections', {
              error: error instanceof Error ? error.message : String(error)
            });
          }

          logger.info('✅ Server shutdown complete');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default App;