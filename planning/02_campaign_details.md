# Campaign Details Page - Comprehensive Planning Document

## Feature Overview
A detailed view for individual campaigns that users can navigate to from the dashboard, providing deep insights into campaign performance, metrics analysis, and hierarchical context. This page follows the same design patterns as the MarketingDashboard component while focusing on a single campaign's comprehensive data.

## Requirements Analysis

### Functional Requirements
- Display comprehensive campaign information with key metrics
- Provide performance charts specific to individual campaign
- Show hourly/daily/weekly performance breakdown
- Display ad sets and individual ads within the campaign hierarchy
- Show campaign settings and configuration details
- Include activity log/history for campaign changes
- Support export functionality for campaign-specific data
- Enable navigation between related campaigns in hierarchy

### Non-functional Requirements
- Load performance under 2 seconds for campaign details
- Support offline viewing of cached campaign data
- Responsive design for mobile and desktop
- Accessibility compliance with WCAG 2.1 AA
- SEO-friendly URLs with campaign slugs

### Affected Components
- **Frontend**: New CampaignDetailsPage component, routing updates
- **Backend**: Campaign detail endpoint enhancements
- **Datawarehouse**: No changes required - existing schema supports all needs

### Dependencies
- Existing useCampaign and useCampaignMetrics hooks
- Campaign hierarchy data from useCampaigns
- React Router for URL routing
- Recharts for campaign-specific visualizations

### Success Criteria
- Users can access campaign details via direct URL
- Campaign metrics load within 2 seconds
- Charts display campaign performance trends clearly
- Users can export campaign-specific data
- Mobile experience maintains full functionality

## Technical Design

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend React App                     │
├─────────────────────────────────────────────────────────────┤
│  CampaignDetailsPage                                        │
│  ├── CampaignHeader (breadcrumb, actions)                  │
│  ├── CampaignOverview (key metrics)                        │
│  ├── PerformanceCharts (time series, comparisons)          │
│  ├── TimeBreakdown (hourly/daily/weekly toggle)            │
│  ├── HierarchyContext (ad sets, ads)                       │
│  ├── CampaignSettings (configuration)                      │
│  └── ActivityLog (history)                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                         HTTP Requests
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Express Backend API                     │
├─────────────────────────────────────────────────────────────┤
│  GET /api/campaigns/:id/details                             │
│  GET /api/campaigns/:id/metrics                             │
│  GET /api/campaigns/:id/hierarchy                           │
│  GET /api/campaigns/:id/activity                            │
│  POST /api/campaigns/:id/export                             │
└─────────────────────────────────────────────────────────────┘
                              │
                        SQLite Queries
                              │
┌─────────────────────────────────────────────────────────────┐
│                     SQLite Database                        │
├─────────────────────────────────────────────────────────────┤
│  campaigns (base data)                                      │
│  hourly_data (metrics by hour)                             │
│  campaign_hierarchy (hierarchy mapping)                    │
│  sync_history (activity log)                               │
└─────────────────────────────────────────────────────────────┘
```

### Components

#### Frontend Changes
- **New Route**: `/campaigns/:id` in App.tsx
- **CampaignDetailsPage**: Main container component following MarketingDashboard patterns
- **Sub-components**: Modular sections for reusability
- **URL Sync**: Campaign ID in URL, filters in query params
- **State Management**: Zustand store for campaign details state

#### Backend Changes
- **Campaign Details Endpoint**: Enhanced data aggregation
- **Metrics Endpoint**: Time-series data with grouping options
- **Hierarchy Endpoint**: Related campaigns and ad structure
- **Activity Endpoint**: Change history and sync logs

#### Datawarehouse Changes
- **No Schema Changes**: Existing tables support all requirements
- **Query Optimization**: Add indexes for campaign detail queries
- **Export Enhancement**: Campaign-specific export filters

### Data Model

#### Database Changes
```sql
-- Optimize existing queries with new indexes
CREATE INDEX IF NOT EXISTS idx_hourly_data_campaign_time ON hourly_data(campaign_id, unix_hour);
CREATE INDEX IF NOT EXISTS idx_campaign_hierarchy_lookup ON campaign_hierarchy(campaign_id, network, domain);
CREATE INDEX IF NOT EXISTS idx_sync_history_campaign ON sync_history(sync_timestamp);
```

#### API Contracts
```typescript
// GET /api/campaigns/:id/details
interface CampaignDetailsResponse {
  campaign: Campaign & {
    hierarchy: CampaignHierarchy;
    relatedCampaigns: Campaign[];
    totalMetrics: CampaignMetrics;
  };
  meta: {
    lastUpdated: string;
    dataPoints: number;
    hierarchyLevel: string;
  };
}

// GET /api/campaigns/:id/metrics?groupBy=hour&startDate=...&endDate=...
interface CampaignMetricsResponse {
  campaign: Pick<Campaign, 'id' | 'name' | 'slug'>;
  metrics: HourlyMetrics[];
  aggregated: {
    total: CampaignMetrics;
    breakdown: Record<string, CampaignMetrics>; // by day/week/month
    trends: {
      sessionsGrowth: number;
      registrationGrowth: number;
      conversionGrowth: number;
    };
  };
  meta: PaginationMeta;
}

// GET /api/campaigns/:id/hierarchy
interface CampaignHierarchyResponse {
  campaign: Campaign;
  hierarchy: {
    organization: string;
    program: string;
    campaign: string;
    adSets: Array<{
      id: string;
      name: string;
      targeting: string;
      metrics: CampaignMetrics;
    }>;
    ads: Array<{
      id: string;
      name: string;
      creative: string;
      metrics: CampaignMetrics;
    }>;
  };
  relatedCampaigns: Campaign[];
}

// GET /api/campaigns/:id/activity
interface CampaignActivityResponse {
  campaign: Pick<Campaign, 'id' | 'name'>;
  activity: Array<{
    id: number;
    timestamp: string;
    type: 'sync' | 'hierarchy_update' | 'status_change' | 'metrics_update';
    description: string;
    details: Record<string, unknown>;
  }>;
  meta: PaginationMeta;
}
```

#### Type Definitions
```typescript
// Enhanced campaign state for details page
interface CampaignDetailsState {
  campaign: Campaign | null;
  metrics: HourlyMetrics[];
  hierarchy: CampaignHierarchyResponse['hierarchy'] | null;
  activity: CampaignActivityResponse['activity'];
  relatedCampaigns: Campaign[];
  loading: {
    campaign: boolean;
    metrics: boolean;
    hierarchy: boolean;
    activity: boolean;
  };
  error: ApiError | null;
  filters: {
    timeRange: 'last24h' | 'last7d' | 'last30d' | 'custom';
    groupBy: 'hour' | 'day' | 'week';
    startDate?: string;
    endDate?: string;
  };
}

// URL route parameters
interface CampaignDetailsParams {
  id: string; // Campaign ID
}
```

### Integration Points
- **Peach AI API**: No direct integration needed (data flows through ETL)
- **SQLite Database**: Enhanced query patterns for detail views
- **Google Sheets Export**: Campaign-specific export functionality
- **Browser Navigation**: Deep linking with campaign ID and filter state

## Implementation Plan

### Phase 1: Backend API Enhancement (2-3 days)
- [ ] Create campaign details aggregation endpoint (Size: L)
- [ ] Implement campaign metrics time-series endpoint (Size: L)
- [ ] Build campaign hierarchy lookup endpoint (Size: M)
- [ ] Add campaign activity log endpoint (Size: M)
- [ ] Create campaign-specific export endpoint (Size: M)
- [ ] Add database indexes for performance (Size: S)
- [ ] Write API endpoint tests (Size: M)

### Phase 2: Frontend Core Implementation (3-4 days)
- [ ] Create CampaignDetailsPage main component (Size: XL)
- [ ] Implement campaign overview section (Size: L)
- [ ] Build performance charts components (Size: L)
- [ ] Create time breakdown controls (Size: M)
- [ ] Implement hierarchy context display (Size: L)
- [ ] Add URL routing for campaign details (Size: M)
- [ ] Create campaign details hooks (Size: L)
- [ ] Wire up Zustand state management (Size: M)

### Phase 3: Advanced Features & Polish (2-3 days)
- [ ] Implement campaign settings section (Size: M)
- [ ] Build activity log display (Size: M)
- [ ] Add export functionality for campaign data (Size: M)
- [ ] Create responsive design for mobile (Size: L)
- [ ] Implement error boundaries and loading states (Size: M)
- [ ] Add breadcrumb navigation (Size: S)
- [ ] Write component tests with Vitest (Size: L)
- [ ] Performance optimization and caching (Size: M)

## Component Structure

### CampaignDetailsPage Layout
```tsx
const CampaignDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const campaignId = parseInt(id || '0');

  // Hooks following established patterns
  const { campaign, loading: campaignLoading, error } = useCampaign(campaignId);
  const { metrics, loading: metricsLoading } = useCampaignMetrics(campaignId, query);
  const { hierarchy } = useCampaignHierarchy(campaignId);
  const { activity } = useCampaignActivity(campaignId);

  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Breadcrumb Navigation */}
      <CampaignBreadcrumb campaign={campaign} />

      {/* Campaign Overview - Key Metrics */}
      <CampaignOverview campaign={campaign} metrics={aggregatedMetrics} />

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <PerformanceChart type="sessions" data={chartData} />
        <PerformanceChart type="conversions" data={chartData} />
      </div>

      {/* Time Breakdown Controls */}
      <TimeBreakdownSection
        metrics={metrics}
        groupBy={filters.groupBy}
        onGroupByChange={updateGroupBy}
      />

      {/* Hierarchy Context */}
      <HierarchySection hierarchy={hierarchy} relatedCampaigns={relatedCampaigns} />

      {/* Campaign Settings */}
      <CampaignSettings campaign={campaign} />

      {/* Activity Log */}
      <ActivityLog activity={activity} />
    </div>
  );
};
```

### Key Sub-Components

#### CampaignOverview
```tsx
interface CampaignOverviewProps {
  campaign: Campaign | null;
  metrics: CampaignMetrics | null;
}

const CampaignOverview: React.FC<CampaignOverviewProps> = ({ campaign, metrics }) => {
  // KPI Cards similar to MarketingDashboard but campaign-specific
  const kpiCards = [
    { label: 'Total Sessions', value: metrics?.totalSessions, icon: MousePointer, color: '#3b82f6' },
    { label: 'Registrations', value: metrics?.totalRegistrations, icon: Users, color: '#10b981' },
    { label: 'Conversions', value: metrics?.totalConvertedUsers, icon: ShoppingCart, color: '#8b5cf6' },
    { label: 'Registration Rate', value: `${metrics?.registrationRate}%`, icon: TrendingUp, color: '#f59e0b' },
  ];

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
        {campaign?.name || 'Loading...'}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map(card => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
};
```

#### PerformanceChart
```tsx
interface PerformanceChartProps {
  type: 'sessions' | 'conversions' | 'revenue' | 'cost';
  data: HourlyMetrics[];
  timeRange: string;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ type, data, timeRange }) => {
  const chartData = useMemo(() => {
    return data.map(d => ({
      time: formatTimeByRange(d.unix_hour, timeRange),
      value: d[type] || 0,
    }));
  }, [data, type, timeRange]);

  return (
    <div className="rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)' }}>
      <h3 className="text-lg font-semibold mb-4">{getChartTitle(type)}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          {/* Chart configuration following MarketingDashboard patterns */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

### State Management Approach

#### Zustand Store Extension
```typescript
interface CampaignDetailsStore {
  // Campaign details state
  selectedCampaignDetails: CampaignDetailsState | null;

  // Actions
  fetchCampaignDetails: (campaignId: number) => Promise<void>;
  setCampaignDetailsFilters: (filters: Partial<CampaignDetailsState['filters']>) => void;
  clearCampaignDetails: () => void;
}

// Add to existing dataWarehouseStore.ts
const useCampaignDetailsStore = create<CampaignDetailsStore>()(
  devtools((set, get) => ({
    selectedCampaignDetails: null,

    fetchCampaignDetails: async (campaignId: number) => {
      set({ loading: { ...get().loading, campaign: true } });
      try {
        const [campaign, metrics, hierarchy, activity] = await Promise.all([
          dataWarehouseApi.campaigns.getDetails(campaignId),
          dataWarehouseApi.campaigns.getMetrics(campaignId),
          dataWarehouseApi.campaigns.getHierarchy(campaignId),
          dataWarehouseApi.campaigns.getActivity(campaignId),
        ]);

        set({
          selectedCampaignDetails: {
            campaign: campaign.campaign,
            metrics: metrics.metrics,
            hierarchy: hierarchy.hierarchy,
            activity: activity.activity,
            relatedCampaigns: campaign.relatedCampaigns,
            loading: { campaign: false, metrics: false, hierarchy: false, activity: false },
            error: null,
            filters: get().selectedCampaignDetails?.filters || {
              timeRange: 'last7d',
              groupBy: 'day',
            },
          },
        });
      } catch (error) {
        set({ error: error as ApiError });
      }
    },

    // ... other actions
  }))
);
```

### URL Routing Considerations

#### Route Configuration
```typescript
// In App.tsx
<Routes>
  <Route path="/" element={<MarketingDashboard />} />
  <Route path="/campaigns/:id" element={<CampaignDetailsPage />} />
  <Route path="/campaigns/:id/edit" element={<CampaignEditPage />} />
  <Route path="/datawarehouse" element={<DataWarehouseDashboard />} />
  {/* ... other routes */}
</Routes>
```

#### URL Synchronization
```typescript
// Custom hook for campaign details URL sync
export function useCampaignDetailsUrlSync(campaignId: number) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useCampaignDetailsStore(state => state.selectedCampaignDetails?.filters);
  const setFilters = useCampaignDetailsStore(state => state.setCampaignDetailsFilters);

  // Sync filters to URL params (timeRange, groupBy, startDate, endDate)
  useEffect(() => {
    if (filters) {
      const params = new URLSearchParams();
      if (filters.timeRange !== 'last7d') params.set('timeRange', filters.timeRange);
      if (filters.groupBy !== 'day') params.set('groupBy', filters.groupBy);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      setSearchParams(params, { replace: true });
    }
  }, [filters, setSearchParams]);

  // Initialize filters from URL on mount
  useEffect(() => {
    const initialFilters = {
      timeRange: (searchParams.get('timeRange') as any) || 'last7d',
      groupBy: (searchParams.get('groupBy') as any) || 'day',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };
    setFilters(initialFilters);
  }, [campaignId]); // Reset when campaign changes

  return { filters, setFilters };
}
```

### Data Fetching Patterns

#### Custom Hooks Following Established Patterns
```typescript
// Enhanced useCampaign hook for details page
export function useCampaignDetails(campaignId: number | null) {
  const [details, setDetails] = useState<CampaignDetailsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!campaignId) return;

    setLoading(true);
    setError(null);

    try {
      // Parallel fetch for better performance
      const [campaignRes, metricsRes, hierarchyRes, activityRes] = await Promise.all([
        dataWarehouseApi.campaigns.getDetails(campaignId),
        dataWarehouseApi.campaigns.getMetrics(campaignId),
        dataWarehouseApi.campaigns.getHierarchy(campaignId),
        dataWarehouseApi.campaigns.getActivity(campaignId),
      ]);

      setDetails({
        campaign: campaignRes.campaign,
        metrics: metricsRes.metrics,
        hierarchy: hierarchyRes.hierarchy,
        activity: activityRes.activity,
        relatedCampaigns: campaignRes.relatedCampaigns,
        loading: { campaign: false, metrics: false, hierarchy: false, activity: false },
        error: null,
        filters: {
          timeRange: 'last7d',
          groupBy: 'day',
        },
      });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return { details, loading, error, refetch: fetchDetails };
}
```

## Design System Integration

### CSS Variables Usage
Following the established semantic color system:

```css
/* Campaign Details specific styles */
.campaign-details-header {
  background-color: var(--surface-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.campaign-metric-card {
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--content-primary);
}

.campaign-metric-card:hover {
  border-color: var(--border-default);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.campaign-status-badge {
  background-color: var(--semantic-success-bg);
  color: var(--semantic-success);
}

.campaign-chart-container {
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
}

.campaign-breadcrumb {
  color: var(--content-secondary);
}

.campaign-breadcrumb-active {
  color: var(--content-primary);
  font-weight: 600;
}
```

### Component Classes
```css
/* Following established button patterns */
.btn-campaign-export {
  @apply btn-secondary;
}

.btn-campaign-edit {
  @apply btn-primary;
}

/* Campaign-specific cards */
.card-campaign-overview {
  @apply card;
  padding: 2rem;
}

.card-campaign-metric {
  @apply card;
  padding: 1.5rem;
  transition: all var(--timing-fast) var(--ease-out);
}

.card-campaign-metric:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
```

## Risk Assessment

### SQLite Performance
- **Risk**: Large datasets may slow detail queries
- **Mitigation**: Add targeted indexes, implement query optimization
- **Monitoring**: Log query performance, alert on slow queries

### Data Synchronization
- **Risk**: Stale data in campaign details view
- **Mitigation**: Implement cache invalidation, show last updated timestamp
- **Fallback**: Manual refresh button for users

### Memory Usage
- **Risk**: Loading full campaign history may consume excessive memory
- **Mitigation**: Implement pagination for activity logs, lazy load chart data
- **Optimization**: Virtual scrolling for large datasets

### Navigation Performance
- **Risk**: Slow transitions between campaigns
- **Mitigation**: Preload related campaign data, implement route caching
- **UX**: Show loading states during transitions

## Testing Strategy

### Frontend Testing
```typescript
// Component tests with Vitest and React Testing Library
describe('CampaignDetailsPage', () => {
  it('loads campaign data on mount', async () => {
    const mockCampaign = createMockCampaign();
    render(<CampaignDetailsPage />, {
      initialEntries: [`/campaigns/${mockCampaign.id}`]
    });

    expect(screen.getByText('Loading campaign details...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(mockCampaign.name)).toBeInTheDocument();
    });
  });

  it('displays performance charts', async () => {
    // Test chart rendering with mock data
  });

  it('handles campaign not found', async () => {
    // Test error states
  });
});

// Hook testing
describe('useCampaignDetails', () => {
  it('fetches campaign details on mount', async () => {
    const { result } = renderHook(() => useCampaignDetails(123));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.details).not.toBeNull();
    });
  });
});
```

### Backend Testing
```typescript
describe('Campaign Details API', () => {
  describe('GET /api/campaigns/:id/details', () => {
    it('returns campaign with metrics and hierarchy', async () => {
      const response = await request(app)
        .get('/api/campaigns/123/details')
        .expect(200);

      expect(response.body.campaign).toBeDefined();
      expect(response.body.campaign.hierarchy).toBeDefined();
      expect(response.body.campaign.totalMetrics).toBeDefined();
    });

    it('handles non-existent campaign', async () => {
      await request(app)
        .get('/api/campaigns/999999/details')
        .expect(404);
    });
  });
});
```

### Integration Testing
```typescript
describe('Campaign Details Integration', () => {
  it('flows from dashboard to details page', async () => {
    // Test complete user flow
    render(<App />);

    // Click campaign in dashboard
    const campaignRow = screen.getByTestId('campaign-row-123');
    fireEvent.click(campaignRow);

    // Verify navigation to details page
    await waitFor(() => {
      expect(screen.getByText('Campaign Details')).toBeInTheDocument();
    });

    // Verify data loading
    await waitFor(() => {
      expect(screen.getByText('Performance Charts')).toBeInTheDocument();
    });
  });
});
```

## Estimated Timeline

### Phase 1: Backend Setup (2-3 days)
- Day 1: Campaign details and metrics endpoints
- Day 2: Hierarchy and activity endpoints
- Day 3: Database optimization and testing

### Phase 2: Core Frontend (3-4 days)
- Day 1: Main component structure and routing
- Day 2: Campaign overview and metrics display
- Day 3: Performance charts implementation
- Day 4: State management and data integration

### Phase 3: Advanced Features (2-3 days)
- Day 1: Hierarchy display and related campaigns
- Day 2: Activity log and campaign settings
- Day 3: Export functionality and mobile optimization

### Phase 4: Polish & Testing (1-2 days)
- Day 1: Component testing and bug fixes
- Day 2: Performance optimization and documentation

**Total Estimated Timeline**: 8-12 days

## Key Success Metrics

### Performance Metrics
- Initial page load under 2 seconds
- Chart rendering under 1 second
- Smooth navigation between campaigns
- Responsive design on all devices

### User Experience Metrics
- Intuitive navigation flow from dashboard
- Clear data visualization
- Accessible design compliance
- Mobile-friendly interface

### Technical Metrics
- 95%+ test coverage for new components
- Zero console errors in production
- Proper error boundaries and fallbacks
- SEO-friendly URL structure

This comprehensive campaign details page will provide users with deep insights into individual campaign performance while maintaining consistency with the existing Orchard9 design system and architectural patterns.