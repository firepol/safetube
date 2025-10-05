import React, { useState, useEffect } from 'react';

/**
 * Dialog for entering a reason when denying a wishlist video
 */
export interface DenyReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  videoTitle?: string;
  isLoading?: boolean;
}

export const DenyReasonDialog: React.FC<DenyReasonDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  videoTitle,
  isLoading = false
}) => {
  const [reason, setReason] = useState('');
  const [isValid, setIsValid] = useState(true);

  const MAX_CHARACTERS = 500;
  const remainingChars = MAX_CHARACTERS - reason.length;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setIsValid(true);
    }
  }, [isOpen]);

  // Validate input
  useEffect(() => {
    setIsValid(reason.length <= MAX_CHARACTERS);
  }, [reason]);

  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newReason = e.target.value;
    setReason(newReason);
  };

  const handleConfirm = () => {
    if (isValid && !isLoading) {
      onConfirm(reason.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-3xl">❌</div>
          <h2 className="text-xl font-semibold text-gray-900">
            Deny Video Request
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6">
          {videoTitle && (
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <strong>Video:</strong> {videoTitle}
            </div>
          )}
          
          <div>
            <label htmlFor="denial-reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for denial (optional but encouraged)
            </label>
            <textarea
              id="denial-reason"
              value={reason}
              onChange={handleReasonChange}
              onKeyDown={handleKeyDown}
              placeholder="Explain why this video is not appropriate..."
              className={`w-full px-3 py-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !isValid ? 'border-red-500' : 'border-gray-300'
              }`}
              rows={4}
              disabled={isLoading}
              maxLength={MAX_CHARACTERS}
            />
            
            {/* Character counter */}
            <div className="flex justify-between items-center mt-1">
              <div className="text-xs text-gray-500">
                Press Ctrl+Enter to confirm, Esc to cancel
              </div>
              <div className={`text-xs ${remainingChars < 50 ? 'text-orange-600' : remainingChars < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {remainingChars} characters remaining
              </div>
            </div>
            
            {!isValid && (
              <div className="text-xs text-red-600 mt-1">
                Reason cannot exceed {MAX_CHARACTERS} characters
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Deny Video
          </button>
        </div>
      </div>
    </div>
  );
};