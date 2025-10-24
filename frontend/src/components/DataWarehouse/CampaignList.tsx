/**
 * Campaign List Component - Orchard9 Design System
 * Clean, functional list interface following "Less but Better" principles
 * Prioritizes content over decoration with purposeful interactions
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';
import { useCampaigns } from '@/hooks/useDataWarehouse';
import { CampaignCard } from './CampaignCard';
import type { Campaign, CampaignQuery } from '@/types/datawarehouse';

interface CampaignListProps {
  onCampaignSelect?: (campaign: Campaign) => void;
  selectedCampaignId?: number;
}

/**
 * Campaign list component following Orchard9 principles:
 * - Minimal, purposeful interface design
 * - 8px grid spacing throughout
 * - Accessible search and filtering
 * - Clean typography and clear hierarchy
 */
export const CampaignList: React.FC<CampaignListProps> = ({
  onCampaignSelect,
  selectedCampaignId,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<CampaignQuery>({
    limit: 12,
    includeMetrics: true,
    includeHierarchy: true,
  });

  const [query, setQuery] = useState<CampaignQuery>(localFilters);
  const {
    campaigns,
    meta,
    loading,
    error,
    fetchCampaigns,
  } = useCampaigns(query);

  const nextPage = useCallback(() => {
    if (meta?.hasNext) {
      setQuery(prev => ({ ...prev, page: (prev.page || 1) + 1 }));
    }
  }, [meta]);

  const prevPage = useCallback(() => {
    if (meta?.hasPrev) {
      setQuery(prev => ({ ...prev, page: Math.max(1, (prev.page || 2) - 1) }));
    }
  }, [meta]);


  // Handle search with Enter key or explicit search
  const handleSearch = useCallback(() => {
    setQuery({
      ...localFilters,
      search: searchTerm,
      page: 1,
    });
  }, [searchTerm, localFilters, setQuery]);

  // Handle filter state changes
  const handleFilterChange = (key: keyof CampaignQuery, value: unknown) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Apply filters and close filter panel
  const applyFilters = () => {
    setQuery({
      ...localFilters,
      search: searchTerm,
      page: 1,
    });
    setShowFilters(false);
  };

  // Clear all filters and search
  const clearFilters = () => {
    setLocalFilters({ limit: 12, includeMetrics: true, includeHierarchy: true });
    setSearchTerm('');
    setShowFilters(false);
  };


  // Force initial load of campaigns
  useEffect(() => {
    console.log('CampaignList mounted, query:', query);
    console.log('Campaigns length:', campaigns.length);
    if (campaigns.length === 0) {
      console.log('Calling fetchCampaigns with query:', query);
      fetchCampaigns(query);
    }
  }, [fetchCampaigns, query, campaigns.length]);

  return (
    <div className="w-full space-y-8">
      {/* Header section - minimal and purposeful */}
      <header>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
          Campaigns
        </h1>
        <p className="text-gray-600 font-medium">
          Manage and analyze campaign performance
        </p>
      </header>

      {/* Search and controls - clean, functional layout */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search input - minimal design */}
          <div className="flex-1 min-w-[320px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:border-orange-400 transition-all duration-150"
                aria-label="Search campaigns"
              />
              <Search
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Action buttons - minimal Nike-inspired design */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/campaigns/new')}
              className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-3 transition-colors duration-150 inline-flex items-center gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Create new campaign"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">New Campaign</span>
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary inline-flex items-center gap-2"
              aria-label={showFilters ? 'Hide filters' : 'Show filters'}
              aria-expanded={showFilters}
            >
              <Filter className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Filters</span>
            </button>

          </div>
        </div>

        {/* Filter panel - minimal, functional design */}
        {showFilters && (
          <div
            className="bg-gray-50 border border-gray-200 p-6 transition-all duration-250"
            role="region"
            aria-labelledby="filter-panel-title"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 id="filter-panel-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                Filter Campaigns
              </h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
                aria-label="Close filters"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Status filter */}
              <div>
                <label
                  htmlFor="status-filter"
                  className="block text-sm font-medium text-gray-600 mb-2 uppercase tracking-wide"
                >
                  Status
                </label>
                <select
                  id="status-filter"
                  value={localFilters.isServing === true ? 'active' : localFilters.isServing === false ? 'inactive' : 'all'}
                  onChange={(e) => handleFilterChange('isServing',
                    e.target.value === 'all' ? undefined : e.target.value === 'active'
                  )}
                  className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all duration-150"
                >
                  <option value="all">All Campaigns</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              {/* Network filter */}
              <div>
                <label
                  htmlFor="network-filter"
                  className="block text-sm font-medium text-gray-600 mb-2 uppercase tracking-wide"
                >
                  Network
                </label>
                <select
                  id="network-filter"
                  value={localFilters.network || ''}
                  onChange={(e) => handleFilterChange('network', e.target.value || undefined)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all duration-150"
                >
                  <option value="">All Networks</option>
                  <option value="google">Google</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="native">Native</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              {/* Sort filter */}
              <div>
                <label
                  htmlFor="sort-filter"
                  className="block text-sm font-medium text-gray-600 mb-2 uppercase tracking-wide"
                >
                  Sort By
                </label>
                <select
                  id="sort-filter"
                  value={localFilters.orderBy || 'created_at'}
                  onChange={(e) => handleFilterChange('orderBy', e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all duration-150"
                >
                  <option value="created_at">Date Created</option>
                  <option value="name">Campaign Name</option>
                  <option value="sessions">Total Sessions</option>
                  <option value="registrations">Total Conversions</option>
                </select>
              </div>
            </div>

            {/* Filter actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={clearFilters}
                className="btn-secondary"
                aria-label="Clear all filters"
              >
                Clear All
              </button>
              <button
                onClick={applyFilters}
                className="btn-primary"
                aria-label="Apply selected filters"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Results summary - clean information */}
        {meta && (
          <div className="text-sm text-gray-600 font-medium">
            Showing {((meta.page - 1) * meta.limit) + 1} - {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} campaigns
          </div>
        )}
      </section>

      {/* Error state - clear communication */}
      {error && (
        <div
          className="bg-red-100 border border-red-600 p-6 transition-all duration-150"
          role="alert"
          aria-live="polite"
        >
          <p className="text-red-600 font-medium">
            Error loading campaigns: {error.message}
          </p>
        </div>
      )}

      {/* Loading state - minimal skeletons */}
      {loading && campaigns.length === 0 && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          aria-label="Loading campaigns"
        >
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-50 border border-gray-300 h-64 animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Campaign grid - clean layout following 8px grid */}
      {!loading || campaigns.length > 0 ? (
        <main
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          role="grid"
          aria-label="Campaign list"
        >
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onClick={onCampaignSelect}
              selected={campaign.id === selectedCampaignId}
            />
          ))}
        </main>
      ) : null}

      {/* Empty state - helpful messaging */}
      {!loading && campaigns.length === 0 && !error && (
        <div className="text-center py-16" role="status">
          <p className="text-gray-600 font-medium text-lg">
            No campaigns found
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}

      {/* Pagination - minimal, functional design */}
      {meta && meta.totalPages > 1 && (
        <nav
          className="flex justify-center items-center gap-4 pt-8"
          role="navigation"
          aria-label="Campaign pagination"
        >
          <button
            onClick={prevPage}
            disabled={!meta.hasPrev}
            className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Go to previous page"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            <span>Previous</span>
          </button>

          <span
            className="text-sm text-gray-600 font-medium px-4"
            aria-current="page"
          >
            Page {meta.page} of {meta.totalPages}
          </span>

          <button
            onClick={nextPage}
            disabled={!meta.hasNext}
            className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Go to next page"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
};

export default CampaignList;