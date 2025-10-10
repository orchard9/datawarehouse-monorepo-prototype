import App from './app.js';
import { appConfig } from './config/index.js';
import logger from './utils/logger.js';

/**
 * Global application instance
 */
let app: App | null = null;

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Starting Orchard9 Data Warehouse Backend...', {
      version: '1.0.0',
      environment: appConfig.nodeEnv,
      port: appConfig.port,
      databasePath: appConfig.databasePath
    });

    app = new App();
    await app.listen(appConfig.port);

    logger.info('✅ Server started successfully');
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handling
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} signal, shutting down gracefully...`);

  try {
    if (app) {
      await app.shutdown();
    }
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// Signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handlers (these will be overridden by the middleware handlers)
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception - Server will exit', {
    error: error.message,
    stack: error.stack,
    name: error.name
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection - Server will exit', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString()
  });
  process.exit(1);
});

// Start the server
startServer();