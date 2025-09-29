# Orchard9 Data Warehouse Backend

Enterprise-grade Express.js TypeScript API server for serving marketing analytics data from the Orchard9 data warehouse.

## 🚀 Overview

The Orchard9 Data Warehouse Backend is a robust, scalable API server that provides access to marketing campaign data and analytics. Built with TypeScript and Express.js, it features comprehensive error handling, structured logging, input validation, and enterprise-level security measures.

### Key Features

- **📊 Marketing Analytics API**: Comprehensive endpoints for campaign performance data
- **🏗️ Hierarchical Data Structure**: Support for Organizations → Programs → Campaigns → Ad Sets → Ads
- **⚡ High Performance**: Optimized SQLite queries with connection pooling
- **🔒 Enterprise Security**: Rate limiting, CORS, security headers, input validation
- **📝 Structured Logging**: Winston-based logging with request tracing
- **✅ Type Safety**: Full TypeScript implementation with strict mode
- **🛡️ Error Handling**: Centralized error handling with proper HTTP status codes
- **📈 Health Monitoring**: Comprehensive health check endpoints
- **🔄 Graceful Shutdown**: Proper cleanup of resources on shutdown

## 📁 Project Structure

```
src/
├── config/          # Configuration management
│   └── index.ts     # App configuration with validation
├── database/        # Database connection and queries
│   ├── connection.ts # SQLite connection management
│   └── queries.ts   # Type-safe database queries
├── middleware/      # Express middleware
│   ├── errorHandler.ts # Error handling and async wrappers
│   ├── security.ts     # Security headers, CORS, rate limiting
│   └── validation.ts   # Request validation with Zod
├── routes/          # API route definitions
│   ├── index.ts     # Route aggregation
│   ├── health.ts    # Health check endpoints
│   ├── campaigns.ts # Campaign-related endpoints
│   ├── metrics.ts   # Metrics and analytics endpoints
│   ├── organizations.ts # Organization and program endpoints
│   └── ads.ts       # Ad set and ad endpoints
├── services/        # Business logic layer
│   ├── campaignService.ts # Campaign operations
│   └── metricsService.ts  # Metrics calculations
├── utils/           # Utility functions
│   ├── logger.ts    # Winston logging configuration
│   ├── response.ts  # HTTP response standardization
│   └── errors.ts    # Custom error classes
├── types/           # TypeScript type definitions
│   └── index.ts     # Shared type definitions
├── app.ts           # Express application setup
└── server.ts        # Application entry point
```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- SQLite database file at `../datawarehouse-job/datawarehouse.db`

### Installation

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment (optional):**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build the application:**
   ```bash
   npm run build
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## ⚙️ Configuration

The application uses environment variables for configuration. Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=37951
NODE_ENV=development
LOG_LEVEL=info

# Database Configuration
DATABASE_PATH=../datawarehouse-job/datawarehouse.db

# Security Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# API Keys (production only)
VALID_API_KEYS=key1,key2,key3
```

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `37951` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `LOG_LEVEL` | `info` | Winston log level |
| `DATABASE_PATH` | `../datawarehouse-job/datawarehouse.db` | SQLite database file path |
| `CORS_ORIGIN` | `true` | CORS origin configuration |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 mins) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |

## 📡 API Endpoints

### Health Check Endpoints

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health information
- `GET /health/database` - Database health check
- `GET /health/ready` - Readiness probe

### Campaign Endpoints

- `GET /api/campaigns` - List campaigns with filtering and pagination
- `GET /api/campaigns/:id` - Get campaign by ID
- `GET /api/campaigns/:id/summary` - Get campaign summary with metrics
- `GET /api/campaigns/:id/hierarchy` - Get campaign with ad sets and ads
- `GET /api/campaigns/:id/adsets` - Get ad sets for campaign
- `GET /api/campaigns/search?q=term` - Search campaigns by name
- `GET /api/campaigns/top-performers` - Get top performing campaigns

### Metrics Endpoints

- `GET /api/metrics` - Get metrics with filtering
- `GET /api/metrics/campaigns/:id` - Get metrics for specific campaign
- `GET /api/metrics/trends` - Get metrics trends over time
- `POST /api/metrics/compare` - Compare performance between campaigns
- `GET /api/metrics/top-periods` - Get top performing time periods
- `GET /api/metrics/aggregated` - Get aggregated metrics
- `GET /api/metrics/campaigns/:id/trends` - Get campaign-specific trends

### Organization Endpoints

- `GET /api/organizations` - List all organizations
- `GET /api/organizations/:id/programs` - Get programs for organization

### Ad Endpoints

- `GET /api/adsets/:id/ads` - Get ads for ad set

## 🔍 Query Parameters

### Pagination
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

### Filtering
- `startDate` - Start date filter (ISO format)
- `endDate` - End date filter (ISO format)
- `status` - Status filter (active, paused, deleted)
- `organizationId` - Filter by organization
- `programId` - Filter by program

### Metrics Aggregation
- `groupBy` - Group by time period (hour, day, week, month)
- `aggregateBy` - Aggregation function (sum, avg, min, max)

## 📊 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Optional success message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_123456789"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_123456789"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": { /* error details */ }
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_123456789"
}
```

## 🗄️ Database Connection

The API connects to a read-only SQLite database containing the data warehouse. The database schema includes:

- **organizations** - Top-level entities
- **programs** - Strategic marketing initiatives
- **campaigns** - Tactical campaign executions
- **ad_sets** - Targeting groups within campaigns
- **ads** - Individual creative assets
- **campaign_metrics** - Hourly performance metrics

### Database Configuration

The connection is automatically configured to:
- Use WAL mode for better performance
- Set appropriate pragmas for read optimization
- Handle connection pooling and retries
- Validate schema on startup

## 🛡️ Security Features

### Headers & CORS
- Security headers via Helmet
- Configurable CORS policies
- XSS protection
- Content type validation

### Rate Limiting
- Configurable rate limits per IP
- Separate limits for different endpoints
- Graceful handling of limit exceeded

### Input Validation
- Zod-based request validation
- SQL injection prevention
- Input sanitization
- Type-safe parameter parsing

### Error Handling
- No sensitive data exposure
- Structured error logging
- Proper HTTP status codes
- Request ID tracing

## 📝 Logging

The application uses Winston for structured logging:

### Log Levels
- `error` - Application errors and exceptions
- `warn` - Warning conditions and client errors
- `info` - General information and request logging
- `http` - HTTP request/response logging
- `debug` - Detailed debugging information

### Log Format
Development: Colorized console output with timestamps
Production: JSON format for log aggregation

### Request Tracing
Every request gets a unique ID for tracing across logs.

## 🧪 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run lint:check   # Check linting without fixing
npm run format       # Format code with Prettier
npm run format:check # Check formatting
npm run type-check   # TypeScript type checking

# Testing
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Development Workflow

1. **Make changes** following TypeScript best practices
2. **Run type checking** with `npm run type-check`
3. **Format code** with `npm run format`
4. **Lint code** with `npm run lint`
5. **Test changes** with `npm test`
6. **Build application** with `npm run build`

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Variables

Ensure all required environment variables are set in production:
- `NODE_ENV=production`
- `DATABASE_PATH` pointing to production database
- `CORS_ORIGIN` with allowed origins
- Proper logging configuration

### Health Monitoring

Use the health check endpoints for monitoring:
- `GET /health` for basic health
- `GET /health/ready` for readiness probes
- `GET /health/database` for database connectivity

## 🔧 Testing

### Test Structure

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Test Categories

- **Unit Tests** - Individual function testing
- **Integration Tests** - API endpoint testing
- **Database Tests** - Query validation
- **Error Handling Tests** - Error scenario validation

## 📈 Performance

### Optimization Features

- **Connection Pooling** - Efficient database connections
- **Query Optimization** - Indexed queries and proper joins
- **Response Caching** - Appropriate cache headers
- **Request Validation** - Early validation to prevent unnecessary processing
- **Structured Logging** - Minimal performance impact

### Monitoring

Monitor these metrics:
- Response times via health checks
- Database query performance
- Memory usage via health endpoints
- Error rates in logs

## 🤝 Error Handling Patterns

### Custom Error Classes

```typescript
import { BadRequestError, NotFoundError, DatabaseError } from './utils/errors.js';

// Usage examples
throw new BadRequestError('Invalid campaign ID');
throw new NotFoundError('Campaign not found');
throw new DatabaseError('Query failed');
```

### Async Error Handling

```typescript
import { asyncHandler } from './middleware/errorHandler.js';

router.get('/campaigns/:id',
  validate.getCampaignById,
  asyncHandler(async (req: Request, res: Response) => {
    // Your async code here - errors automatically caught
  })
);
```

## 🔗 Integration

### Frontend Integration

The API is designed to work seamlessly with the frontend React application:
- CORS configured for frontend origins
- Consistent response format
- Type-safe endpoints
- Error handling compatible with frontend error boundaries

### External Services

Ready for integration with:
- Authentication services
- Monitoring tools (DataDog, New Relic)
- Log aggregation (ELK stack)
- API gateways

## 📋 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check database file exists and permissions
   - Verify `DATABASE_PATH` configuration
   - Check disk space

2. **Port Already in Use**
   - Change `PORT` environment variable
   - Check for other running instances

3. **High Memory Usage**
   - Monitor via `/health/detailed` endpoint
   - Check for memory leaks in logs
   - Restart application if needed

4. **Slow Response Times**
   - Check database file size and fragmentation
   - Monitor query performance logs
   - Verify adequate system resources

### Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

Check health endpoints:
```bash
curl http://localhost:37951/health/detailed
```

## 📞 Support

For issues and questions:
1. Check the logs for detailed error information
2. Verify configuration settings
3. Test database connectivity via health checks
4. Review the API documentation at `/api` endpoint

---

**Built with ❤️ by the Orchard9 Team**