import React, { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Users, MousePointer } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface KPIMetric {
  title: string
  value: string | number
  change: number
  icon: React.ElementType
}

interface CampaignActivity {
  name: string
  status: 'Active' | 'Paused' | 'Scheduled'
  performance: 'High' | 'Medium' | 'Low' | 'N/A'
  spend: string
}

/**
 * Dashboard component following Dieter Rams principles:
 * - "Good design is as little design as possible"
 * - Functional, purposeful layout
 * - Clear information hierarchy
 * - Accessible data visualization
 */
const Dashboard: React.FC = () => {
  const [metrics] = useState<KPIMetric[]>([
    { title: 'Revenue', value: '$124,500', change: 12.5, icon: DollarSign },
    { title: 'Campaigns', value: 28, change: 8.2, icon: TrendingUp },
    { title: 'Users', value: '15.2K', change: -2.4, icon: Users },
    { title: 'Click Rate', value: '3.45%', change: 5.7, icon: MousePointer },
  ])

  const performanceData = [
    { month: 'Jan', revenue: 4000, users: 2400 },
    { month: 'Feb', revenue: 3000, users: 2210 },
    { month: 'Mar', revenue: 5000, users: 2290 },
    { month: 'Apr', revenue: 4780, users: 3000 },
    { month: 'May', revenue: 5890, users: 3181 },
    { month: 'Jun', revenue: 6390, users: 3500 },
  ]

  const recentActivity: CampaignActivity[] = [
    { name: 'Summer Sale 2024', status: 'Active', performance: 'High', spend: '$2,450' },
    { name: 'Back to School', status: 'Paused', performance: 'Medium', spend: '$1,200' },
    { name: 'Holiday Preview', status: 'Active', performance: 'High', spend: '$3,800' },
    { name: 'Flash Friday', status: 'Scheduled', performance: 'N/A', spend: '$0' },
  ]

  const getStatusColor = (status: CampaignActivity['status']) => {
    switch (status) {
      case 'Active':
        return 'var(--semantic-success)'
      case 'Paused':
        return 'var(--semantic-warning)'
      default:
        return 'var(--content-tertiary)'
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Page header - minimal and purposeful */}
      <section>
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--content-primary)' }}>
          Performance Overview
        </h1>
        <p className="font-medium" style={{ color: 'var(--content-secondary)' }}>
          Real-time insights from your marketing campaigns
        </p>
      </section>

      {/* KPI Metrics - clean grid layout */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">Key Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => {
            const Icon = metric.icon
            const isPositive = metric.change > 0

            return (
              <div
                key={index}
                className="card p-6 transition-all duration-150"
                style={{
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-subtle)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                }}
                role="region"
                aria-labelledby={`metric-${index}-title`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p
                      id={`metric-${index}-title`}
                      className="text-sm font-medium mb-2 uppercase tracking-wide"
                      style={{ color: 'var(--content-secondary)' }}
                    >
                      {metric.title}
                    </p>
                    <p className="text-3xl font-bold mb-3 tracking-tight" style={{ color: 'var(--content-primary)' }}>
                      {metric.value}
                    </p>
                    <div className="flex items-center">
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4 mr-2" style={{ color: 'var(--semantic-success)' }} aria-hidden="true" />
                      ) : (
                        <TrendingDown className="w-4 h-4 mr-2" style={{ color: 'var(--semantic-error)' }} aria-hidden="true" />
                      )}
                      <span
                        className="text-sm font-semibold"
                        style={{ color: isPositive ? 'var(--semantic-success)' : 'var(--semantic-error)' }}
                        aria-label={`${isPositive ? 'Increase' : 'Decrease'} of ${Math.abs(metric.change)} percent`}
                      >
                        {isPositive ? '+' : ''}{metric.change}%
                      </span>
                    </div>
                  </div>
                  <div className="p-3" style={{ backgroundColor: 'var(--surface-tertiary)', border: '1px solid var(--border-default)' }}>
                    <Icon className="w-6 h-6" style={{ color: 'var(--content-secondary)' }} aria-hidden="true" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Performance Chart - focused on essential data */}
      <section aria-labelledby="performance-heading">
        <div className="card p-6" style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}>
          <h2
            id="performance-heading"
            className="text-lg font-semibold mb-6 tracking-tight"
            style={{ color: 'var(--content-primary)' }}
          >
            Performance Trend
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--border-default)" />
                <XAxis
                  dataKey="month"
                  stroke="var(--content-secondary)"
                  fontSize={12}
                  fontWeight={500}
                />
                <YAxis
                  stroke="var(--content-secondary)"
                  fontSize={12}
                  fontWeight={500}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '4px',
                    color: 'var(--content-primary)',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--interactive-default)"
                  strokeWidth={3}
                  dot={{ fill: 'var(--interactive-default)', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: 'var(--interactive-hover)' }}
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="var(--content-secondary)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--content-secondary)', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: 'var(--content-primary)' }}
                  name="Users"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Campaign Activity - minimal list design */}
      <section aria-labelledby="activity-heading">
        <div className="card p-6" style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}>
          <h2
            id="activity-heading"
            className="text-lg font-semibold mb-6 tracking-tight"
            style={{ color: 'var(--content-primary)' }}
          >
            Campaign Activity
          </h2>
          <div className="space-y-1">
            {recentActivity.map((campaign, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 transition-colors duration-150 border border-transparent"
                style={{ borderColor: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-tertiary)'
                  e.currentTarget.style.borderColor = 'var(--border-default)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                }}
                role="row"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getStatusColor(campaign.status) }}
                    aria-label={`Status: ${campaign.status}`}
                  />
                  <div>
                    <p className="font-semibold text-sm tracking-wide" style={{ color: 'var(--content-primary)' }}>
                      {campaign.name}
                    </p>
                    <p className="text-xs font-medium mt-1" style={{ color: 'var(--content-secondary)' }}>
                      {campaign.status} • {campaign.performance}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm" style={{ color: 'var(--content-primary)' }}>
                    {campaign.spend}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard