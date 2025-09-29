# Orchard9 Data Warehouse - Enterprise Marketing Analytics Platform

## Code Philosophy
Write code that is clean, DRY, principal level, and focused on delivering exactly what we need and what we asked for and nothing more. YAGNI.

## Semantic Colors
Use semantic color classes everywhere except inside chart/graph components where color values are required (e.g., fill="hsl(var(--destructive))").

**IMPORTANT: Select the appropriate specialized agent for your task:**
- `sqlite-database-engineer-datawarehousing` - SQLite schema design, ETL optimization, data warehouse architecture
- `typescript-api-developer-express` - Express.js API development with TypeScript, REST endpoints, middleware
- `ux-engineer` - React components, TypeScript development, UI/UX design, accessibility, responsive layouts
- `frontend-polish-expert` - Code refinement, performance optimization, best practices for React/Vite
- `rest-api-designer` - REST API design, OpenAPI specifications, endpoint architecture, API documentation
- `feature-planner` - Feature planning, architecture design, implementation roadmaps, cross-component integration

**For every message, choose the best agent to respond with** - available agents: sqlite-database-engineer-datawarehousing, typescript-api-developer-express, ux-engineer, frontend-polish-expert, rest-api-designer, feature-planner.

Built for marketing teams to gain deep insights into campaign performance across the entire customer journey.

An enterprise-grade data warehouse solution with beautiful visualization capabilities.

"Empowering Marketing Decisions Through Data" - our mission.

## Executive Summary

Orchard9 Data Warehouse is an enterprise marketing analytics platform that combines powerful ETL pipelines with elegant visualization tools. We create comprehensive data solutions for marketing teams to track, analyze, and optimize their campaign performance through real-time metrics, hierarchical campaign structures, and seamless API integrations.

### Core Offerings

**Data Pipeline:**
- **ETL Processing**: Automated data extraction from Peach AI APIs with retry logic
- **Hierarchical Storage**: 5-tier campaign structure (Organization → Program → Campaign → Ad Set → Ad)
- **Real-time Sync**: Scheduled data synchronization with incremental updates

**Analytics Dashboard:**
- **Campaign Performance**: Interactive visualizations with drill-down capabilities
- **API Documentation**: Built-in OpenAPI documentation viewer
- **Export Capabilities**: Multiple format exports (CSV, JSON) for downstream analysis

Never run the server, I will always be running it.

**NEVER** run `npm run dev` or any development server commands - the user is always running the dev server.

## Repository Structure

This is a monorepo with three main components:

- `frontend/` - React + Vite application with API documentation
- `datawarehouse-job/` - Python ETL pipeline for Peach AI data warehouse
- `backend/` - Express.js API server with TypeScript

**Reserved Port Range**: This project uses ports 37950-37959 (frontend: 37950, backend: 37951)

## Database

We use SQLite for efficient local data warehousing with optimized schemas for analytical queries. The schema includes tables for organizations, programs, campaigns, ad sets, ads, and campaign metrics.

**CRITICAL**: All campaign hierarchies must maintain referential integrity through foreign keys. Never delete parent records with active children.

**CRITICAL**: All date/time operations must use UTC for consistency across data sources and exports.

**IMPORTANT**: Before any database operations, review the schema documentation to understand table structures, relationships, and constraints.

### Database Schema

The data warehouse uses a hierarchical structure optimized for marketing analytics:

1. **Organizations** - Top-level entities
2. **Programs** - Strategic marketing initiatives
3. **Campaigns** - Tactical campaign executions
4. **Ad Sets** - Targeting groups within campaigns
5. **Ads** - Individual creative assets

Each level includes comprehensive metrics tracking for performance analysis.

## How to Update Database with Latest Data

The data warehouse uses Python-based ETL pipelines to sync data from Peach AI APIs. Follow these steps to keep your database up-to-date:

### Prerequisites

1. **Install Python Dependencies**
   ```bash
   cd datawarehouse-job
   pip install -r requirements.txt
   ```

2. **Configure API Authentication**

   **Option A: Environment Variable (Recommended for Security)**
   ```bash
   export PEACHAI_API_TOKEN="your-bearer-token-here"
   ```

   **Option B: Configuration File**
   Edit `datawarehouse-job/config/settings.yaml`:
   ```yaml
   api:
     bearer_token: "your-bearer-token-here"
   ```

### Basic Data Sync Commands

#### 1. Quick Sync (Latest Data Only)
```bash
cd datawarehouse-job
python main.py sync
```
This pulls the latest campaigns and hourly metrics, processes them through the ETL pipeline, and maps hierarchies.

#### 2. Check Current Database Status
```bash
python main.py status --detailed
```
Shows:
- Total campaigns in database
- Recent sync history
- API connectivity status
- Hierarchy mapping coverage
- Unmapped campaigns

#### 3. Sync Historical Data
For loading data from a specific date range:
```bash
# Sync a full month
python main.py sync-historical --start-date 2025-08-01 --end-date 2025-08-31

# Sync with custom batch size (default is 168 hours/7 days per batch)
python main.py sync-historical --start-date 2025-07-01 --end-date 2025-07-31 --batch-hours 24

# Test with limited batches
python main.py sync-historical --start-date 2025-08-01 --end-date 2025-08-31 --test-batches 2
```

### Export Commands

#### Export to CSV (Local File)
```bash
# Export campaign summary
python main.py export --format csv

# Export daily records (one per campaign per day)
python main.py export --format csv --daily
```

#### Export to Google Sheets
```bash
# Single tab export (requires Google credentials)
python main.py export --format google_sheets --credentials-path config/google_credentials.json

# Multi-tab export for a specific month
python main.py export-month --month August --year 2025 --credentials-path config/google_credentials.json

# Multi-tab export for a date range
python main.py export-daterange --start-date 2025-08-01 --end-date 2025-08-31 --credentials-path config/google_credentials.json
```

### Alternative Methods

#### Using Make Commands
```bash
cd datawarehouse-job
make setup           # Complete initial setup
make sync           # Run data sync
make status         # Check system status
make export         # Export to CSV
make test           # Run all tests
```

#### Using npm Commands
```bash
cd datawarehouse-job
npm run setup       # Complete initial setup
npm run sync        # Run data sync
npm test           # Run all tests
```

### Debug & Troubleshooting

#### Debug a Specific Campaign
```bash
python main.py debug-campaign 12345
```
Shows all stored data for campaign ID 12345 including:
- Basic campaign info
- Hierarchy mapping
- Metrics summary
- Hourly data records
- Calculated performance

#### Dry Run (Preview Without Execution)
Add `--dry-run` to any sync or export command:
```bash
python main.py sync --dry-run
python main.py export-month --month July --year 2025 --dry-run
```

#### Verbose Output
Add `--verbose` or `-v` for detailed output:
```bash
python main.py sync --verbose
python main.py status --detailed --verbose
```

### Database Location & Management

- **Default Database Path**: `datawarehouse-job/datawarehouse.db`
- **Override Database Path**:
  ```bash
  python main.py sync --db-path /custom/path/to/database.db
  ```
- **Reset Database** (WARNING: Deletes all data):
  ```bash
  cd datawarehouse-job
  make db-reset
  ```

### Environment Variables

The system supports these environment variables for configuration overrides:

- `PEACHAI_API_TOKEN` - API bearer token (overrides settings.yaml)
- `PEACHAI_API_URL` - API base URL
- `PEACHAI_DB_PATH` - Database file path
- `GOOGLE_CREDENTIALS_PATH` - Google Sheets credentials path
- `LOG_LEVEL` - Logging level (DEBUG, INFO, WARNING, ERROR)

### Automation & Scheduling

For automated daily updates, use cron (Linux/Mac) or Task Scheduler (Windows):

```bash
# Example cron entry for daily sync at 6 AM
0 6 * * * cd /path/to/datawarehouse-job && python main.py sync
```

### Key Points to Remember

1. **Always run from datawarehouse-job directory** - The CLI expects to be run from this location
2. **Check API token** - Ensure your Peach AI bearer token is configured
3. **Monitor sync status** - Use `status --detailed` to verify successful syncs
4. **Handle failures gracefully** - The ETL pipeline includes retry logic and error tracking
5. **Export regularly** - Generate reports after syncing for analysis

## Code Quality Policy

**CRITICAL**: After every code change, `watch-now --once` must pass before proceeding.

**We maintain strict code quality standards with automatic validation:**

### Quality Gates
- **Python**: `flake8` and `black` for consistent code formatting
- **JavaScript/TypeScript**: ESLint with strict rules
- **Testing**: Comprehensive test coverage for critical paths

### Development Workflow
1. Make code changes following project patterns
2. Run quality checks before committing
3. Test functionality thoroughly
4. Document significant changes

**CRITICAL**: Never bypass quality gates or commit broken code.

## Common Commands

### Frontend Development
```bash
cd frontend
npm install                # Install dependencies (runs API generation automatically)
npm run dev                # Start dev server (Vite)
npm run build              # Build production bundle
npm run lint               # Run ESLint
npm test                   # Run tests with Vitest
npm run test:coverage      # Run tests with coverage
npm run generate:api       # Generate API types from OpenAPI spec
npm run docs:serve         # Serve API documentation
```

### Data Warehouse Operations
```bash
cd datawarehouse-job
pip install -r requirements.txt    # Install Python dependencies
python main.py sync                 # Sync data from Peach AI APIs
python main.py export --format csv  # Export data to CSV
python main.py status --detailed    # Check system status
make test                           # Run all Python tests
npm run setup                       # Complete project setup
```

## Architecture Overview

### Frontend (React + Vite)
- **Framework**: React 19 with Vite bundler for lightning-fast development
- **State Management**: Zustand for efficient state handling
- **API Client**: Axios with auto-generated types from OpenAPI spec (Orval)
- **Testing**: Vitest with React Testing Library
- **Key Files**:
  - `src/MarketingManagerV4.jsx` - Main application component
  - `src/generated/` - Auto-generated API types and client
  - `openapi.json` - API specification
  - **Path aliases configured**: `@components`, `@hooks`, `@stores`, `@api`, `@utils`

### Data Warehouse (Python ETL)
- **Database**: SQLite with 5-tier campaign hierarchy optimized for analytical queries
- **API Integration**: Peach AI endpoints with exponential backoff retry logic
- **Configuration**: YAML-based settings in `config/settings.yaml`
- **Key Components**:
  - `src/api/` - API clients for Peach AI endpoints
  - `src/database/` - Database schema and operations
  - `src/etl/` - ETL pipeline implementation
  - `src/cli/` - Command-line interface
- **Authentication**: Bearer token via PEACHAI_API_TOKEN env var or settings.yaml

## Error Handling

We use structured error logging throughout the application. The logging system captures errors with full context including request details, response data, and stack traces.

**NEVER use console.log in production code.** Use the structured logging utilities instead.

## Testing Strategy

### Frontend Testing
- **Unit Tests**: Component-level testing with Vitest
- **Integration Tests**: API integration validation
- **E2E Tests**: Critical user journey validation
- Run individual test: `npm test -- path/to/test.spec.js`
- UI test mode: `npm run test:ui`
- Coverage report: `npm run test:coverage`

### Python Testing
- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end pipeline validation
- **Data Validation**: Schema and data quality checks
- System integration: `python test_complete_system.py`
- API clients: `python test_api_clients.py`
- ETL pipeline: `python test_etl_pipeline.py`

## Configuration Management

### Frontend Configuration
- `vitest.config.js` - Test configuration with path aliases
- `orval.config.ts` - API generation configuration
- `.env.local` - Local environment variables (never commit)

### Data Warehouse Configuration
- `config/settings.yaml` - Main configuration (API endpoints, database, export settings)
- `requirements.txt` - Python dependencies
- `Makefile` - Common tasks and workflows
- Environment variables take precedence over YAML configuration

## Development Guidelines

**CRITICAL**: Before creating any new components or modules, always check for existing implementations to avoid duplication.

### Task Management & Planning
- **Break down complex features** into smaller, manageable tasks
- **Document progress** clearly in commit messages
- **Follow established patterns** in the codebase

### Development Process
1. **Research First**: Understand existing patterns and components
2. **Plan Implementation**: Design solution following project conventions
3. **Write Tests**: Create tests before or alongside implementation
4. **Implement**: Follow established patterns and best practices
5. **Quality Check**: Run all linting and testing tools
6. **Document**: Update relevant documentation if needed

### Agent Selection Guidelines

**Database & ETL:**
- **sqlite-database-engineer-datawarehousing**: Database schema design, ETL pipeline optimization, query performance, data modeling, sync operations

**Backend Development:**
- **typescript-api-developer-express**: Express.js server setup, REST endpoints, middleware implementation, database connections, API testing
- **rest-api-designer**: API endpoint design, OpenAPI specifications, RESTful conventions, status codes, API documentation

**Frontend Development:**
- **ux-engineer**: React components, TypeScript code, UI/UX design, accessibility, responsive layouts, user interactions
- **frontend-polish-expert**: Code refinement, performance optimization, best practices, production-ready polish

**Planning & Architecture:**
- **feature-planner**: Feature planning, system architecture, implementation roadmaps, task breakdown, cross-component integration

### Access & Permission Issues
If you encounter permission/access errors:
1. **Pause immediately** and explain the specific error
2. **Provide clear steps** for resolution
3. **Do not guess** at configuration values
4. **Wait for confirmation** before proceeding

### Important Development Notes
- **Prefer editing over creating**: Modify existing code rather than creating new files
- **Follow conventions**: Use established patterns and utilities
- **Test thoroughly**: Validate all changes with appropriate tests
- **Document significant changes**: Update documentation when making architectural changes