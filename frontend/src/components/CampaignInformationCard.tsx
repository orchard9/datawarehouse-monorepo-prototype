import React, { useState } from 'react';
import { Info, Edit3, X, Check, Zap, ZapOff, AlertCircle, FileText } from 'lucide-react';

interface CampaignInformationCardProps {
  campaignId: number;
  status: 'live' | 'paused' | 'unknown';
  contactInfo: string | null | undefined;
  onUpdateStatus: (status: 'live' | 'paused' | 'unknown') => Promise<void>;
  onUpdateContactInfo: (contactInfo: string | null) => Promise<void>;
  isUpdatingStatus?: boolean;
  statusError?: string | null;
}

export const CampaignInformationCard: React.FC<CampaignInformationCardProps> = ({
  campaignId,
  status,
  contactInfo,
  onUpdateStatus,
  onUpdateContactInfo,
  isUpdatingStatus = false,
  statusError = null
}) => {
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editValue, setEditValue] = useState(contactInfo || '');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const handleEditContact = () => {
    setEditValue(contactInfo || '');
    setIsEditingContact(true);
    setContactError(null);
  };

  const handleCancelContact = () => {
    setIsEditingContact(false);
    setEditValue(contactInfo || '');
    setContactError(null);
  };

  const handleSaveContact = async () => {
    setIsSubmittingContact(true);
    setContactError(null);

    try {
      const valueToSave = editValue.trim() || null;
      await onUpdateContactInfo(valueToSave);
      setIsEditingContact(false);
    } catch (err: any) {
      setContactError(err.message || 'Failed to update contact information');
    } finally {
      setIsSubmittingContact(false);
    }
  };

  return (
    <div className="rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--card-foreground)' }}>Campaign Information</h3>

      <div className="space-y-4">
        {/* Status Section */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Status
          </label>
          <div className="relative">
            <button
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              disabled={isUpdatingStatus}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left flex items-center justify-between disabled:opacity-50"
              style={{
                backgroundColor: status === 'live' ? '#10b981' : status === 'paused' ? '#6b7280' : '#9ca3af',
                color: '#ffffff',
              }}
            >
              <div className="flex items-center gap-2">
                {status === 'live' ? (
                  <Zap className="h-4 w-4" />
                ) : status === 'paused' ? (
                  <ZapOff className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{status === 'live' ? 'Live' : status === 'paused' ? 'Paused' : 'Unknown'}</span>
              </div>
            </button>

            {/* Status Dropdown */}
            {isStatusDropdownOpen && !isUpdatingStatus && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsStatusDropdownOpen(false)} />
                <div
                  className="absolute top-full mt-2 left-0 rounded-lg shadow-lg z-20 overflow-hidden"
                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', minWidth: '150px' }}
                >
                  <button
                    onClick={() => {
                      onUpdateStatus('live');
                      setIsStatusDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 transition-colors flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4 text-green-600" />
                    <span>Live</span>
                  </button>
                  <button
                    onClick={() => {
                      onUpdateStatus('paused');
                      setIsStatusDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <ZapOff className="h-4 w-4 text-gray-600" />
                    <span>Paused</span>
                  </button>
                  <button
                    onClick={() => {
                      onUpdateStatus('unknown');
                      setIsStatusDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                    <span>Unknown</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {statusError && (
            <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50" style={{ border: '1px solid #fecaca' }}>
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{statusError}</p>
            </div>
          )}
        </div>

        {/* Contact Info Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Contact Info & Credentials
            </label>
            {!isEditingContact && (
              <button
                onClick={handleEditContact}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title="Edit contact info"
              >
                <Edit3 className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            )}
          </div>

          {isEditingContact ? (
            <div>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter contact information, credentials, or notes..."
                disabled={isSubmittingContact}
                rows={6}
                className="w-full px-3 py-2 text-sm rounded border resize-none"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)'
                }}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleSaveContact}
                  disabled={isSubmittingContact}
                  className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--primary-foreground)'
                  }}
                >
                  {isSubmittingContact ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancelContact}
                  disabled={isSubmittingContact}
                  className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--muted)',
                    color: 'var(--muted-foreground)'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 rounded min-h-[100px]" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
              {contactInfo ? (
                <pre className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}>
                  {contactInfo}
                </pre>
              ) : (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  <FileText className="h-4 w-4" />
                  <span>No contact information available</span>
                </div>
              )}
            </div>
          )}

          {contactError && (
            <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50" style={{ border: '1px solid #fecaca' }}>
              <X className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-800">Failed to update</p>
                <p className="text-xs text-red-700">{contactError}</p>
              </div>
              <button
                onClick={() => setContactError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
