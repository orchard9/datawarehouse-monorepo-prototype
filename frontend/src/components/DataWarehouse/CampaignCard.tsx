/**
 * Campaign Card Component - Orchard9 Design System
 * Minimalist card following "Less but Better" principles
 * Every element serves a purpose, no decorative elements
 */

import React from 'react';
import { TrendingUp, TrendingDown, Users, Target } from 'lucide-react';
import type { Campaign } from '@/types/datawarehouse';

interface CampaignCardProps {
  campaign: Campaign;
  onClick?: (campaign: Campaign) => void;
  selected?: boolean;
}

/**
 * Campaign card component following Orchard9 design principles:
 * - 8px grid alignment for all spacing
 * - Minimalist Nike-inspired aesthetics
 * - Functional beauty with purposeful interactions
 * - Accessible design with proper ARIA attributes
 */
export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  onClick,
  selected = false
}) => {
  const registrationRate = campaign.metrics?.registrationRate || 0;
  const isHighPerforming = registrationRate > 5;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPercentage = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

  return (
    <article
      className="transition-all duration-150 cursor-pointer focus-within:ring-2 focus-within:ring-offset-2"
      style={{
        backgroundColor: 'var(--surface-elevated)',
        border: selected ? '1px solid var(--interactive-default)' : '1px solid var(--border-subtle)',
        borderColor: selected ? 'var(--interactive-default)' : 'var(--border-subtle)'
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
        }
      }}
      onClick={() => onClick?.(campaign)}
      role="button"
      tabIndex={0}
      aria-labelledby={`campaign-title-${campaign.id}`}
      aria-describedby={`campaign-details-${campaign.id}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(campaign);
        }
      }}
    >
      {/* Campaign header - essential information only */}
      <header className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3
              id={`campaign-title-${campaign.id}`}
              className="text-lg font-semibold truncate tracking-tight"
              style={{ color: 'var(--content-primary)' }}
            >
              {campaign.name}
            </h3>
            <p className="text-sm mt-1 font-medium" style={{ color: 'var(--content-secondary)' }}>
              {campaign.hierarchy?.network || 'Network Unknown'}
            </p>
          </div>

          {/* Status indicator - minimal badge */}
          <div className={`status-badge ml-4 ${campaign.is_serving ? 'status-active' : 'status-inactive'}`}>
            {campaign.is_serving ? 'Active' : 'Inactive'}
          </div>
        </div>
      </header>

      {/* Core metrics - only essential data */}
      {campaign.metrics && (
        <section
          id={`campaign-details-${campaign.id}`}
          className="px-6 pb-4"
          aria-label="Campaign performance metrics"
        >
          <div className="grid grid-cols-2 gap-6">
            {/* Sessions metric */}
            <div className="flex items-center space-x-3">
              <div className="p-2" style={{ backgroundColor: 'var(--surface-tertiary)', border: '1px solid var(--border-default)' }}>
                <Users className="w-4 h-4" style={{ color: 'var(--content-secondary)' }} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--content-tertiary)' }}>
                  Sessions
                </p>
                <p className="text-xl font-bold tracking-tight" style={{ color: 'var(--content-primary)' }}>
                  {formatNumber(campaign.metrics.totalSessions)}
                </p>
              </div>
            </div>

            {/* Registrations metric */}
            <div className="flex items-center space-x-3">
              <div className="p-2" style={{ backgroundColor: 'var(--surface-tertiary)', border: '1px solid var(--border-default)' }}>
                <Target className="w-4 h-4" style={{ color: 'var(--content-secondary)' }} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--content-tertiary)' }}>
                  Conversions
                </p>
                <p className="text-xl font-bold tracking-tight" style={{ color: 'var(--content-primary)' }}>
                  {formatNumber(campaign.metrics.totalRegistrations)}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Performance indicator - critical insight */}
      {campaign.metrics && (
        <footer className="px-6 pb-6 pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium tracking-wide" style={{ color: 'var(--content-secondary)' }}>
              Conversion Rate
            </span>
            <div className="flex items-center space-x-2">
              {isHighPerforming ? (
                <TrendingUp
                  className="w-4 h-4"
                  style={{ color: 'var(--semantic-success)' }}
                  aria-label="High performance"
                />
              ) : (
                <TrendingDown
                  className="w-4 h-4"
                  style={{ color: 'var(--semantic-error)' }}
                  aria-label="Low performance"
                />
              )}
              <span
                className="text-sm font-bold tracking-wide"
                style={{ color: isHighPerforming ? 'var(--semantic-success)' : 'var(--semantic-error)' }}
                aria-label={`Conversion rate: ${formatPercentage(registrationRate)}`}
              >
                {formatPercentage(registrationRate)}
              </span>
            </div>
          </div>
        </footer>
      )}

      {/* Targeting context - minimal tags when available */}
      {campaign.hierarchy && (
        <div className="px-6 pb-6" style={{ borderTop: '1px solid var(--border-default)' }}>
          <div className="flex flex-wrap gap-2 mt-4">
            {campaign.hierarchy.domain && (
              <span
                className="px-3 py-1 text-xs font-medium tracking-wide"
                style={{ backgroundColor: 'var(--surface-tertiary)', color: 'var(--content-secondary)' }}
              >
                {campaign.hierarchy.domain}
              </span>
            )}
            {campaign.hierarchy.placement && (
              <span
                className="px-3 py-1 text-xs font-medium tracking-wide"
                style={{ backgroundColor: 'var(--surface-tertiary)', color: 'var(--content-secondary)' }}
              >
                {campaign.hierarchy.placement}
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

export default CampaignCard;