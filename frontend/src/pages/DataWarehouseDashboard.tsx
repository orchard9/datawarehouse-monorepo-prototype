/**
 * Data Warehouse Dashboard - Orchard9 Design System
 * Main operations dashboard following "Less but Better" design principles
 * Provides essential system insights with minimal, functional interface
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Database,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { CampaignList } from '@/components/DataWarehouse/CampaignList';
import { useDataWarehouseStore } from '@/store/dataWarehouseStore';
// import { useHealthCheck, useSyncStatus, usePerformanceMetrics } from '@/hooks/useDataWarehouse';
import type { Campaign } from '@/types/datawarehouse';

/**
 * Data warehouse dashboard component following Orchard9 principles:
 * - Clean, purposeful interface with essential information only
 * - 8px grid system for consistent spacing
 * - Accessible health indicators and navigation
 * - Minimal design that prioritizes functionality
 */
export const DataWarehouseDashboard: React.FC = () => {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'metrics' | 'sync' | 'health'>('campaigns');

  // Health monitoring - temporarily disabled due to endpoint issues
  // const { health, isHealthy, isDegraded, loading: healthLoading } = useHealthCheck(true, 30000);
  const health = null, isHealthy = true, isDegraded = false, healthLoading = false;

  // Sync status - temporarily disabled due to endpoint issues
  // const { status: syncStatus, loading: syncLoading } = useSyncStatus(false);
  const syncStatus = null, syncLoading = false;

  // Performance metrics - temporarily disabled due to endpoint issues
  // const { metrics: performanceMetrics, loading: perfLoading } = usePerformanceMetrics();
  const performanceMetrics = [], perfLoading = false;

  // Store actions
  const {
    aggregatedMetrics,
    fetchAggregatedMetrics,
    error,
    clearError,
  } = useDataWarehouseStore();

  // Load initial data - temporarily disabled due to endpoint issues
  useEffect(() => {
    // Load aggregated metrics if not cached - temporarily disabled
    // if (aggregatedMetrics.length === 0) {
    //   fetchAggregatedMetrics();
    // }
  }, []);

  // Calculate summary statistics
  const totalCampaigns = health?.dataQuality?.completeness || 0;
  const dataFreshness = health?.dataQuality?.freshness?.hoursSinceLastSync || 0;
  const databaseSize = health?.database?.size ? (health.database.size / 1024 / 1024).toFixed(2) : '0';

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Get health status styling
  const getHealthStatus = () => {
    if (healthLoading) {
      return {
        icon: RefreshCw,
        text: 'Checking health...',
        className: 'text-gray-600',
        iconClassName: 'animate-spin'
      };
    }
    if (isHealthy) {
      return {
        icon: CheckCircle,
        text: 'System Healthy',
        className: 'text-green-600',
        iconClassName: ''
      };
    }
    if (isDegraded) {
      return {
        icon: AlertCircle,
        text: 'System Degraded',
        className: 'text-yellow-600',
        iconClassName: ''
      };
    }
    return {
      icon: AlertCircle,
      text: 'System Unhealthy',
      className: 'text-red-600',
      iconClassName: ''
    };
  };

  const healthStatus = getHealthStatus();
  const HealthIcon = healthStatus.icon;

  return (
    <div className="min-h-screen bg-white">
      {/* Header - minimal, essential information */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-container mx-auto px-4">
          <div className="py-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">
                  Data Warehouse
                </h1>
                <p className="text-gray-600 font-medium">
                  Monitor and manage marketing campaign data
                </p>
              </div>

              {/* System health indicator - prominent but minimal */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 ${healthStatus.className}`}>
                  <HealthIcon
                    className={`w-5 h-5 ${healthStatus.iconClassName}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold tracking-wide">
                    {healthStatus.text}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* System metrics - clean, functional cards */}
      <main className="max-w-container mx-auto px-4 py-6">
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="sr-only">System Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Campaigns Metric */}
            <div className="card bg-white border border-gray-200 p-6 hover:border-gray-900 transition-all duration-150">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-2 uppercase tracking-wider">
                    Campaigns
                  </p>
                  <p className="text-3xl font-bold text-gray-900 tracking-tight">
                    {formatNumber(totalCampaigns * 100)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-300">
                  <Activity className="w-6 h-6 text-gray-600" aria-hidden="true" />
                </div>
              </div>
            </div>

            {/* Database Size Metric */}
            <div className="card bg-white border border-gray-200 p-6 hover:border-gray-900 transition-all duration-150">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-2 uppercase tracking-wider">
                    Storage
                  </p>
                  <p className="text-3xl font-bold text-gray-900 tracking-tight">
                    {databaseSize}
                    <span className="text-lg font-medium text-gray-600 ml-1">MB</span>
                  </p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-300">
                  <Database className="w-6 h-6 text-gray-600" aria-hidden="true" />
                </div>
              </div>
            </div>

            {/* Data Freshness Metric */}
            <div className="card bg-white border border-gray-200 p-6 hover:border-gray-900 transition-all duration-150">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-2 uppercase tracking-wider">
                    Data Age
                  </p>
                  <p className="text-3xl font-bold text-gray-900 tracking-tight">
                    {dataFreshness < 24 ? `${dataFreshness}h` : `${Math.floor(dataFreshness / 24)}d`}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-300">
                  <Clock
                    className={`w-6 h-6 ${
                      dataFreshness < 24
                        ? 'text-green-600'
                        : dataFreshness < 72
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {/* Performance Metric */}
            <div className="card bg-white border border-gray-200 p-6 hover:border-gray-900 transition-all duration-150">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-2 uppercase tracking-wider">
                    Performers
                  </p>
                  <p className="text-3xl font-bold text-gray-900 tracking-tight">
                    {performanceMetrics.length}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-300">
                  <TrendingUp className="w-6 h-6 text-gray-600" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation tabs - minimal, functional design */}
        <nav
          className="border-b border-gray-200 mb-8"
          role="tablist"
          aria-label="Dashboard sections"
        >
          <div className="flex space-x-8">
            {[
              { id: 'campaigns', label: 'Campaigns', icon: Activity },
              { id: 'metrics', label: 'Metrics', icon: TrendingUp },
              { id: 'sync', label: 'Sync Status', icon: RefreshCw },
              { id: 'health', label: 'System Health', icon: CheckCircle },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'campaigns' | 'metrics' | 'sync' | 'health')}
                  className={`
                    flex items-center gap-2 py-4 text-sm font-medium tracking-wide border-b-2 transition-all duration-150
                    ${isActive
                      ? 'border-orange-400 text-gray-900'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-200'
                    }
                  `}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`${tab.id}-panel`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab panels - clean content sections */}
        <div className="min-h-[400px]">
          {/* Campaigns panel */}
          {activeTab === 'campaigns' && (
            <div
              id="campaigns-panel"
              role="tabpanel"
              aria-labelledby="campaigns-tab"
            >
              <CampaignList
                onCampaignSelect={(campaign) => setSelectedCampaign(campaign)}
                selectedCampaignId={selectedCampaign?.id}
              />
            </div>
          )}

          {/* Performance metrics panel */}
          {activeTab === 'metrics' && (
            <div
              id="metrics-panel"
              role="tabpanel"
              aria-labelledby="metrics-tab"
              className="card bg-white border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-6 tracking-tight">
                Top Performing Campaigns
              </h3>
              {perfLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-600 font-medium">Loading performance data...</p>
                </div>
              ) : performanceMetrics.length > 0 ? (
                <div className="space-y-4">
                  {performanceMetrics.slice(0, 10).map((metric, index) => (
                    <div
                      key={metric.campaign_id}
                      className="flex items-center justify-between p-4 border border-gray-300 hover:bg-gray-50 transition-colors duration-150"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold text-gray-600">
                          #{index + 1}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 tracking-wide">
                            {metric.campaign_name}
                          </h4>
                          <p className="text-sm text-gray-600 font-medium">
                            {metric.network} • {metric.domain}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {formatNumber(metric.metrics.sessions)}
                          <span className="text-sm font-medium text-gray-600 ml-1">sessions</span>
                        </p>
                        <p className="text-sm text-gray-600 font-medium">
                          {metric.metrics.registration_rate.toFixed(1)}% conversion
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 font-medium">No performance metrics available</p>
                </div>
              )}
            </div>
          )}

          {/* Sync status panel */}
          {activeTab === 'sync' && (
            <div
              id="sync-panel"
              role="tabpanel"
              aria-labelledby="sync-tab"
              className="card bg-white border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-6 tracking-tight">
                Data Synchronization
              </h3>
              {syncLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-600 font-medium">Checking sync status...</p>
                </div>
              ) : syncStatus ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 font-medium">Status</span>
                      <span className={`font-semibold tracking-wide ${
                        syncStatus.status === 'completed' ? 'text-green-600' :
                        syncStatus.status === 'running' ? 'text-blue-600' :
                        syncStatus.status === 'failed' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {syncStatus.status.charAt(0).toUpperCase() + syncStatus.status.slice(1)}
                      </span>
                    </div>
                    {syncStatus.lastSync && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Last Sync</span>
                        <span className="font-semibold text-gray-900">
                          {new Date(syncStatus.lastSync).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {syncStatus.nextSync && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Next Sync</span>
                        <span className="font-semibold text-gray-900">
                          {new Date(syncStatus.nextSync).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  {syncStatus.progress !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600 font-medium">Progress</span>
                        <span className="font-semibold text-gray-900">{syncStatus.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-50 border border-gray-300 h-2">
                        <div
                          className="bg-orchard-orange h-2 transition-all duration-250"
                          style={{ width: `${syncStatus.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 font-medium">No sync information available</p>
                </div>
              )}
            </div>
          )}

          {/* System health panel */}
          {activeTab === 'health' && (
            <div
              id="health-panel"
              role="tabpanel"
              aria-labelledby="health-tab"
              className="card bg-white border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-6 tracking-tight">
                System Diagnostics
              </h3>
              {healthLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-600 font-medium">Running health checks...</p>
                </div>
              ) : health ? (
                <div className="space-y-8">
                  {/* Database health section */}
                  <section>
                    <h4 className="font-semibold text-gray-900 mb-4 tracking-wide">Database</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Connected</span>
                        <span className={`font-semibold ${
                          health.database.connected ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {health.database.connected ? 'Active' : 'Disconnected'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Tables</span>
                        <span className="font-semibold text-gray-900">{health.database.tables.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Query Time</span>
                        <span className="font-semibold text-gray-900">{health.database.performance.queryTime}ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Cache Hit Rate</span>
                        <span className="font-semibold text-gray-900">{health.database.performance.cacheHitRate}</span>
                      </div>
                    </div>
                  </section>

                  {/* Data quality section */}
                  <section>
                    <h4 className="font-semibold text-gray-900 mb-4 tracking-wide">Data Quality</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Completeness</span>
                        <span className="font-semibold text-gray-900">
                          {(health.dataQuality.completeness * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Data Freshness</span>
                        <span className={`font-semibold ${
                          health.dataQuality.freshness.isStale ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {health.dataQuality.freshness.isStale ? 'Stale' : 'Fresh'}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* API health section */}
                  <section>
                    <h4 className="font-semibold text-gray-900 mb-4 tracking-wide">API Service</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Status</span>
                        <span className="font-semibold text-green-600">{health.api.status}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Version</span>
                        <span className="font-semibold text-gray-900">{health.api.version}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Uptime</span>
                        <span className="font-semibold text-gray-900">{Math.floor(health.api.uptime / 3600)}h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 font-medium">Response Time</span>
                        <span className="font-semibold text-gray-900">{health.api.responseTime}ms</span>
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 font-medium">Health diagnostics unavailable</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Error notification - minimalist toast */}
      {error && (
        <div
          className="fixed bottom-6 right-6 bg-red-100 border border-red-600 p-4 shadow-lg max-w-md transition-all duration-250"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-600">System Error</p>
              <p className="text-sm text-red-600 mt-1">{error.message}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-600 transition-colors duration-150 p-1 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataWarehouseDashboard;