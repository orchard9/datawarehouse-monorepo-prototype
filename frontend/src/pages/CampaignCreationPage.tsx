/**
 * Campaign Creation Page
 * Full-page form for creating new campaigns manually
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { dataWarehouseApi } from '@/api/datawarehouse';

const NETWORK_OPTIONS = [
  'Facebook',
  'Instagram',
  'Google',
  'TikTok',
  'LinkedIn',
  'Twitter',
  'Pinterest',
  'Snapchat',
  'YouTube',
  'Reddit',
  'Other'
];

interface FormData {
  name: string;
  description: string;
  tracking_url: string;
  status: 'live' | 'paused' | 'unknown';
  account_manager: string;
  contact_info_credentials: string;
  cost: string;
  cost_status: 'estimated' | 'confirmed';
  hierarchy: {
    network: string;
    domain: string;
    placement: string;
    targeting: string;
    special: string;
  };
}

interface FormErrors {
  [key: string]: string;
}

export const CampaignCreationPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    tracking_url: '',
    status: 'unknown',
    account_manager: '',
    contact_info_credentials: '',
    cost: '',
    cost_status: 'estimated',
    hierarchy: {
      network: '',
      domain: '',
      placement: '',
      targeting: '',
      special: ''
    }
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required';
    } else if (formData.name.length > 255) {
      newErrors.name = 'Campaign name must be max 255 characters';
    }

    // Tracking URL validation
    if (formData.tracking_url && formData.tracking_url.trim()) {
      try {
        new URL(formData.tracking_url);
      } catch {
        newErrors.tracking_url = 'Must be a valid URL';
      }
    }

    // Hierarchy validation
    if (!formData.hierarchy.network) {
      newErrors.network = 'Network is required';
    }
    if (!formData.hierarchy.domain.trim()) {
      newErrors.domain = 'Domain is required';
    }
    if (!formData.hierarchy.placement.trim()) {
      newErrors.placement = 'Placement is required';
    }
    if (!formData.hierarchy.targeting.trim()) {
      newErrors.targeting = 'Targeting is required';
    }
    if (!formData.hierarchy.special.trim()) {
      newErrors.special = 'Special is required';
    }

    // Cost validation
    if (formData.cost && formData.cost.trim()) {
      const costNum = parseFloat(formData.cost);
      if (isNaN(costNum) || costNum < 0) {
        newErrors.cost = 'Cost must be a positive number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Prepare data for API
      const submitData: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        tracking_url: formData.tracking_url.trim() || undefined,
        status: formData.status,
        account_manager: formData.account_manager.trim() || undefined,
        contact_info_credentials: formData.contact_info_credentials.trim() || undefined,
        cost: formData.cost ? parseFloat(formData.cost) : undefined,
        cost_status: formData.cost_status,
        hierarchy: {
          network: formData.hierarchy.network,
          domain: formData.hierarchy.domain.trim(),
          placement: formData.hierarchy.placement.trim(),
          targeting: formData.hierarchy.targeting.trim(),
          special: formData.hierarchy.special.trim()
        }
      };

      const createdCampaign = await dataWarehouseApi.campaigns.create(submitData);

      // Navigate to the new campaign's details page
      navigate(`/campaigns/${createdCampaign.id}`);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || 'Failed to create campaign';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleHierarchyChange = (field: keyof FormData['hierarchy'], value: string) => {
    setFormData(prev => ({
      ...prev,
      hierarchy: { ...prev.hierarchy, [field]: value }
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header with Breadcrumb */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate('/campaigns')}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Campaigns</span>
          </button>
          <ChevronRight className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>New Campaign</span>
        </div>

        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Create New Campaign</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl">
        {/* Section 1: Basic Information */}
        <div className="rounded-lg shadow p-6 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--card-foreground)' }}>Basic Information</h2>

          <div className="space-y-4">
            {/* Campaign Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="Enter campaign name..."
                maxLength={255}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  border: `1px solid ${errors.name ? '#ef4444' : 'var(--border)'}`,
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Enter campaign description..."
                rows={3}
                maxLength={1000}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                style={{
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              />
            </div>

            {/* Tracking URL */}
            <div>
              <label htmlFor="tracking_url" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                Tracking URL
              </label>
              <input
                id="tracking_url"
                type="url"
                value={formData.tracking_url}
                onChange={(e) => handleFieldChange('tracking_url', e.target.value)}
                placeholder="https://example.com/tracking"
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  border: `1px solid ${errors.tracking_url ? '#ef4444' : 'var(--border)'}`,
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              />
              {errors.tracking_url && (
                <p className="text-xs text-red-600 mt-1">{errors.tracking_url}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Campaign Hierarchy */}
        <div className="rounded-lg shadow p-6 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--card-foreground)' }}>
            Campaign Hierarchy <span className="text-red-500">*</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Network */}
            <div>
              <label htmlFor="network" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                1. Network <span className="text-red-500">*</span>
              </label>
              <select
                id="network"
                value={formData.hierarchy.network}
                onChange={(e) => handleHierarchyChange('network', e.target.value)}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  border: `1px solid ${errors.network ? '#ef4444' : 'var(--border)'}`,
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              >
                <option value="">Select network...</option>
                {NETWORK_OPTIONS.map(network => (
                  <option key={network} value={network}>{network}</option>
                ))}
              </select>
              {errors.network && (
                <p className="text-xs text-red-600 mt-1">{errors.network}</p>
              )}
            </div>

            {/* Domain */}
            <div>
              <label htmlFor="domain" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                2. Domain <span className="text-red-500">*</span>
              </label>
              <input
                id="domain"
                type="text"
                value={formData.hierarchy.domain}
                onChange={(e) => handleHierarchyChange('domain', e.target.value)}
                placeholder="e.g., Acquisition, Retention..."
                maxLength={255}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  border: `1px solid ${errors.domain ? '#ef4444' : 'var(--border)'}`,
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              />
              {errors.domain && (
                <p className="text-xs text-red-600 mt-1">{errors.domain}</p>
              )}
            </div>

            {/* Placement */}
            <div>
              <label htmlFor="placement" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                3. Placement <span className="text-red-500">*</span>
              </label>
              <input
                id="placement"
                type="text"
                value={formData.hierarchy.placement}
                onChange={(e) => handleHierarchyChange('placement', e.target.value)}
                placeholder="e.g., Feed, Stories, Reels..."
                maxLength={255}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  border: `1px solid ${errors.placement ? '#ef4444' : 'var(--border)'}`,
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              />
              {errors.placement && (
                <p className="text-xs text-red-600 mt-1">{errors.placement}</p>
              )}
            </div>

            {/* Targeting */}
            <div>
              <label htmlFor="targeting" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                4. Targeting <span className="text-red-500">*</span>
              </label>
              <input
                id="targeting"
                type="text"
                value={formData.hierarchy.targeting}
                onChange={(e) => handleHierarchyChange('targeting', e.target.value)}
                placeholder="e.g., 18-34, Interests..."
                maxLength={255}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  border: `1px solid ${errors.targeting ? '#ef4444' : 'var(--border)'}`,
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              />
              {errors.targeting && (
                <p className="text-xs text-red-600 mt-1">{errors.targeting}</p>
              )}
            </div>

            {/* Special */}
            <div className="md:col-span-2">
              <label htmlFor="special" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                5. Special <span className="text-red-500">*</span>
              </label>
              <input
                id="special"
                type="text"
                value={formData.hierarchy.special}
                onChange={(e) => handleHierarchyChange('special', e.target.value)}
                placeholder="e.g., None, Test, Seasonal..."
                maxLength={255}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  border: `1px solid ${errors.special ? '#ef4444' : 'var(--border)'}`,
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              />
              {errors.special && (
                <p className="text-xs text-red-600 mt-1">{errors.special}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Management & Contact */}
        <div className="rounded-lg shadow p-6 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--card-foreground)' }}>Management & Contact</h2>

          <div className="space-y-4">
            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                Campaign Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleFieldChange('status', e.target.value as 'live' | 'paused' | 'unknown')}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              >
                <option value="unknown">Unknown</option>
                <option value="live">Live</option>
                <option value="paused">Paused</option>
              </select>
            </div>

            {/* Account Manager */}
            <div>
              <label htmlFor="account_manager" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                Account Manager
              </label>
              <input
                id="account_manager"
                type="text"
                value={formData.account_manager}
                onChange={(e) => handleFieldChange('account_manager', e.target.value)}
                placeholder="Enter manager name..."
                maxLength={255}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              />
            </div>

            {/* Contact Info */}
            <div>
              <label htmlFor="contact_info" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                Contact Info & Credentials
              </label>
              <textarea
                id="contact_info"
                value={formData.contact_info_credentials}
                onChange={(e) => handleFieldChange('contact_info_credentials', e.target.value)}
                placeholder="Enter contact information, credentials, or notes..."
                rows={6}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                style={{
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Cost Information */}
        <div className="rounded-lg shadow p-6 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--card-foreground)' }}>Cost Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cost */}
            <div>
              <label htmlFor="cost" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                Cost ($)
              </label>
              <input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost}
                onChange={(e) => handleFieldChange('cost', e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  border: `1px solid ${errors.cost ? '#ef4444' : 'var(--border)'}`,
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              />
              {errors.cost && (
                <p className="text-xs text-red-600 mt-1">{errors.cost}</p>
              )}
            </div>

            {/* Cost Status */}
            <div>
              <label htmlFor="cost_status" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                Cost Status
              </label>
              <div className="flex items-center gap-4 h-[42px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cost_status"
                    value="estimated"
                    checked={formData.cost_status === 'estimated'}
                    onChange={(e) => handleFieldChange('cost_status', e.target.value as 'estimated' | 'confirmed')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>Estimated</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cost_status"
                    value="confirmed"
                    checked={formData.cost_status === 'confirmed'}
                    onChange={(e) => handleFieldChange('cost_status', e.target.value as 'estimated' | 'confirmed')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>Confirmed</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className="mb-6 flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50" style={{ border: '1px solid #fecaca' }}>
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Failed to create campaign</p>
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)'
            }}
          >
            {isSubmitting ? 'Creating Campaign...' : 'Create Campaign'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/campaigns')}
            disabled={isSubmitting}
            className="px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--muted)',
              color: 'var(--muted-foreground)'
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CampaignCreationPage;
