import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, AlertCircle, Loader2, DollarSign, Trash2 } from 'lucide-react';

interface CostEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: number;
  currentCost: number;
  currentCostStatus: 'estimated' | 'confirmed' | 'api_sourced';
  onSave: (data: {
    cost: number;
    cost_status: 'confirmed' | 'api_sourced';
    override_reason?: string;
    overridden_by: string;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export const CostEditModal: React.FC<CostEditModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  currentCost,
  currentCostStatus,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState({
    cost: currentCost.toString(),
    cost_status: currentCostStatus === 'estimated' ? 'confirmed' : currentCostStatus as 'confirmed' | 'api_sourced',
    override_reason: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        cost: currentCost.toString(),
        cost_status: currentCostStatus === 'estimated' ? 'confirmed' : currentCostStatus,
        override_reason: '',
      });
      setError(null);
      // Focus cost input when modal opens
      setTimeout(() => {
        costInputRef.current?.focus();
        costInputRef.current?.select();
      }, 100);
    }
  }, [isOpen, currentCost, currentCostStatus]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving && !isDeleting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isSaving, isDeleting]);

  const handleCostChange = useCallback((value: string) => {
    // Allow only valid number input
    const sanitized = value.replace(/[^\d.]/g, '');
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;
    setFormData(prev => ({ ...prev, cost: formatted }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cost = parseFloat(formData.cost);

    // Validation
    if (isNaN(cost)) {
      setError('Please enter a valid cost value');
      return;
    }

    if (cost < 0) {
      setError('Cost cannot be negative');
      return;
    }

    // Check if there are actual changes
    const hasChanges = cost !== currentCost || formData.cost_status !== currentCostStatus;

    if (!hasChanges && !formData.override_reason.trim()) {
      setError('No changes detected. Please modify the cost or cost status, or provide a reason for the update.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        cost,
        cost_status: formData.cost_status,
        override_reason: formData.override_reason.trim() || undefined,
        overridden_by: 'user', // TODO: Get from auth context
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cost override');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    if (!confirm('Are you sure you want to remove the cost override? This will revert to the estimated cost.')) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cost override');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div
        className="w-full max-w-lg rounded-lg shadow-xl bg-white"
        style={{ border: '1px solid #d1d5db' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-300">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-100">
              <DollarSign className="h-5 w-5 text-pink-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Campaign Cost
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={isSaving || isDeleting}
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

          {/* Current Status Info */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Current Cost</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                currentCostStatus === 'estimated' ? 'bg-gray-200 text-gray-700' :
                currentCostStatus === 'confirmed' ? 'bg-green-100 text-green-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {currentCostStatus === 'estimated' ? 'Estimated' :
                 currentCostStatus === 'confirmed' ? 'Confirmed' : 'API Sourced'}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              ${currentCost.toFixed(2)}
            </div>
          </div>

          {/* Cost Input */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">
              New Cost Value *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-medium">
                $
              </span>
              <input
                ref={costInputRef}
                type="text"
                value={formData.cost}
                onChange={(e) => handleCostChange(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-pink-500 focus:outline-none font-medium"
                placeholder="0.00"
                disabled={isSaving || isDeleting}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Enter the campaign cost in dollars
            </p>
          </div>

          {/* Cost Status */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">
              Cost Status *
            </label>
            <select
              value={formData.cost_status}
              onChange={(e) => setFormData(prev => ({ ...prev, cost_status: e.target.value as 'confirmed' | 'api_sourced' }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-pink-500 focus:outline-none"
              disabled={isSaving || isDeleting}
            >
              <option value="confirmed">Confirmed - Manually Verified</option>
              <option value="api_sourced">API Sourced - From Ad Platform</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select whether this cost is manually confirmed or from ad platform API
            </p>
          </div>

          {/* Override Reason */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">
              Reason for Update (Optional)
            </label>
            <textarea
              value={formData.override_reason}
              onChange={(e) => setFormData(prev => ({ ...prev, override_reason: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 resize-none focus:ring-2 focus:ring-pink-500 focus:outline-none"
              rows={3}
              placeholder="Explain why this cost update is needed..."
              disabled={isSaving || isDeleting}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-4">
            <div>
              {onDelete && currentCostStatus !== 'estimated' && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-lg bg-white text-red-600 border border-red-300 hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaving || isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Remove Override
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 transition-colors"
                disabled={isSaving || isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving || isDeleting}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Cost
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
