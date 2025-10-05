import React, { useState } from 'react';
import { DenyReasonDialog } from './DenyReasonDialog';
import { useWishlistDeny } from '../../hooks/useWishlistDeny';

/**
 * Example component showing how to integrate DenyReasonDialog with IPC
 * This demonstrates the complete workflow for denying a video with a reason
 */
interface DenyReasonDialogExampleProps {
  videoId: string;
  videoTitle: string;
  onDenyComplete?: (success: boolean) => void;
}

export const DenyReasonDialogExample: React.FC<DenyReasonDialogExampleProps> = ({
  videoId,
  videoTitle,
  onDenyComplete
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { denyVideo, isLoading, error, clearError } = useWishlistDeny();

  const handleOpenDialog = () => {
    clearError();
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (!isLoading) {
      setIsDialogOpen(false);
    }
  };

  const handleConfirmDeny = async (reason: string) => {
    const success = await denyVideo(videoId, reason);
    
    if (success) {
      setIsDialogOpen(false);
      onDenyComplete?.(true);
    } else {
      // Dialog stays open to show error and allow retry
      onDenyComplete?.(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpenDialog}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
      >
        Deny Video
      </button>

      {/* Error display */}
      {error && !isDialogOpen && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Deny reason dialog */}
      <DenyReasonDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmDeny}
        videoTitle={videoTitle}
        isLoading={isLoading}
      />

      {/* Error display within dialog context */}
      {error && isDialogOpen && (
        <div className="fixed bottom-4 right-4 z-[60] p-4 bg-red-50 border border-red-200 rounded-md shadow-lg max-w-sm">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={clearError}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
};