import React, { useState } from 'react';

interface DenyReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  videoTitle?: string;
}

export const DenyReasonDialog: React.FC<DenyReasonDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  videoTitle
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onConfirm(reason.trim() || undefined);
      setReason('');
      onClose();
    } catch (error) {
      console.error('Error denying video:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setReason('');
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const characterCount = reason.length;
  const maxCharacters = 500;
  const isOverLimit = characterCount > maxCharacters;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleCancel}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Deny Video Request
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4">
              <div className="space-y-4">
                {videoTitle && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Video:</span> {videoTitle}
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="denial-reason" className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for denial (optional)
                  </label>
                  <textarea
                    id="denial-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none ${
                      isOverLimit ? 'border-red-300' : 'border-gray-300'
                    }`}
                    rows={4}
                    maxLength={maxCharacters + 50} // Allow typing over limit to show error
                    placeholder="Explain why this video is not appropriate (optional)..."
                  />
                  
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500">
                      This reason will be shown to your child to help them understand your decision.
                    </p>
                    <div className={`text-xs ${isOverLimit ? 'text-red-600' : 'text-gray-500'}`}>
                      {characterCount}/{maxCharacters}
                    </div>
                  </div>
                  
                  {isOverLimit && (
                    <p className="text-xs text-red-600 mt-1">
                      Reason is too long. Please keep it under {maxCharacters} characters.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isOverLimit}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Denying...' : 'Deny Video'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DenyReasonDialog;