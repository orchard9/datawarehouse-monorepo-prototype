# Orchard9 Data Warehouse

> **Enterprise Marketing Analytics Platform**
> *Empowering Marketing Decisions Through Data*

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-blue.svg)](https://typescriptlang.org/)

## 🚀 Overview

Orchard9 Data Warehouse is an enterprise-grade marketing analytics platform that combines powerful ETL pipelines with elegant visualization tools. Built for marketing teams to gain deep insights into campaign performance across the entire customer journey, featuring automated data extraction from Peach AI APIs, hierarchical campaign structures, and comprehensive reporting capabilities.

### ✨ Key Features

**🔄 Automated Data Pipeline**
- **ETL Processing**: Robust data extraction from Peach AI APIs with retry logic and error handling
- **5-Tier Hierarchy**: Sophisticated campaign structure (Organization → Program → Campaign → Ad Set → Ad)
- **Real-time Sync**: Scheduled data synchronization with incremental updates and quality validation
- **Data Quality**: Comprehensive validation and error tracking throughout the pipeline

**📊 Analytics Dashboard**
- **Interactive Visualizations**: Drill-down capabilities with responsive charts and graphs
- **Campaign Performance**: Real-time metrics tracking and trend analysis
- **Export Capabilities**: Multiple format exports (CSV, Google Sheets) for downstream analysis
- **API Documentation**: Built-in OpenAPI documentation viewer and testing interface

**🏗️ Enterprise Architecture**
- **Monorepo Structure**: Three integrated components (Frontend, Backend, ETL Pipeline)
- **Type Safety**: Full TypeScript implementation with strict mode and comprehensive type definitions
- **Security First**: Rate limiting, CORS, security headers, input validation, and audit logging
- **Scalable Design**: Optimized for high-performance queries and concurrent users

## 🏛️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (React + Vite)                    │
│              📱 Marketing Analytics Dashboard                 │
│                Port 37950 - Vite Dev Server                  │
└───────────────────┬─────────────────────────────────────────┘
                    │ REST API
┌───────────────────▼─────────────────────────────────────────┐
│                Backend (Express + TypeScript)               │
│              🔗 Data Aggregation & API Layer                 │
│                Port 37951 - Express Server                   │
└─────┬──────────────────────────────────────┬────────────────┘
      │                                      │
┌─────▼────────────────┐          ┌─────────▼─────────────────┐
│   ETL Pipeline       │          │   SQLite Data Warehouse   │
│  🐍 Python + CLI      │          │  📈 Marketing Analytics   │
│  Peach AI APIs       │          │  Campaign Hierarchies     │
└──────────────────────┘          └───────────────────────────┘
```

### Technology Stack

| Component | Technologies | Purpose |
|-----------|-------------|---------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS, Zustand, Recharts | Interactive marketing dashboard |
| **Backend** | Express.js, TypeScript, SQLite, Winston, Helmet, Zod | RESTful API server |
| **ETL Pipeline** | Python, FastAPI, SQLite, PyYAML, Click | Data extraction & transformation |
| **Database** | SQLite with WAL mode | High-performance analytical queries |

## 📁 Project Structure

```
orchard9-datawarehouse/
├── 📱 frontend/                    # React + Vite application
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── stores/                # Zustand state management
│   │   ├── utils/                 # Helper functions
│   │   └── main.tsx              # Application entry point
│   ├── package.json              # Frontend dependencies
│   └── vite.config.ts            # Vite configuration
│
├── ⚙️ backend/                     # Express.js API server
│   ├── src/
│   │   ├── routes/               # API endpoint definitions
│   │   ├── middleware/           # Express middleware
│   │   ├── services/             # Business logic layer
│   │   ├── database/             # Database operations
│   │   ├── utils/                # Utility functions
│   │   └── server.ts             # Server entry point
│   ├── package.json              # Backend dependencies
│   └── README.md                 # Backend documentation
│
├── 🔄 datawarehouse-job/          # Python ETL pipeline
│   ├── src/
│   │   ├── api/                  # API clients
│   │   ├── database/             # Database schema & operations
│   │   ├── etl/                  # ETL pipeline implementation
│   │   └── cli/                  # Command-line interface
│   ├── config/
│   │   ├── settings.yaml         # Main configuration
│   │   └── hierarchy_rules.yaml  # Campaign mapping rules
│   ├── requirements.txt          # Python dependencies
│   ├── Makefile                  # Common tasks
│   └── main.py                   # CLI entry point
│
├── 📋 planning/                   # Project documentation
├── 🗺️ roadmap/                    # Technical specifications
├── CLAUDE.md                     # Development guidelines
└── README.md                     # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Python** 3.9 or higher
- **npm** 8.0.0 or higher

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd orchard9-datawarehouse
   ```

2. **Install dependencies for all components**
   ```bash
   # Frontend dependencies
   cd frontend && npm install && cd ..

   # Backend dependencies
   cd backend && npm install && cd ..

   # Python ETL dependencies
   cd datawarehouse-job && pip install -r requirements.txt && cd ..
   ```

3. **Initialize the database**
   ```bash
   cd datawarehouse-job
   python src/database/schema.py
   ```

4. **Configure authentication**
   ```bash
   # Set your Peach AI API token
   export PEACHAI_API_TOKEN="your-bearer-token-here"

   # Or edit datawarehouse-job/config/settings.yaml
   ```

### Development Servers

**Start all services (recommended for development):**

```bash
# Terminal 1: Backend API (Port 37951)
cd backend && npm run dev

# Terminal 2: Frontend App (Port 37950)
cd frontend && npm run dev

# Terminal 3: Sync data when needed
cd datawarehouse-job && python main.py sync
```

**Individual service commands:**

```bash
# Backend API server
cd backend
npm run dev                    # Development with hot reload
npm run build && npm start     # Production build

# Frontend application
cd frontend
npm run dev                    # Development with hot reload
npm run build                  # Production build

# ETL Pipeline operations
cd datawarehouse-job
python main.py sync            # Sync latest data
python main.py status --detailed  # Check system status
python main.py export --format csv  # Export to CSV
```

## 📊 Data Pipeline

### ETL Operations

The data warehouse uses a sophisticated ETL pipeline to sync marketing data from Peach AI APIs:

#### 🔄 **Data Synchronization**

```bash
# Quick sync (latest 200 campaigns)
python main.py sync

# Historical data sync with date range
python main.py sync-historical --start-date 2025-08-01 --end-date 2025-08-31

# Check current status
python main.py status --detailed
```

#### 📈 **Data Export**

```bash
# Export to CSV
python main.py export --format csv

# Export to Google Sheets (requires credentials)
python main.py export --format google_sheets --credentials-path config/google_credentials.json

# Export specific month with multiple tabs
python main.py export-month --month August --year 2025
```

#### 🔍 **Debugging & Monitoring**

```bash
# Debug specific campaign
python main.py debug-campaign 12345

# Dry run (preview without execution)
python main.py sync --dry-run

# Verbose output for troubleshooting
python main.py sync --verbose
```

### Database Schema

The data warehouse implements a **5-tier hierarchical structure** optimized for marketing analytics:

| Level | Entity | Purpose |
|-------|--------|---------|
| 1 | **Organizations** | Top-level business entities |
| 2 | **Programs** | Strategic marketing initiatives |
| 3 | **Campaigns** | Tactical campaign executions |
| 4 | **Ad Sets** | Targeting groups within campaigns |
| 5 | **Ads** | Individual creative assets |

**Core Tables:**
- `campaigns` - Campaign metadata from Peach AI
- `hourly_data` - Time-series performance metrics
- `campaign_hierarchy` - 5-tier mapping structure
- `hierarchy_rules` - Configurable mapping patterns
- `sync_history` - ETL operation audit trail
- `export_history` - Report generation tracking

## 🔌 API Documentation

### Backend API Endpoints

The Express.js backend provides comprehensive REST APIs for marketing data access:

#### 📊 **Campaign Endpoints**
```http
GET    /api/campaigns                    # List campaigns with filtering
GET    /api/campaigns/:id               # Get campaign details
GET    /api/campaigns/:id/summary       # Campaign with metrics
GET    /api/campaigns/:id/hierarchy     # Campaign with hierarchy
GET    /api/campaigns/search?q=term     # Search campaigns
GET    /api/campaigns/top-performers    # Top performing campaigns
```

#### 📈 **Metrics Endpoints**
```http
GET    /api/metrics                     # Get metrics with filtering
GET    /api/metrics/campaigns/:id       # Campaign-specific metrics
GET    /api/metrics/trends              # Metrics trends over time
POST   /api/metrics/compare             # Compare campaign performance
GET    /api/metrics/aggregated          # Aggregated metrics
```

#### 🏢 **Organization Endpoints**
```http
GET    /api/organizations               # List all organizations
GET    /api/organizations/:id/programs  # Programs by organization
GET    /api/adsets/:id/ads             # Ads by ad set
```

#### 💊 **Health Check Endpoints**
```http
GET    /health                         # Basic health check
GET    /health/detailed                # Detailed system information
GET    /health/database                # Database connectivity
GET    /health/ready                   # Readiness probe
```

### Response Format

All API responses follow a consistent structure:

```json
{
  "success": true,
  "data": { /* response data */ },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  },
  "timestamp": "2025-09-29T00:00:00.000Z",
  "requestId": "req_123456789"
}
```

## 🏗️ Development

### Code Quality & Standards

The project maintains **strict code quality standards** with automated validation:

**Quality Gates:**
- **TypeScript**: Strict mode with comprehensive type checking
- **ESLint**: Enforced coding standards across all components
- **Python**: Code formatting with `black` and `flake8`
- **Testing**: Comprehensive test coverage for critical paths

**Development Workflow:**
```bash
# Frontend quality checks
cd frontend
npm run lint                   # ESLint validation
npm run typecheck             # TypeScript checking
npm run build                 # Production build test

# Backend quality checks
cd backend
npm run lint                   # ESLint validation
npm run type-check            # TypeScript checking
npm test                      # Run test suite

# Python quality checks
cd datawarehouse-job
make test                     # Run all Python tests
make lint                     # Code quality validation
```

### Environment Configuration

**Frontend Configuration:**
- `vite.config.ts` - Build and development configuration
- `.env.local` - Local environment variables (not committed)

**Backend Configuration:**
```env
PORT=37951
NODE_ENV=development
DATABASE_PATH=../datawarehouse-job/datawarehouse.db
CORS_ORIGIN=http://localhost:37950
LOG_LEVEL=info
```

**ETL Pipeline Configuration:**
- `config/settings.yaml` - Main configuration file
- `config/hierarchy_rules.yaml` - Campaign mapping rules
- Environment variables override YAML settings

### Testing Strategy

**Frontend Testing:**
```bash
npm test                      # Vitest unit tests
npm run test:ui              # Interactive test UI
npm run test:coverage        # Coverage report
```

**Backend Testing:**
```bash
npm test                     # Jest unit & integration tests
npm run test:watch           # Watch mode
npm run test:coverage        # Coverage report
```

**ETL Pipeline Testing:**
```bash
python test_complete_system.py    # End-to-end system tests
python test_api_clients.py        # API client validation
python test_etl_pipeline.py       # ETL process testing
```

## 🔒 Security Features

**API Security:**
- **Rate Limiting**: Configurable per-IP request limits
- **CORS Protection**: Configurable origin policies
- **Input Validation**: Zod-based request validation with SQL injection prevention
- **Security Headers**: Helmet.js security headers including XSS protection
- **Error Handling**: Structured error responses without sensitive data exposure

**Data Security:**
- **Read-only Access**: ETL database connections are read-only
- **Audit Logging**: Comprehensive request and operation logging
- **Authentication**: Bearer token authentication for API access
- **Data Validation**: Schema validation at all data ingestion points

## 📈 Performance & Monitoring

**Performance Optimizations:**
- **Database**: SQLite WAL mode with optimized indexes
- **API**: Connection pooling and query optimization
- **Frontend**: Code splitting and lazy loading
- **Caching**: Response caching with appropriate headers

**Monitoring:**
- **Health Checks**: Comprehensive health monitoring endpoints
- **Structured Logging**: Winston-based logging with request tracing
- **Performance Metrics**: Response time and query performance tracking
- **Error Tracking**: Centralized error handling and logging

**Performance Targets:**
- Campaign list: < 200ms for 100 records
- Single campaign: < 100ms
- Metric aggregation: < 500ms
- Support 10,000+ campaigns with 100+ concurrent users

## 🚀 Deployment

### Production Build

```bash
# Build all components
cd frontend && npm run build
cd ../backend && npm run build
cd ../datawarehouse-job && make setup

# Start production services
cd backend && npm start
cd frontend && npm run preview  # or serve build directory
```

### Environment Variables

**Production Environment Setup:**
```bash
# Backend
NODE_ENV=production
DATABASE_PATH=/path/to/production/datawarehouse.db
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=info

# ETL Pipeline
PEACHAI_API_TOKEN=your-production-token
PEACHAI_DB_PATH=/path/to/production/datawarehouse.db
LOG_LEVEL=INFO
```

### Health Monitoring

Use health check endpoints for production monitoring:
- `GET /health` - Basic application health
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/database` - Database connectivity check
- `GET /health/detailed` - Comprehensive system status

## 🤝 Contributing

### Development Guidelines

1. **Code Standards**: Follow established patterns and use TypeScript strictly
2. **Testing**: Write tests for new features and bug fixes
3. **Documentation**: Update documentation for significant changes
4. **Quality Gates**: Ensure all linting and type checking passes

### Making Changes

1. **Research First**: Check existing implementations to avoid duplication
2. **Plan Implementation**: Design solutions following project conventions
3. **Write Tests**: Create tests before or alongside implementation
4. **Quality Check**: Run all linting and testing tools
5. **Documentation**: Update relevant documentation

### Specialized Development Areas

The project supports specialized development through focused agents:
- **Database & ETL**: SQLite optimization, ETL pipeline development
- **Backend APIs**: Express.js development, REST endpoint design
- **Frontend UX**: React components, UI/UX design, accessibility
- **Code Quality**: Performance optimization, best practices
- **Architecture**: Feature planning, system design, integration

## 📞 Support & Troubleshooting

### Common Issues

**Database Connection Errors:**
- Verify database file exists and has proper permissions
- Check `DATABASE_PATH` configuration
- Ensure adequate disk space

**Port Conflicts:**
- Frontend: Change port via Vite configuration
- Backend: Set `PORT` environment variable
- Check for other running instances

**API Authentication:**
- Verify `PEACHAI_API_TOKEN` is set correctly
- Check token permissions with Peach AI
- Review API endpoint configurations

### Getting Help

1. **Check Logs**: Review structured logs for detailed error information
2. **Health Checks**: Use `/health/detailed` for system diagnostics
3. **Configuration**: Verify environment variables and YAML settings
4. **Documentation**: Consult component-specific README files

### Debug Commands

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Check system health
curl http://localhost:37951/health/detailed

# Test ETL pipeline
cd datawarehouse-job && python main.py status --detailed --verbose
```

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🌟 Acknowledgments

Built with modern web technologies and enterprise-grade patterns for marketing analytics excellence:

- **React 19** - Modern UI framework with concurrent features
- **TypeScript** - Type safety and developer experience
- **Vite** - Lightning-fast build tooling
- **Express.js** - Robust Node.js web framework
- **SQLite** - High-performance embedded database
- **Python** - Powerful ETL pipeline implementation

---

**Built with ❤️ by the Orchard9 Team**

*Enterprise Marketing Analytics Platform - Empowering Marketing Decisions Through Data*