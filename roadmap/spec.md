# Orchard9 Data Warehouse - Technical Specification

## Executive Summary

This specification defines the architecture for the Orchard9 Data Warehouse platform, a dual-database system that combines automated ETL data from Peach AI APIs with user-managed campaign metadata to deliver comprehensive marketing analytics through a unified REST API.

## System Architecture

### Three-Tier Data Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/Vite)                    │
│                   Marketing Dashboard UI                      │
└───────────────────┬─────────────────────────────────────────┘
                    │ REST API
┌───────────────────▼─────────────────────────────────────────┐
│                 Backend API (Express/TypeScript)             │
│                   Data Aggregation Layer                      │
└─────┬──────────────────────────────────┬────────────────────┘
      │                                  │
┌─────▼────────────────┐    ┌───────────▼────────────────────┐
│  Campaign Details DB  │    │    Peach AI Data Warehouse     │
│   (User-Managed)      │    │      (ETL Pipeline)            │
│    SQLite (New)       │    │      SQLite (Existing)         │
└───────────────────────┘    └────────────────────────────────┘
```

### Database Layer Overview

#### 1. **Peach AI Data Warehouse** (Existing)
- **Source**: Automated ETL pipeline from Peach AI APIs
- **Update Frequency**: Daily sync via `datawarehouse-job/`
- **Data Ownership**: System-managed, read-only for backend API
- **Primary Keys**: `campaign_id` from Peach AI

#### 2. **Campaign Details Database** (New)
- **Source**: User input through frontend interface
- **Update Frequency**: Real-time user updates
- **Data Ownership**: User-managed, read-write access
- **Foreign Keys**: References `campaign_id` from Peach AI warehouse

## Data Model

### Peach AI Data Warehouse (Existing)

#### Core Tables
```sql
-- Campaigns (from Peach AI)
campaigns (
    id INTEGER PRIMARY KEY,  -- Peach AI campaign ID
    name TEXT NOT NULL,       -- Canonical campaign name
    description TEXT,
    tracking_url TEXT,
    is_serving BOOLEAN,
    created_at TEXT,
    updated_at TEXT,
    -- other Peach AI fields...
)

-- Hourly metrics data
hourly_data (
    campaign_id INTEGER,
    unix_hour INTEGER,
    registrations INTEGER,
    sessions INTEGER,
    total_accounts INTEGER,
    converted_users INTEGER,
    -- other metrics...
    PRIMARY KEY (campaign_id, unix_hour)
)

-- Campaign hierarchy mapping
campaign_hierarchy (
    campaign_id INTEGER UNIQUE,
    network TEXT,      -- Maps to vendor concept
    domain TEXT,
    placement TEXT,
    targeting TEXT,
    special TEXT
)
```

### Campaign Details Database (New)

#### Schema Design
```sql
-- User-managed campaign details
CREATE TABLE campaign_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL UNIQUE,  -- FK to peach_ai.campaigns.id

    -- User-entered descriptive fields
    vendor TEXT,                    -- Override for display
    status TEXT DEFAULT 'Live',      -- Live, Paused, Ended
    manager TEXT,                    -- Campaign manager name
    ad_placement_domain TEXT,        -- Primary ad domain
    device TEXT,                     -- Desktop, Mobile, Both
    targeting TEXT,                  -- Geographic targeting
    rep_contact_info TEXT,          -- Vendor rep contact

    -- Campaign scheduling
    start_date DATE,                -- Campaign start date
    end_date DATE,                  -- Campaign end date

    -- Missing metrics (user-provided or calculated)
    raw_clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    order_value DECIMAL(10,2) DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    ltrev DECIMAL(10,2) DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,

    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Campaign notes
CREATE TABLE campaign_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    user TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Campaign documents
CREATE TABLE campaign_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BLOB,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by TEXT NOT NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Campaign visual media
CREATE TABLE campaign_visual_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by TEXT NOT NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Change history tracking
CREATE TABLE campaign_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    user TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);
```

## Data Sources & Field Mapping

### Field Classification

#### 1. **Peach AI Owned Fields** (Read-Only)
These fields come exclusively from the Peach AI data warehouse:

| Field | Source | Notes |
|-------|--------|-------|
| `id` | `campaigns.id` | Primary identifier |
| `name` | `campaigns.name` | Canonical campaign name |
| `description` | `campaigns.description` | Campaign description |
| `created_at` | `campaigns.created_at` | Creation timestamp |
| `updated_at` | `campaigns.updated_at` | Last update from Peach AI |

#### 2. **User-Managed Fields** (Read-Write)
These fields are stored in the campaign details database:

| Field | Table | Input Method |
|-------|-------|--------------|
| `vendor` | `campaign_details` | User selection/input |
| `status` | `campaign_details` | User selection (Live/Paused/Ended) |
| `manager` | `campaign_details` | User input |
| `ad_placement_domain` | `campaign_details` | User input |
| `device` | `campaign_details` | User selection |
| `targeting` | `campaign_details` | User input |
| `rep_contact_info` | `campaign_details` | User input |
| `start_date` | `campaign_details` | User date picker |
| `end_date` | `campaign_details` | User date picker |
| `raw_clicks` | `campaign_details` | User input or import |
| `unique_clicks` | `campaign_details` | User input or import |
| `cost` | `campaign_details` | User input |
| `order_value` | `campaign_details` | User input |
| `revenue` | `campaign_details` | User input or calculated |
| `ltrev` | `campaign_details` | User input or calculated |

#### 3. **Calculated/Aggregated Fields**
These fields are computed from Peach AI hourly data:

| Field | Calculation | Source |
|-------|-------------|--------|
| `raw_reg` | SUM(`hourly_data.registrations`) | Aggregated per campaign |
| `confirm_reg` | SUM(`hourly_data.total_accounts`) | Aggregated per campaign |
| `sales` | SUM(`hourly_data.converted_users`) | Aggregated per campaign |
| `sessions` | SUM(`hourly_data.sessions`) | Aggregated per campaign |
| `messages` | SUM(`hourly_data.messages`) | Aggregated per campaign |

## API Specification

### Backend API Endpoints

#### Campaign Management

```typescript
// GET /api/campaigns
// List all campaigns with merged data
{
  params: {
    page?: number,
    limit?: number,
    vendor?: string,
    status?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  },
  response: {
    campaigns: Campaign[],
    pagination: {
      total: number,
      page: number,
      limit: number,
      pages: number
    }
  }
}

// GET /api/campaigns/:id
// Get single campaign with all details
{
  response: Campaign
}

// POST /api/campaigns
// Create campaign details for existing Peach AI campaign
{
  body: {
    campaign_id: number,  // Must exist in Peach AI warehouse
    vendor: string,
    status: string,
    manager?: string,
    // ... other user fields
  },
  response: Campaign
}

// PUT /api/campaigns/:id
// Update user-managed campaign details
{
  body: {
    vendor?: string,
    status?: string,
    raw_clicks?: number,
    // ... other user fields
  },
  response: Campaign
}

// DELETE /api/campaigns/:id
// Soft delete (archives user data, preserves Peach AI data)
{
  response: { success: boolean }
}

// POST /api/campaigns/:id/notes
// Add note to campaign
{
  body: {
    text: string,
    user: string
  },
  response: Note
}

// POST /api/campaigns/:id/documents
// Upload document
{
  body: FormData,
  response: Document
}

// POST /api/campaigns/:id/media
// Add visual media
{
  body: {
    url: string,
    description: string,
    addedBy: string
  },
  response: VisualMedia
}
```

### Data Merge Strategy

The backend API implements a hierarchical merge strategy:

```javascript
// Pseudo-code for campaign data merge
function getCampaignData(campaignId) {
  // 1. Fetch base data from Peach AI warehouse
  const peachData = await queryPeachAIWarehouse(campaignId);

  // 2. Fetch user details if they exist
  const userDetails = await queryCampaignDetails(campaignId);

  // 3. Calculate aggregated metrics
  const metrics = await calculateMetrics(campaignId);

  // 4. Merge with priority rules
  return {
    // Always use Peach AI for core identity
    id: peachData.id,
    name: peachData.name,  // ALWAYS from Peach AI
    description: peachData.description,

    // User-managed fields (with defaults)
    vendor: userDetails?.vendor || peachData.hierarchy?.network || 'Unknown',
    status: userDetails?.status || 'Live',
    manager: userDetails?.manager || 'Unassigned',
    startDate: userDetails?.start_date || peachData.created_at,
    endDate: userDetails?.end_date || null,

    // Metrics priority: User > Calculated > Default
    metrics: {
      rawClicks: userDetails?.raw_clicks || 0,
      uniqueClicks: userDetails?.unique_clicks || 0,
      cost: userDetails?.cost || 0,
      rawReg: metrics.totalRegistrations,  // From hourly_data
      confirmReg: metrics.totalAccounts,    // From hourly_data
      sales: metrics.convertedUsers,        // From hourly_data
      orderValue: userDetails?.order_value || 0,
      revenue: userDetails?.revenue || 0,
      ltrev: userDetails?.ltrev || 0
    },

    // Related data
    notes: await getCampaignNotes(campaignId),
    documents: await getCampaignDocuments(campaignId),
    visualMedia: await getCampaignMedia(campaignId),
    history: await getCampaignHistory(campaignId)
  };
}
```

## Synchronization Strategy

### Campaign Discovery & Sync

The system maintains consistency between the Peach AI warehouse and user details through:

#### 1. **ETL Pipeline Integration**
- Runs daily via `datawarehouse-job/` cron
- Detects new campaigns in Peach AI
- Creates placeholder records in campaign_details
- Logs sync operations for audit trail

#### 2. **Automatic Placeholder Creation**
```sql
-- When new campaign detected in Peach AI
INSERT INTO campaign_details (campaign_id, status, created_by)
VALUES (?, 'Live', 'System')
ON CONFLICT (campaign_id) DO NOTHING;
```

#### 3. **Deletion Handling**
- When campaign deleted from Peach AI:
  - Keep user details for 90 days (archive)
  - Mark as `archived` in campaign_details
  - Exclude from default API queries
  - Include with `?include_archived=true` parameter

#### 4. **Conflict Resolution Rules**
| Scenario | Resolution |
|----------|------------|
| Campaign exists in Peach AI only | Return with default user values |
| Campaign exists in both | Merge per field priority rules |
| Campaign exists in details only | Return if within 90-day archive window |
| Field conflict | Peach AI wins for identity, User wins for details |

## Missing Metrics Acquisition

### Click Metrics Strategy

For `rawClicks` and `uniqueClicks` not available from Peach AI:

#### Phase 1: Manual Entry
- Frontend forms for manual metric entry
- CSV upload interface for bulk updates
- Excel import functionality

#### Phase 2: Future Integration (Planned)
- Monitor Peach AI API updates for click metrics
- Prepare migration path when available
- Design webhook system for real-time updates

### Implementation Approach
```javascript
// Backend service for metrics import
class MetricsImportService {
  async importFromCSV(file) {
    // Parse CSV with campaign_id, raw_clicks, unique_clicks
    // Validate campaign exists in Peach AI
    // Update campaign_details table
  }

  async calculateDerivedMetrics(campaignId) {
    // If clicks not provided, estimate from:
    // - Sessions (as proxy for clicks)
    // - Industry benchmarks
    // - Historical ratios
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create campaign_details database schema
- [ ] Implement basic CRUD API endpoints
- [ ] Add database connection to backend
- [ ] Create data merge service

### Phase 2: Integration (Week 2-3)
- [ ] Connect backend to both SQLite databases
- [ ] Implement aggregation queries for metrics
- [ ] Add synchronization with ETL pipeline
- [ ] Create placeholder record automation

### Phase 3: Features (Week 3-4)
- [ ] Implement notes system
- [ ] Add document upload functionality
- [ ] Create visual media management
- [ ] Build change history tracking

### Phase 4: Frontend Integration (Week 4-5)
- [ ] Update frontend to use real API
- [ ] Remove mock server dependency
- [ ] Implement metric entry forms
- [ ] Add CSV upload interface

### Phase 5: Polish & Optimization (Week 5-6)
- [ ] Add caching layer for performance
- [ ] Implement batch operations
- [ ] Create admin tools for data management
- [ ] Add comprehensive error handling

## Technical Decisions

### Why Dual Database Architecture?

1. **Separation of Concerns**
   - Peach AI data remains pristine and unmodified
   - User annotations don't interfere with ETL pipeline
   - Clear ownership boundaries

2. **Performance**
   - Optimized queries for each data type
   - No need to modify existing ETL pipeline
   - Parallel query execution possible

3. **Flexibility**
   - Easy to add new user fields without ETL changes
   - Can swap data sources independently
   - Supports gradual migration strategies

### Technology Stack Rationale

- **SQLite for Campaign Details**: Consistent with existing infrastructure
- **Express/TypeScript Backend**: Type safety for complex data merging
- **REST API**: Simple integration with existing frontend
- **File-based Storage**: Documents stored in SQLite BLOBs for simplicity

## Security Considerations

### Data Access Control
- Read-only access to Peach AI warehouse
- Write access only to campaign_details database
- API authentication via Bearer tokens
- Role-based access for sensitive operations

### Data Privacy
- PII stored only in campaign_details
- Audit logs for all modifications
- Soft deletes preserve audit trail
- Encrypted storage for sensitive fields

## Performance Requirements

### Response Time Targets
- Campaign list: < 200ms for 100 records
- Single campaign: < 100ms
- Metric aggregation: < 500ms
- Document upload: < 2s for 10MB file

### Scalability Targets
- Support 10,000+ campaigns
- Handle 100+ concurrent users
- Process 1M+ hourly data records
- Store 1000+ documents per campaign

## Monitoring & Maintenance

### Key Metrics to Track
- API response times
- Database query performance
- Sync pipeline success rate
- Storage utilization
- User engagement metrics

### Maintenance Windows
- ETL pipeline: Daily at 2 AM UTC
- Database optimization: Weekly
- Backup operations: Hourly incrementals
- Archive operations: Monthly

## Appendix

### Sample API Response

```json
{
  "id": "12345",
  "name": "Summer Campaign 2024",  // From Peach AI
  "vendor": "AdTech Solutions",     // From user details
  "status": "Live",                 // From user details
  "startDate": "2024-06-01",       // From user details
  "endDate": "2024-08-31",         // From user details
  "metrics": {
    "rawClicks": 5000,             // From user details
    "uniqueClicks": 4200,          // From user details
    "cost": 2500.00,               // From user details
    "rawReg": 450,                 // Calculated from hourly_data
    "confirmReg": 380,             // Calculated from hourly_data
    "sales": 45,                   // Calculated from hourly_data
    "orderValue": 4500.00,         // From user details
    "revenue": 2000.00,            // From user details
    "ltrev": 6000.00              // From user details
  },
  "manager": "John Smith",         // From user details
  "notes": [...],                  // From campaign_notes
  "documents": [...],              // From campaign_documents
  "visualMedia": [...],            // From campaign_visual_media
  "history": [...]                 // From campaign_history
}
```

### Migration Path for Future Peach AI Updates

When Peach AI eventually provides click metrics:

1. Add new fields to ETL pipeline
2. Create migration script to backfill historical data
3. Update merge strategy to prioritize Peach AI metrics
4. Maintain user overrides with version tracking
5. Provide UI to reconcile conflicts

## Conclusion

This specification defines a robust, scalable architecture that bridges the gap between automated ETL data and user-managed campaign information. The dual-database approach provides flexibility while maintaining data integrity, and the phased implementation ensures rapid delivery of core functionality while building toward a comprehensive marketing analytics platform.

## Milestone 2: Data Warehouse API Hooks

### Objective
Build comprehensive REST API endpoints to expose data warehouse metrics and campaign hierarchies to the backend service, enabling real-time access to ETL pipeline data for the frontend dashboard.

### Deliverables

#### 1. Core Campaign API Endpoints
- [ ] **GET /api/datawarehouse/campaigns** - List all campaigns with filtering
  - Query params: `is_serving`, `network`, `domain`, `placement`, `limit`, `offset`
  - Returns paginated campaign list with basic metadata
- [ ] **GET /api/datawarehouse/campaigns/:id** - Get single campaign details
  - Includes full campaign data and hierarchy mapping
- [ ] **GET /api/datawarehouse/campaigns/:id/metrics** - Get campaign metrics summary
  - Aggregated metrics from hourly_data table
  - Support date range filtering

#### 2. Metrics & Analytics Endpoints
- [ ] **GET /api/datawarehouse/metrics/hourly** - Hourly metrics data
  - Query params: `campaign_id`, `start_hour`, `end_hour`
  - Returns time-series data for visualization
- [ ] **GET /api/datawarehouse/metrics/aggregated** - Aggregated metrics
  - Query params: `campaign_ids[]`, `start_date`, `end_date`, `group_by`
  - Supports grouping by hour, day, week, month
- [ ] **GET /api/datawarehouse/metrics/performance** - Performance KPIs
  - Calculate conversion rates, CPA, ROI based on available metrics
  - Support comparison across campaigns

#### 3. Hierarchy & Organization Endpoints
- [ ] **GET /api/datawarehouse/hierarchy** - Complete hierarchy tree
  - Returns nested structure: Organization → Program → Campaign → Ad Set → Ad
- [ ] **GET /api/datawarehouse/organizations** - List all organizations
- [ ] **GET /api/datawarehouse/programs** - List programs with optional org filter
- [ ] **GET /api/datawarehouse/hierarchy/mapping/:campaign_id** - Get campaign hierarchy
  - Returns network, domain, placement, targeting, special fields

#### 4. Sync Status & Health Endpoints
- [ ] **GET /api/datawarehouse/sync/status** - Current sync status
  - Last successful sync, records processed, next scheduled sync
- [ ] **GET /api/datawarehouse/sync/history** - Sync operation history
  - Success/failure logs, error details, record counts
- [ ] **GET /api/datawarehouse/health** - Database health check
  - Connection status, table sizes, query performance metrics

#### 5. Export & Reporting Endpoints
- [ ] **GET /api/datawarehouse/export/csv** - Export data as CSV
  - Support filters and date ranges
  - Stream large datasets efficiently
- [ ] **POST /api/datawarehouse/export/custom** - Custom report generation
  - Accept SQL-like query parameters
  - Return formatted results in JSON/CSV

### Technical Requirements

#### Database Connection
- [ ] Implement read-only SQLite connection pool for data warehouse
- [ ] Add connection retry logic with exponential backoff
- [ ] Implement query timeout protection (max 30 seconds)
- [ ] Add database connection health monitoring

#### Query Optimization
- [ ] Create database indexes for common query patterns
- [ ] Implement query result caching with Redis/memory cache
- [ ] Add query performance logging and monitoring
- [ ] Optimize aggregation queries with materialized views where appropriate

#### API Security
- [ ] Implement API key authentication for backend-to-backend calls
- [ ] Add rate limiting (100 requests/minute per client)
- [ ] Validate and sanitize all query parameters
- [ ] Implement SQL injection protection

#### Response Format
- [ ] Standardize API response format:
  ```json
  {
    "success": true,
    "data": {...},
    "meta": {
      "timestamp": "2024-01-01T00:00:00Z",
      "query_time_ms": 45,
      "total_records": 100,
      "page": 1,
      "limit": 20
    },
    "errors": []
  }
  ```
- [ ] Implement consistent error handling with appropriate HTTP status codes
- [ ] Add response compression for large payloads

#### Documentation
- [ ] Generate OpenAPI/Swagger documentation
- [ ] Create API usage examples and code snippets
- [ ] Document rate limits and authentication requirements
- [ ] Add performance benchmarks and optimization guidelines

### Implementation Steps

1. **Week 1: Foundation**
   - Set up Express router for `/api/datawarehouse` namespace
   - Implement database connection service
   - Create base query builder with SQL injection protection
   - Add error handling middleware

2. **Week 2: Core APIs**
   - Implement campaign endpoints
   - Build metrics aggregation queries
   - Add pagination and filtering support
   - Create response serializers

3. **Week 3: Advanced Features**
   - Implement hierarchy endpoints
   - Add sync status monitoring
   - Build export functionality
   - Optimize query performance

4. **Week 4: Polish & Testing**
   - Add comprehensive test coverage
   - Implement caching layer
   - Performance testing and optimization
   - Documentation and examples

### Success Metrics
- All endpoints respond within 500ms for standard queries
- API handles 100+ concurrent requests without degradation
- 99.9% uptime for read operations
- Zero SQL injection vulnerabilities
- Complete API documentation with 95%+ coverage

### Dependencies
- Existing SQLite data warehouse database (`datawarehouse.db`)
- Express.js backend framework
- TypeScript for type safety
- Optional: Redis for caching layer

### Future Enhancements
- WebSocket support for real-time metrics updates
- GraphQL endpoint for flexible querying
- Batch operations for bulk data retrieval
- Webhook notifications for sync completions
- Advanced analytics endpoints (cohort analysis, attribution modeling)