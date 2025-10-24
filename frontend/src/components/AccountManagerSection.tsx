import React, { useState } from 'react';
import { User, Edit3, X, Check } from 'lucide-react';

interface AccountManagerSectionProps {
  campaignId: number;
  accountManager: string | null | undefined;
  onUpdate: (manager: string | null) => Promise<void>;
}

export const AccountManagerSection: React.FC<AccountManagerSectionProps> = ({
  campaignId,
  accountManager,
  onUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(accountManager || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = () => {
    setEditValue(accountManager || '');
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(accountManager || '');
    setError(null);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const valueToSave = editValue.trim() || null;
      await onUpdate(valueToSave);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update account manager');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg shadow p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <User className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />

          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter manager name..."
                maxLength={255}
                disabled={isSubmitting}
                className="flex-1 px-3 py-1.5 text-sm rounded border"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)'
                }}
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="p-1.5 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
                title="Save"
              >
                <Check className="h-4 w-4 text-green-600" />
              </button>
              <button
                onClick={handleCancel}
                disabled={isSubmitting}
                className="p-1.5 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Cancel"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1">
                <span className="text-sm font-medium mr-2" style={{ color: 'var(--muted-foreground)' }}>
                  Account Manager:
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {accountManager || 'None'}
                </span>
              </div>
              <button
                onClick={handleEdit}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                title="Edit manager"
              >
                <Edit3 className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50" style={{ border: '1px solid #fecaca' }}>
          <X className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-medium text-red-800">Failed to update</p>
            <p className="text-xs text-red-700">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
