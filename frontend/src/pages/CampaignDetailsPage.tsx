/**
 * Campaign Details Page
 * Comprehensive campaign view with metrics, charts, and hierarchy context
 * Follows MarketingDashboard patterns with URL-synced state management
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  MousePointer,
  Users,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Clock,
  DollarSign,
  ZapOff,
  Zap,
  XCircle,
  Edit3,
  Save,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useCampaign, useCampaignMetrics, useCampaignActivity } from '@/hooks/useDataWarehouse';
import { HierarchyEditModal } from '@/components/HierarchyEditModal';
import { CostEditModal } from '@/components/CostEditModal';
import { AccountManagerSection } from '@/components/AccountManagerSection';
import { CampaignInformationCard } from '@/components/CampaignInformationCard';
import { dataWarehouseApi } from '@/api/datawarehouse';
import type { CostOverride } from '@/types/datawarehouse';

interface TimeBreakdownFilters {
  timeRange: 'alltime' | 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last30days' | 'last90days' | 'custom';
  groupBy: 'hour' | 'day' | 'week';
  startDate?: string;
  endDate?: string;
}

interface ChartDataPoint {
  time: string;
  sessions: number;
  registrations: number;
  conversions: number;
  hour: number;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  badge?: {
    text: string;
    variant: 'estimated' | 'confirmed' | 'api_sourced';
  };
  onClick?: () => void;
}


const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon: Icon, color, change, changeType, badge, onClick }) => (
  <div
    className={`rounded-lg p-6 transition-colors ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            badge.variant === 'estimated' ? 'bg-muted text-muted-foreground' :
            badge.variant === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          }`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Icon className="h-5 w-5" style={{ color }} />
        {onClick && <Edit3 className="h-4 w-4 opacity-50" style={{ color: 'var(--muted-foreground)' }} />}
      </div>
    </div>
    <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </div>
    {change && changeType && (
      <div className={`flex items-center text-xs mt-2`} style={{
        color: changeType === 'positive' ? '#10b981' :
               changeType === 'negative' ? '#ef4444' :
               'var(--muted-foreground)'
      }}>
        {changeType === 'positive' ? (
          <TrendingUp className="h-3 w-3 mr-1" />
        ) : changeType === 'negative' ? (
          <TrendingDown className="h-3 w-3 mr-1" />
        ) : null}
        <span>{change}</span>
      </div>
    )}
  </div>
);


const CampaignDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = parseInt(id || '0');

  // URL-synced filters
  const [filters, setFilters] = useState<TimeBreakdownFilters>(() => ({
    timeRange: (searchParams.get('timeRange') as TimeBreakdownFilters['timeRange']) || 'last30days',
    groupBy: (searchParams.get('groupBy') as TimeBreakdownFilters['groupBy']) || 'day',
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  }));

  // Hierarchy edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTierField, setSelectedTierField] = useState<string | null>(null);

  // Cost edit modal state
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);

  // Status update state (used by CampaignInformationCard)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  // Activity pagination
  const [activityPage, setActivityPage] = useState(1);

  // Cost history state
  const [costHistory, setCostHistory] = useState<CostOverride[]>([]);
  const [costHistoryLoading, setCostHistoryLoading] = useState(false);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.timeRange !== 'last30days') params.set('timeRange', filters.timeRange);
    if (filters.groupBy !== 'day') params.set('groupBy', filters.groupBy);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);

    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // Build metrics query from filters
  const metricsQuery = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    // Handle 'alltime' - no date filtering
    if (filters.timeRange === 'alltime') {
      return {
        groupBy: filters.groupBy,
      };
    }

    // Handle custom date range
    if (filters.timeRange === 'custom') {
      if (filters.startDate && filters.endDate) {
        return {
          startDate: filters.startDate,
          endDate: filters.endDate,
          groupBy: filters.groupBy,
        };
      }
      // Fallback if custom is selected but no dates provided
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      // Handle predefined date ranges
      switch (filters.timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          break;
        case 'last7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last14days':
          startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          break;
        case 'last30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'last90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    return {
      startDate: startDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD format
      endDate: now.toISOString().split('T')[0], // Convert to YYYY-MM-DD format
      groupBy: filters.groupBy,
    };
  }, [filters]);

  // Fetch campaign and metrics data
  const { campaign, loading: campaignLoading, error: campaignError, refetch: refetchCampaign } = useCampaign(campaignId);
  const { metrics, loading: metricsLoading } = useCampaignMetrics(campaignId, metricsQuery);
  const { activity, meta: activityMeta, loading: activityLoading } = useCampaignActivity(
    campaignId,
    activityPage,
    5,
    ['cost_update', 'cost_delete'] // Exclude cost activities since they're shown in Cost History
  );

  // Handle invalid campaign ID
  useEffect(() => {
    if (!campaignId || isNaN(campaignId)) {
      navigate('/', { replace: true });
    }
  }, [campaignId, navigate]);

  // Fetch cost history
  const fetchCostHistory = useCallback(async () => {
    if (!campaignId) return;

    setCostHistoryLoading(true);
    try {
      const response = await dataWarehouseApi.campaigns.getCostHistory(campaignId, 20);
      setCostHistory(response.data?.history || []);
    } catch (error) {
      console.error('Failed to fetch cost history:', error);
      setCostHistory([]);
    } finally {
      setCostHistoryLoading(false);
    }
  }, [campaignId]);

  // Load cost history on mount and when campaign changes
  useEffect(() => {
    fetchCostHistory();
  }, [fetchCostHistory]);

  // Prepare chart data
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!metrics || metrics.length === 0) return [];

    return metrics
      .sort((a, b) => a.unix_hour - b.unix_hour)
      .map((metric) => {
        const date = new Date(metric.unix_hour * 1000 * 3600);
        let timeLabel: string;

        switch (filters.groupBy) {
          case 'hour': {
            timeLabel = date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            break;
          }
          case 'day': {
            timeLabel = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });
            break;
          }
          case 'week': {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            timeLabel = `Week of ${weekStart.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            })}`;
            break;
          }
          default: {
            timeLabel = date.toLocaleDateString();
          }
        }

        return {
          time: timeLabel,
          sessions: metric.sessions || 0,
          registrations: metric.registrations || 0,
          conversions: metric.converted_users || 0,
          hour: metric.unix_hour,
        };
      });
  }, [metrics, filters.groupBy]);

  // Calculate aggregated metrics
  const aggregatedMetrics = useMemo(() => {
    if (!metrics || metrics.length === 0) {
      return {
        totalSessions: 0,
        totalRegistrations: 0,
        totalConversions: 0,
        registrationRate: 0,
        conversionRate: 0,
        totalRevenue: 0,
        totalCost: campaign?.cost || 0,
        roas: 0,
      };
    }

    const totals = metrics.reduce((acc, metric) => ({
      sessions: acc.sessions + (metric.sessions || 0),
      registrations: acc.registrations + (metric.registrations || 0),
      conversions: acc.conversions + (metric.converted_users || 0),
    }), { sessions: 0, registrations: 0, conversions: 0 });

    const registrationRate = totals.sessions > 0 ? (totals.registrations / totals.sessions) * 100 : 0;
    const conversionRate = totals.sessions > 0 ? (totals.conversions / totals.sessions) * 100 : 0;
    const totalRevenue = totals.conversions * 25.50; // Demo calculation
    const totalCost = campaign?.cost || 0; // Use actual cost from campaign
    const roas = totalCost > 0 ? totalRevenue / totalCost : 0;

    return {
      totalSessions: totals.sessions,
      totalRegistrations: totals.registrations,
      totalConversions: totals.conversions,
      registrationRate,
      conversionRate,
      totalRevenue,
      totalCost,
      roas,
    };
  }, [metrics, campaign]);


  // Update filter handlers
  const updateFilter = useCallback(<K extends keyof TimeBreakdownFilters>(
    key: K,
    value: TimeBreakdownFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Hierarchy edit handlers
  const handleTierCardClick = useCallback((tierField: string) => {
    setSelectedTierField(tierField);
    setIsEditModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedTierField(null);
  }, []);

  const handleSaveHierarchy = useCallback(async (data: {
    network?: string;
    domain?: string;
    placement?: string;
    targeting?: string;
    special?: string;
    override_reason?: string;
    overridden_by: string;
  }) => {
    if (!campaignId) return;

    try {
      // Call API to save hierarchy override
      await dataWarehouseApi.campaigns.updateHierarchyOverride(campaignId, data);

      // Refresh campaign data to show updated hierarchy
      await refetchCampaign();
    } catch (error) {
      throw error;
    }
  }, [campaignId, refetchCampaign]);

  // Status update handler
  const handleStatusUpdate = useCallback(async (newStatus: 'live' | 'paused' | 'unknown') => {
    if (!campaignId) return;

    setIsUpdatingStatus(true);
    setStatusUpdateError(null);

    try {
      await dataWarehouseApi.campaigns.updateCampaignStatus(campaignId, { status: newStatus });

      // Refresh campaign data to show updated status
      await refetchCampaign();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update campaign status';
      setStatusUpdateError(errorMessage);
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [campaignId, refetchCampaign]);

  // Cost update handlers
  const handleSaveCost = useCallback(async (data: {
    cost: number;
    cost_status: 'confirmed' | 'api_sourced';
    start_date: string;
    end_date: string;
    billing_period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
    override_reason?: string;
    overridden_by: string;
  }) => {
    if (!campaignId) return;

    try {
      // Call API to save cost override
      await dataWarehouseApi.campaigns.updateCampaignCost(campaignId, data);

      // Refresh campaign data to show updated cost
      await refetchCampaign();

      // Refresh cost history to show new entry
      await fetchCostHistory();
    } catch (error) {
      throw error;
    }
  }, [campaignId, refetchCampaign, fetchCostHistory]);

  const handleDeleteCost = useCallback(async () => {
    if (!campaignId) return;

    try {
      // Call API to delete cost override
      await dataWarehouseApi.campaigns.deleteCostOverride(campaignId, { overridden_by: 'user' });

      // Refresh campaign data to show reverted cost
      await refetchCampaign();

      // Refresh cost history to show deletion
      await fetchCostHistory();
    } catch (error) {
      throw error;
    }
  }, [campaignId, refetchCampaign, fetchCostHistory]);

  // Account manager update handler
  const handleUpdateAccountManager = useCallback(async (manager: string | null) => {
    if (!campaignId) return;

    try {
      await dataWarehouseApi.campaigns.updateAccountManager(campaignId, manager);
      // Refresh campaign data to show updated manager
      await refetchCampaign();
    } catch (error) {
      throw error;
    }
  }, [campaignId, refetchCampaign]);

  // Contact info update handler
  const handleUpdateContactInfo = useCallback(async (contactInfo: string | null) => {
    if (!campaignId) return;

    try {
      await dataWarehouseApi.campaigns.updateContactInfo(campaignId, contactInfo);
      // Refresh campaign data to show updated contact info
      await refetchCampaign();
    } catch (error) {
      throw error;
    }
  }, [campaignId, refetchCampaign]);


  // Loading and error states
  if (campaignLoading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center">
          <div className="h-8 w-8 mx-auto mb-4 rounded-full border-2 border-t-transparent border-blue-600 animate-spin" />
          <p style={{ color: 'var(--muted-foreground)' }}>Loading campaign details...</p>
        </div>
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center rounded-lg p-8" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <div className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Campaign Not Found</div>
          <p className="mb-6" style={{ color: 'var(--muted-foreground)' }}>
            {campaignError?.message || 'The requested campaign could not be found.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  const timeRangeOptions = [
    { value: 'alltime', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last14days', label: 'Last 14 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'last90days', label: 'Last 90 Days' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const groupByOptions = [
    { value: 'hour', label: 'Hourly' },
    { value: 'day', label: 'Daily' },
    { value: 'week', label: 'Weekly' },
  ];

  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Enhanced Breadcrumb and Header */}
      <div className="mb-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </button>
          <ChevronRight className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Campaign Details</span>
        </div>

        {/* Campaign Hierarchy */}
        {campaign.hierarchy && (
          <div className="mb-6 rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--card-foreground)' }}>Campaign Hierarchy</h3>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <span>Confidence:</span>
                <span className={`px-2 py-1 rounded font-medium ${
                  campaign.hierarchy.mapping_confidence >= 0.9 ? 'bg-green-100 text-green-800' :
                  campaign.hierarchy.mapping_confidence >= 0.7 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {(campaign.hierarchy.mapping_confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Network */}
              <button
                onClick={() => handleTierCardClick('network')}
                className="rounded-lg p-4 text-left hover:shadow-md transition-all cursor-pointer"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
              >
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  1. Network
                </label>
                <div className="flex items-center gap-2">
                  {(() => {
                    const getNetworkColor = (network: string): { bg: string; text: string } => {
                      const colors: Record<string, { bg: string; text: string }> = {
                        'Facebook': { bg: '#1877F2', text: '#ffffff' },
                        'Instagram': { bg: '#E4405F', text: '#ffffff' },
                        'Google': { bg: '#4285F4', text: '#ffffff' },
                        'TikTok': { bg: '#000000', text: '#ffffff' },
                        'LinkedIn': { bg: '#0A66C2', text: '#ffffff' },
                        'Twitter': { bg: '#1DA1F2', text: '#ffffff' },
                        'Pinterest': { bg: '#E60023', text: '#ffffff' },
                        'Snapchat': { bg: '#FFFC00', text: '#000000' },
                        'YouTube': { bg: '#FF0000', text: '#ffffff' },
                        'Reddit': { bg: '#FF4500', text: '#ffffff' },
                        'Unknown': { bg: '#6B7280', text: '#ffffff' },
                      };
                      return colors[network] || colors['Unknown'];
                    };
                    const { bg, text } = getNetworkColor(campaign.hierarchy!.network);
                    return (
                      <span
                        className="px-3 py-1.5 text-sm font-medium rounded"
                        style={{ backgroundColor: bg, color: text }}
                      >
                        {campaign.hierarchy!.network}
                      </span>
                    );
                  })()}
                  <Edit3 className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--muted-foreground)' }} />
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
                  Advertising platform or vendor
                </p>
              </button>

              {/* Domain */}
              <button
                onClick={() => handleTierCardClick('domain')}
                className="rounded-lg p-4 text-left hover:shadow-md transition-all cursor-pointer"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
              >
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  2. Domain
                </label>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {campaign.hierarchy.domain}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Campaign category or type
                </p>
              </button>

              {/* Placement */}
              <button
                onClick={() => handleTierCardClick('placement')}
                className="rounded-lg p-4 text-left hover:shadow-md transition-all cursor-pointer"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
              >
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  3. Placement
                </label>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {campaign.hierarchy.placement}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Ad placement format
                </p>
              </button>

              {/* Targeting */}
              <button
                onClick={() => handleTierCardClick('targeting')}
                className="rounded-lg p-4 text-left hover:shadow-md transition-all cursor-pointer"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
              >
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  4. Targeting
                </label>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {campaign.hierarchy.targeting}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Target audience segment
                </p>
              </button>

              {/* Special */}
              <button
                onClick={() => handleTierCardClick('special')}
                className="rounded-lg p-4 text-left hover:shadow-md transition-all cursor-pointer"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
              >
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  5. Special
                </label>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {campaign.hierarchy.special}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Special classification
                </p>
              </button>
            </div>

            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <span>
                  Last updated: {new Date(campaign.hierarchy.updated_at).toLocaleString()}
                </span>
                <span>
                  Campaign ID: {campaign.hierarchy.campaign_id}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Campaign Header */}
        <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{campaign.name}</h1>
        </div>

        {/* Account Manager Section */}
        <AccountManagerSection
          campaignId={campaignId}
          accountManager={campaign.account_manager}
          onUpdate={handleUpdateAccountManager}
        />

        {/* Campaign Information Card */}
        <div className="mt-6">
          <CampaignInformationCard
            campaignId={campaignId}
            status={campaign.status}
            contactInfo={campaign.contact_info_credentials}
            onUpdateStatus={handleStatusUpdate}
            onUpdateContactInfo={handleUpdateContactInfo}
            isUpdatingStatus={isUpdatingStatus}
            statusError={statusUpdateError}
          />
        </div>
      </div>


      {/* Enhanced KPI Cards */}
      <div id="metrics-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <KpiCard
          label="Total Sessions"
          value={aggregatedMetrics.totalSessions}
          icon={MousePointer}
          color="#3b82f6"
          change="+12.5% from previous period"
          changeType="positive"
        />
        <KpiCard
          label="Registrations"
          value={aggregatedMetrics.totalRegistrations}
          icon={Users}
          color="#10b981"
          change="+8.2% from previous period"
          changeType="positive"
        />
        <KpiCard
          label="Conversions"
          value={aggregatedMetrics.totalConversions}
          icon={ShoppingCart}
          color="#8b5cf6"
          change="-2.3% from previous period"
          changeType="negative"
        />
        <KpiCard
          label="Cost"
          value={`$${aggregatedMetrics.totalCost.toFixed(2)}`}
          icon={DollarSign}
          color="#ec4899"
          badge={campaign?.cost_status ? {
            text: campaign.cost_status === 'estimated' ? 'Estimated' :
                  campaign.cost_status === 'confirmed' ? 'Confirmed' : 'API',
            variant: campaign.cost_status
          } : undefined}
          onClick={() => setIsCostModalOpen(true)}
        />
        <KpiCard
          label="ROAS"
          value={`${aggregatedMetrics.roas.toFixed(2)}x`}
          icon={TrendingUp}
          color="#f59e0b"
          change="+5.7% from previous period"
          changeType="positive"
        />
      </div>

      {/* Time Controls */}
      <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Time Range</label>
            <select
              value={filters.timeRange}
              onChange={(e) => updateFilter('timeRange', e.target.value as TimeBreakdownFilters['timeRange'])}
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Group By</label>
            <select
              value={filters.groupBy}
              onChange={(e) => updateFilter('groupBy', e.target.value as TimeBreakdownFilters['groupBy'])}
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
            >
              {groupByOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {filters.timeRange === 'custom' && (
            <>
              <div className="w-40">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Start Date</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => updateFilter('startDate', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                />
              </div>
              <div className="w-40">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>End Date</label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => updateFilter('endDate', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sessions Over Time */}
        <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--card-foreground)' }}>Sessions Over Time</h3>
            <Clock className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          {metricsLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-blue-600 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="time"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: 'var(--foreground)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Conversion Funnel */}
        <div className="rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--card-foreground)' }}>Conversion Funnel</h3>
            <BarChart3 className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          {metricsLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-blue-600 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                {
                  name: 'Sessions',
                  value: aggregatedMetrics.totalSessions,
                  color: '#3b82f6'
                },
                {
                  name: 'Registrations',
                  value: aggregatedMetrics.totalRegistrations,
                  color: '#10b981'
                },
                {
                  name: 'Conversions',
                  value: aggregatedMetrics.totalConversions,
                  color: '#8b5cf6'
                },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: 'var(--foreground)',
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {[
                    {
                      name: 'Sessions',
                      value: aggregatedMetrics.totalSessions,
                      color: '#3b82f6'
                    },
                    {
                      name: 'Registrations',
                      value: aggregatedMetrics.totalRegistrations,
                      color: '#10b981'
                    },
                    {
                      name: 'Conversions',
                      value: aggregatedMetrics.totalConversions,
                      color: '#8b5cf6'
                    },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>


      {/* Campaign Information */}
      <div className="rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--card-foreground)' }}>Campaign Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Description</label>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{campaign.description || 'No description available'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Tracking URL</label>
            <p className="text-sm font-mono truncate" style={{ color: 'var(--foreground)' }}>{campaign.tracking_url}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Created</label>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{new Date(campaign.created_at).toLocaleDateString()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Last Updated</label>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{new Date(campaign.updated_at).toLocaleDateString()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Last Sync</label>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{new Date(campaign.sync_timestamp).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Cost History */}
      <div className="mt-8 rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--card-foreground)' }}>Cost History</h3>

        {costHistoryLoading ? (
          <div className="text-center py-8">
            <div className="h-6 w-6 mx-auto mb-2 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--muted-foreground)' }} />
            <p style={{ color: 'var(--muted-foreground)' }}>Loading cost history...</p>
          </div>
        ) : costHistory && costHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Date Range</th>
                  <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Cost</th>
                  <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Billing Period</th>
                  <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Reason</th>
                  <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Modified By</th>
                  <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Modified At</th>
                  <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Active</th>
                </tr>
              </thead>
              <tbody>
                {costHistory.map((historyItem) => (
                  <tr
                    key={historyItem.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--foreground)' }}>
                      <div className="flex flex-col">
                        <span className="font-medium">{new Date(historyItem.start_date).toLocaleDateString()}</span>
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          to {new Date(historyItem.end_date).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      ${historyItem.cost.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--foreground)' }}>
                      <span className="capitalize">{historyItem.billing_period}</span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        historyItem.cost_status === 'confirmed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                        {historyItem.cost_status === 'confirmed' ? 'Confirmed' : 'API'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {historyItem.override_reason || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--foreground)' }}>
                      {historyItem.overridden_by}
                    </td>
                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(historyItem.overridden_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {historyItem.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--muted-foreground)' }} />
            <p style={{ color: 'var(--muted-foreground)' }}>No cost history available</p>
            <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
              Cost changes will appear here once you update the campaign cost
            </p>
          </div>
        )}
      </div>

      {/* Campaign Activity Log */}
      <div className="mt-8 rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--card-foreground)' }}>Campaign Activity</h3>

        {activityLoading ? (
          <div className="text-center py-8">
            <div className="h-6 w-6 mx-auto mb-2 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--muted-foreground)' }} />
            <p style={{ color: 'var(--muted-foreground)' }}>Loading activity...</p>
          </div>
        ) : activity && activity.length > 0 ? (
          <>
            <div className="space-y-4">
              {activity.map((activityItem) => (
                <div
                  key={activityItem.id}
                  className="flex items-start gap-3 p-4 rounded-lg"
                  style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
                >
                  <div className="w-2 h-2 rounded-full mt-2 bg-blue-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{activityItem.description}</span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(activityItem.created_at).toLocaleString()}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      activityItem.activity_type === 'sync' ? 'bg-blue-100 text-blue-800' :
                      activityItem.activity_type === 'hierarchy_update' ? 'bg-green-100 text-green-800' :
                      activityItem.activity_type === 'status_change' ? 'bg-yellow-100 text-yellow-800' :
                      activityItem.activity_type === 'cost_update' ? 'bg-purple-100 text-purple-800' :
                      activityItem.activity_type === 'cost_delete' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {activityItem.activity_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {activityMeta && activityMeta.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                  disabled={!activityMeta.hasPrev}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: activityMeta.hasPrev ? 'var(--primary)' : 'var(--muted)',
                    color: activityMeta.hasPrev ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  Previous
                </button>
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Page {activityMeta.page} of {activityMeta.totalPages} ({activityMeta.total} total)
                </span>
                <button
                  onClick={() => setActivityPage(prev => Math.min(activityMeta.totalPages, prev + 1))}
                  disabled={!activityMeta.hasNext}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: activityMeta.hasNext ? 'var(--primary)' : 'var(--muted)',
                    color: activityMeta.hasNext ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p style={{ color: 'var(--muted-foreground)' }}>No campaign activity found</p>
            <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
              Syncs, hierarchy updates, and status changes will appear here
            </p>
          </div>
        )}
      </div>

      {/* Hierarchy Edit Modal */}
      {campaign?.hierarchy && (
        <HierarchyEditModal
          isOpen={isEditModalOpen}
          onClose={handleModalClose}
          campaignId={campaignId}
          currentHierarchy={{
            network: campaign.hierarchy.network,
            domain: campaign.hierarchy.domain,
            placement: campaign.hierarchy.placement,
            targeting: campaign.hierarchy.targeting,
            special: campaign.hierarchy.special,
          }}
          onSave={handleSaveHierarchy}
        />
      )}

      {/* Cost Edit Modal */}
      <CostEditModal
        isOpen={isCostModalOpen}
        onClose={() => setIsCostModalOpen(false)}
        campaignId={campaignId}
        currentCost={campaign.cost || 0}
        currentCostStatus={campaign.cost_status || 'estimated'}
        firstActivityDate={campaign.first_activity_date || undefined}
        lastActivityDate={campaign.last_activity_date || undefined}
        onSave={handleSaveCost}
        onDelete={campaign.cost_status !== 'estimated' ? handleDeleteCost : undefined}
      />
    </div>
  );
};

export default CampaignDetailsPage;