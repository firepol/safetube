import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface BulkDenyReasonDialogProps {
  isOpen: boolean;
  selectedCount: number;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export const BulkDenyReasonDialog: React.FC<BulkDenyReasonDialogProps> = ({
  isOpen,
  selectedCount,
  onConfirm,
  onCancel,
  isProcessing = false,
}) => {
  const [reason, setReason] = useState('');
  const [isReasonRequired, setIsReasonRequired] = useState(false);

  const maxLength = 500;
  const remainingChars = maxLength - reason.length;

  const handleConfirm = () => {
    if (isReasonRequired && reason.trim().length === 0) {
      return; // Don't proceed if reason is required but empty
    }
    onConfirm(reason.trim() || undefined);
    setReason(''); // Reset for next time
    setIsReasonRequired(false);
  };

  const handleCancel = () => {
    setReason(''); // Reset for next time
    setIsReasonRequired(false);
    onCancel();
  };

  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      setReason(newValue);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          {/* Header */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Deny Selected Videos
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              You are about to deny {selectedCount} video{selectedCount !== 1 ? 's' : ''}. 
              You can optionally provide a shared reason that will be shown to the child.
            </p>
          </div>

          {/* Reason Input */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="denial-reason" className="block text-sm font-medium text-gray-700">
                Denial Reason {isReasonRequired && <span className="text-red-500">*</span>}
              </label>
              <button
                type="button"
                onClick={() => setIsReasonRequired(!isReasonRequired)}
                className={cn(
                  "text-xs px-2 py-1 rounded transition-colors",
                  isReasonRequired
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {isReasonRequired ? 'Required' : 'Optional'}
              </button>
            </div>
            
            <textarea
              id="denial-reason"
              value={reason}
              onChange={handleReasonChange}
              placeholder="Enter a reason for denying these videos (optional)..."
              className={cn(
                "w-full px-3 py-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                isReasonRequired && reason.trim().length === 0
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              )}
              rows={4}
              disabled={isProcessing}
            />
            
            <div className="flex justify-between items-center mt-1">
              <span className={cn(
                "text-xs",
                remainingChars < 50 ? "text-orange-600" : "text-gray-500"
              )}>
                {remainingChars} characters remaining
              </span>
              
              {isReasonRequired && reason.trim().length === 0 && (
                <span className="text-xs text-red-600">
                  Reason is required
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className={cn(
                "px-4 py-2 text-sm font-medium border rounded-md transition-colors",
                isProcessing
                  ? "border-gray-200 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              Cancel
            </button>
            
            <button
              onClick={handleConfirm}
              disabled={isProcessing || (isReasonRequired && reason.trim().length === 0)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
                isProcessing || (isReasonRequired && reason.trim().length === 0)
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              {isProcessing && (
                <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div>
              )}
              {isProcessing ? 'Processing...' : `Deny ${selectedCount} Video${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkDenyReasonDialog;