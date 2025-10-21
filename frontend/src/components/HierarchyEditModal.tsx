import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, AlertCircle, Loader2 } from 'lucide-react';

interface HierarchyEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: number;
  currentHierarchy: {
    network: string;
    domain: string;
    placement: string;
    targeting: string;
    special: string;
  };
  onSave: (data: {
    network?: string;
    domain?: string;
    placement?: string;
    targeting?: string;
    special?: string;
    override_reason?: string;
    overridden_by: string;
  }) => Promise<void>;
}

interface HierarchySuggestions {
  network: string;
  domain: string;
  placement: string;
  targeting: string;
  special: string;
}

export const HierarchyEditModal: React.FC<HierarchyEditModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  currentHierarchy,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    network: currentHierarchy.network,
    domain: currentHierarchy.domain,
    placement: currentHierarchy.placement,
    targeting: currentHierarchy.targeting,
    special: currentHierarchy.special,
    override_reason: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNetworkSuggestions, setShowNetworkSuggestions] = useState(false);
  const [networkSuggestions, setNetworkSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const networkInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        network: currentHierarchy.network,
        domain: currentHierarchy.domain,
        placement: currentHierarchy.placement,
        targeting: currentHierarchy.targeting,
        special: currentHierarchy.special,
        override_reason: '',
      });
      setError(null);
    }
  }, [isOpen, currentHierarchy]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Fetch network suggestions (placeholder - will be connected to API)
  const fetchNetworkSuggestions = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setNetworkSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      // TODO: Replace with actual API call
      // For now, using mock data
      const mockNetworks = ['Facebook', 'Google', 'Instagram', 'TikTok', 'LinkedIn', 'Twitter', 'Pinterest'];
      const filtered = mockNetworks.filter(n =>
        n.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setNetworkSuggestions(filtered);
    } catch (err) {
      console.error('Failed to fetch network suggestions:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  // Auto-populate other fields when network is selected
  const autoPopulateFromNetwork = useCallback(async (network: string) => {
    if (!network) return;

    try {
      // TODO: Replace with actual API call to get suggestions
      // For now, using mock logic
      const suggestions: Partial<HierarchySuggestions> = {};

      if (network === 'Facebook' || network === 'Instagram' || network === 'TikTok') {
        suggestions.domain = 'Social Media';
      } else if (network === 'Google') {
        suggestions.domain = 'Search Engine';
      }

      // Only update fields that are currently empty or match the old network's pattern
      setFormData(prev => ({
        ...prev,
        domain: suggestions.domain || prev.domain,
        placement: suggestions.placement || prev.placement,
        targeting: suggestions.targeting || prev.targeting,
        special: suggestions.special || prev.special,
      }));
    } catch (err) {
      console.error('Failed to auto-populate fields:', err);
    }
  }, []);

  const handleNetworkChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, network: value }));
    fetchNetworkSuggestions(value);
    setShowNetworkSuggestions(true);
  }, [fetchNetworkSuggestions]);

  const handleNetworkSelect = useCallback((network: string) => {
    setFormData(prev => ({ ...prev, network }));
    setShowNetworkSuggestions(false);
    autoPopulateFromNetwork(network);
  }, [autoPopulateFromNetwork]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Helper function to clean string values: trim and convert empty strings to undefined
    const cleanValue = (value: string): string | undefined => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    // Build the update payload with cleaned values
    const payload: {
      network?: string;
      domain?: string;
      placement?: string;
      targeting?: string;
      special?: string;
      override_reason?: string;
      overridden_by: string;
    } = {
      overridden_by: 'user', // TODO: Get from auth context
    };

    // Only include fields that have changed and have non-empty values
    const cleanedNetwork = cleanValue(formData.network);
    const cleanedDomain = cleanValue(formData.domain);
    const cleanedPlacement = cleanValue(formData.placement);
    const cleanedTargeting = cleanValue(formData.targeting);
    const cleanedSpecial = cleanValue(formData.special);
    const cleanedReason = cleanValue(formData.override_reason);

    if (formData.network !== currentHierarchy.network && cleanedNetwork) {
      payload.network = cleanedNetwork;
    }
    if (formData.domain !== currentHierarchy.domain && cleanedDomain) {
      payload.domain = cleanedDomain;
    }
    if (formData.placement !== currentHierarchy.placement && cleanedPlacement) {
      payload.placement = cleanedPlacement;
    }
    if (formData.targeting !== currentHierarchy.targeting && cleanedTargeting) {
      payload.targeting = cleanedTargeting;
    }
    if (formData.special !== currentHierarchy.special && cleanedSpecial) {
      payload.special = cleanedSpecial;
    }
    if (cleanedReason) {
      payload.override_reason = cleanedReason;
    }

    // Validate at least one field is being updated
    const hasChanges = !!(payload.network || payload.domain || payload.placement || payload.targeting || payload.special);

    if (!hasChanges) {
      setError('No changes detected. Please modify at least one field with a non-empty value.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hierarchy override');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div
        ref={modalRef}
        className="w-full max-w-2xl rounded-lg shadow-xl bg-white"
        style={{ border: '1px solid #d1d5db' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-300">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit Campaign Hierarchy
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={isSaving}
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Network Field with Auto-complete */}
          <div className="relative">
            <label className="block text-sm font-medium mb-1 text-gray-900">
              1. Network
            </label>
            <input
              ref={networkInputRef}
              type="text"
              value={formData.network}
              onChange={(e) => handleNetworkChange(e.target.value)}
              onFocus={() => fetchNetworkSuggestions(formData.network)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter network name..."
              disabled={isSaving}
            />

            {/* Network Suggestions Dropdown */}
            {showNetworkSuggestions && networkSuggestions.length > 0 && (
              <div className="absolute top-full mt-1 w-full rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto bg-white border border-gray-300">
                {networkSuggestions.map((network) => (
                  <button
                    key={network}
                    type="button"
                    onClick={() => handleNetworkSelect(network)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors text-gray-900"
                  >
                    {network}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Domain Field */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">
              2. Domain
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => handleFieldChange('domain', e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter domain..."
              disabled={isSaving}
            />
          </div>

          {/* Placement Field */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">
              3. Placement
            </label>
            <input
              type="text"
              value={formData.placement}
              onChange={(e) => handleFieldChange('placement', e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter placement..."
              disabled={isSaving}
            />
          </div>

          {/* Targeting Field */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">
              4. Targeting
            </label>
            <input
              type="text"
              value={formData.targeting}
              onChange={(e) => handleFieldChange('targeting', e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter targeting..."
              disabled={isSaving}
            />
          </div>

          {/* Special Field */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">
              5. Special
            </label>
            <input
              type="text"
              value={formData.special}
              onChange={(e) => handleFieldChange('special', e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter special classification..."
              disabled={isSaving}
            />
          </div>

          {/* Override Reason */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">
              Reason for Override (Optional)
            </label>
            <textarea
              value={formData.override_reason}
              onChange={(e) => handleFieldChange('override_reason', e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={3}
              placeholder="Explain why this manual override is needed..."
              disabled={isSaving}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Override
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
