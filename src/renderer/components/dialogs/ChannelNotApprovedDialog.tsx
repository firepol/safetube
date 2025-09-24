import React from 'react';

/**
 * Dialog shown when a user tries to access a video from a channel
 * that is not in their approved sources list
 */
export interface ChannelNotApprovedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle?: string;
}

export const ChannelNotApprovedDialog: React.FC<ChannelNotApprovedDialogProps> = ({
  isOpen,
  onClose,
  videoTitle
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-3xl">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900">
            Video Not Available
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-3 mb-6">
          <p className="text-gray-700">
            This video's channel is not in your approved sources.
          </p>
          {videoTitle && (
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
              <strong>Video:</strong> {videoTitle}
            </p>
          )}
          <p className="text-sm text-gray-600">
            Ask a parent or guardian if you'd like to watch videos from this channel.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};