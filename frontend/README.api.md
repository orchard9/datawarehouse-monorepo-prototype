# Data Warehouse Frontend API Integration

## 🚀 Overview

The frontend provides a comprehensive API integration layer for the Orchard9 Data Warehouse, built with React, TypeScript, and modern state management.

## 📁 Architecture

```
src/
├── api/                    # API client and services
│   ├── client.ts          # Axios client with interceptors
│   ├── datawarehouse.ts   # All data warehouse endpoints
│   └── index.ts           # Central exports
├── types/
│   └── datawarehouse.ts   # TypeScript type definitions
├── hooks/
│   └── useDataWarehouse.ts # React hooks for API calls
├── store/
│   └── dataWarehouseStore.ts # Zustand global state
├── components/DataWarehouse/
│   ├── CampaignCard.tsx   # Campaign display component
│   ├── CampaignList.tsx   # Campaign list with filtering
│   └── index.ts           # Component exports
└── pages/
    └── DataWarehouseDashboard.tsx # Main dashboard page
```

## 🔧 Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env.local
# Edit .env.local with your API settings
```

3. **Start development server:**
```bash
npm run dev
```

## 📚 API Client

### Base Configuration
- **Base URL**: Configured via `VITE_API_BASE_URL` environment variable
- **Timeout**: 30 seconds
- **Retry Logic**: Automatic retry for 5xx errors (max 3 attempts)
- **Request Tracking**: Automatic request ID generation
- **Error Handling**: Standardized error responses

### Available APIs

#### Campaign API
```typescript
import { campaignApi } from '@/api/datawarehouse';

// List campaigns with filters
const campaigns = await campaignApi.list({
  page: 1,
  limit: 20,
  isServing: true,
  includeMetrics: true
});

// Get single campaign
const campaign = await campaignApi.getById(123);

// Get campaign metrics
const metrics = await campaignApi.getMetrics(123);

// Search campaigns
const results = await campaignApi.search('keyword');
```

#### Metrics API
```typescript
import { metricsApi } from '@/api/datawarehouse';

// Get hourly metrics
const hourlyData = await metricsApi.getHourly({
  campaignIds: [1, 2, 3],
  groupBy: 'hour'
});

// Get aggregated metrics
const aggregated = await metricsApi.getAggregated();

// Get performance rankings
const topPerformers = await metricsApi.getPerformance({
  limit: 10
});
```

#### Health API
```typescript
import { healthApi } from '@/api/datawarehouse';

// System health check
const health = await healthApi.check();

// Database health
const dbHealth = await healthApi.getDatabaseHealth();
```

## 🪝 React Hooks

### useCampaigns
```typescript
import { useCampaigns } from '@/hooks/useDataWarehouse';

function CampaignList() {
  const {
    campaigns,      // Campaign array
    meta,           // Pagination metadata
    loading,        // Loading state
    error,          // Error state
    query,          // Current query
    setQuery,       // Update query
    fetchCampaigns, // Manual fetch
    nextPage,       // Navigate to next page
    prevPage        // Navigate to previous page
  } = useCampaigns({
    limit: 20,
    includeMetrics: true
  });
}
```

### useCampaign
```typescript
import { useCampaign } from '@/hooks/useDataWarehouse';

function CampaignDetail({ campaignId }) {
  const {
    campaign,
    loading,
    error,
    refetch
  } = useCampaign(campaignId);
}
```

### useHealthCheck
```typescript
import { useHealthCheck } from '@/hooks/useDataWarehouse';

function HealthMonitor() {
  const {
    health,
    isHealthy,
    isDegraded,
    loading,
    error,
    refetch
  } = useHealthCheck(
    true,  // Auto-refresh
    30000  // Refresh interval (ms)
  );
}
```

## 🗄️ State Management (Zustand)

### Store Structure
```typescript
interface DataWarehouseState {
  // Data
  campaigns: Campaign[];
  selectedCampaign: Campaign | null;
  campaignMetrics: Record<number, HourlyMetrics[]>;
  aggregatedMetrics: AggregatedMetrics[];
  performanceMetrics: PerformanceMetrics[];
  hierarchy: HierarchyNode[];
  hierarchyStats: HierarchyStats | null;
  syncStatus: SyncStatus | null;
  syncHistory: SyncHistory[];
  healthCheck: HealthCheck | null;

  // UI State
  isLoading: boolean;
  error: ApiError | null;
  filters: CampaignQuery;
  pagination: PaginationMeta | null;
}
```

### Using the Store
```typescript
import { useDataWarehouseStore } from '@/store/dataWarehouseStore';

function Component() {
  // Get state and actions
  const {
    campaigns,
    fetchCampaigns,
    selectCampaign,
    isLoading,
    error
  } = useDataWarehouseStore();

  // Or use specific selectors
  const campaigns = useCampaigns();
  const selectedCampaign = useSelectedCampaign();
  const metrics = useCampaignMetrics(campaignId);
}
```

## 🎨 Components

### CampaignCard
Displays individual campaign information with metrics and hierarchy.

```tsx
import { CampaignCard } from '@/components/DataWarehouse';

<CampaignCard
  campaign={campaign}
  onClick={handleSelect}
  selected={isSelected}
/>
```

### CampaignList
Complete campaign list with search, filtering, and pagination.

```tsx
import { CampaignList } from '@/components/DataWarehouse';

<CampaignList
  onCampaignSelect={handleSelect}
  selectedCampaignId={selectedId}
/>
```

## 📊 Dashboard

The main dashboard provides:
- **Campaign Management**: Browse, search, and filter campaigns
- **Metrics Visualization**: View performance metrics and trends
- **Health Monitoring**: Real-time system health status
- **Sync Management**: Monitor data synchronization status
- **Export Capabilities**: Export data in various formats

Access at: `http://localhost:37950/datawarehouse`

## 🔐 Error Handling

All API errors follow this structure:
```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

Common error codes:
- `NETWORK_ERROR`: Network connection failed
- `TIMEOUT`: Request timed out
- `HTTP_4XX`: Client errors
- `HTTP_5XX`: Server errors
- `DATABASE_OPERATION_FAILED`: Database errors

## ⚡ Performance Optimizations

1. **Request Caching**: 5-minute cache for frequently accessed data
2. **Automatic Retries**: Exponential backoff for failed requests
3. **Debounced Search**: Prevents excessive API calls during typing
4. **Lazy Loading**: Components load data on demand
5. **State Persistence**: Filters and selections persist across sessions

## 🧪 Testing

```bash
# Run type checks
npm run typecheck

# Run linting
npm run lint

# Check for circular dependencies
npm run circular

# Analyze bundle size
npm run analyze:size
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | API base URL | `http://localhost:37951` |
| `VITE_ENABLE_EXPORT` | Enable export features | `true` |
| `VITE_ENABLE_SYNC_TRIGGER` | Enable manual sync trigger | `true` |
| `VITE_ENABLE_HEALTH_MONITORING` | Enable health monitoring | `true` |
| `VITE_CACHE_DURATION` | Cache duration (ms) | `300000` |
| `VITE_HEALTH_CHECK_INTERVAL` | Health check interval (ms) | `30000` |
| `VITE_SYNC_STATUS_INTERVAL` | Sync status interval (ms) | `5000` |

## 🚀 Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 📦 Bundle Analysis

```bash
# Generate bundle visualization
npm run analyze:size

# Check dependency complexity
npm run complexity

# Generate dependency graph
npm run analyze:deps
```

## 🎯 Best Practices

1. **Use Hooks**: Prefer hooks over direct API calls for automatic state management
2. **Handle Loading States**: Always show loading indicators during API calls
3. **Error Boundaries**: Wrap components in error boundaries for graceful error handling
4. **Cache Wisely**: Use store caching for frequently accessed, slowly changing data
5. **Optimize Renders**: Use React.memo and useMemo for expensive computations
6. **Type Safety**: Always define types for API responses and component props

## 📌 Quick Start Example

```tsx
import React from 'react';
import { useCampaigns } from '@/hooks/useDataWarehouse';
import { CampaignCard } from '@/components/DataWarehouse';

export function QuickExample() {
  const { campaigns, loading, error } = useCampaigns({
    limit: 10,
    includeMetrics: true
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="grid grid-cols-2 gap-4">
      {campaigns.map(campaign => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          onClick={() => console.log('Selected:', campaign)}
        />
      ))}
    </div>
  );
}
```

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Add proper error handling
3. Update types when adding new API endpoints
4. Write hooks for new API operations
5. Update documentation for new features