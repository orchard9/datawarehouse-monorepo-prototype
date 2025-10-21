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
import { dataWarehouseApi } from '@/api/datawarehouse';

interface TimeBreakdownFilters {
  timeRange: 'last24h' | 'last7d' | 'last30d' | 'custom';
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
}


const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon: Icon, color, change, changeType }) => (
  <div className="rounded-lg p-6 transition-colors" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <Icon className="h-5 w-5" style={{ color }} />
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
    timeRange: (searchParams.get('timeRange') as TimeBreakdownFilters['timeRange']) || 'last30d',
    groupBy: (searchParams.get('groupBy') as TimeBreakdownFilters['groupBy']) || 'day',
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  }));

  // Hierarchy edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTierField, setSelectedTierField] = useState<string | null>(null);

  // Status update state
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.timeRange !== 'last7d') params.set('timeRange', filters.timeRange);
    if (filters.groupBy !== 'day') params.set('groupBy', filters.groupBy);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);

    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // Build metrics query from filters
  const metricsQuery = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (filters.timeRange) {
      case 'last24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'last7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (filters.startDate && filters.endDate) {
          return {
            startDate: filters.startDate,
            endDate: filters.endDate,
            groupBy: filters.groupBy,
          };
        }
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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
  const { activity, loading: activityLoading } = useCampaignActivity(campaignId);

  // Handle invalid campaign ID
  useEffect(() => {
    if (!campaignId || isNaN(campaignId)) {
      navigate('/', { replace: true });
    }
  }, [campaignId, navigate]);

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
        totalCost: 0,
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
    const totalCost = totals.sessions * 0.75; // Demo calculation
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
  }, [metrics]);


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
    setIsStatusDropdownOpen(false);

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
    { value: 'last24h', label: 'Last 24 Hours' },
    { value: 'last7d', label: 'Last 7 Days' },
    { value: 'last30d', label: 'Last 30 Days' },
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
        <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{campaign.name}</h1>

                {/* Editable Status Badge */}
                <div className="relative">
                  <button
                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                    disabled={isUpdatingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: campaign.status === 'live' ? '#10b981' : campaign.status === 'paused' ? '#6b7280' : '#9ca3af',
                      color: '#ffffff'
                    }}
                  >
                    {isUpdatingStatus ? (
                      <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : campaign.status === 'live' ? (
                      <Zap className="h-3 w-3" />
                    ) : campaign.status === 'paused' ? (
                      <ZapOff className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    <span>
                      {campaign.status === 'live' ? 'Live' : campaign.status === 'paused' ? 'Paused' : 'Unknown'}
                    </span>
                  </button>

                  {/* Status Dropdown Menu */}
                  {isStatusDropdownOpen && !isUpdatingStatus && (
                    <>
                      {/* Backdrop to close dropdown */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsStatusDropdownOpen(false)}
                      />

                      {/* Dropdown Menu */}
                      <div
                        className="absolute top-full mt-2 left-0 rounded-lg shadow-lg z-20 overflow-hidden"
                        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', minWidth: '150px' }}
                      >
                        <button
                          onClick={() => handleStatusUpdate('live')}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 transition-colors flex items-center gap-2"
                          style={{ color: 'var(--foreground)' }}
                        >
                          <Zap className="h-4 w-4 text-green-600" />
                          <span>Live</span>
                        </button>
                        <button
                          onClick={() => handleStatusUpdate('paused')}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                          style={{ color: 'var(--foreground)' }}
                        >
                          <ZapOff className="h-4 w-4 text-gray-600" />
                          <span>Paused</span>
                        </button>
                        <button
                          onClick={() => handleStatusUpdate('unknown')}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                          style={{ color: 'var(--foreground)' }}
                        >
                          <AlertCircle className="h-4 w-4 text-gray-400" />
                          <span>Unknown</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Status Update Error */}
              {statusUpdateError && (
                <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50" style={{ border: '1px solid #fecaca' }}>
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-800">Failed to update status</p>
                    <p className="text-xs text-red-700">{statusUpdateError}</p>
                  </div>
                  <button
                    onClick={() => setStatusUpdateError(null)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Enhanced KPI Cards */}
      <div id="metrics-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
          label="ROAS"
          value={`${aggregatedMetrics.roas.toFixed(2)}x`}
          icon={DollarSign}
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

      {/* Activity Log */}
      <div className="mt-8 rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--card-foreground)' }}>Recent Activity</h3>

        {activityLoading ? (
          <div className="text-center py-8">
            <div className="h-6 w-6 mx-auto mb-2 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--muted-foreground)' }} />
            <p style={{ color: 'var(--muted-foreground)' }}>Loading activity...</p>
          </div>
        ) : activity && activity.length > 0 ? (
          <div className="space-y-4">
            {activity.slice(0, 10).map((activityItem) => (
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
                      {new Date(activityItem.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    activityItem.type === 'sync' ? 'bg-blue-100 text-blue-800' :
                    activityItem.type === 'hierarchy_update' ? 'bg-green-100 text-green-800' :
                    activityItem.type === 'status_change' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {activityItem.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p style={{ color: 'var(--muted-foreground)' }}>No recent activity found</p>
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
    </div>
  );
};

export default CampaignDetailsPage;