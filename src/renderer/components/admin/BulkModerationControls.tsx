import React from 'react';
import { cn } from '@/lib/utils';

interface BulkModerationControlsProps {
  selectedVideos: Set<string>;
  totalVideos: number;
  isSelectAll: boolean;
  isBulkOperationInProgress: boolean;
  bulkOperationProgress?: {
    total: number;
    completed: number;
    failed: string[];
  };
  onSelectAll: () => void;
  onSelectNone: () => void;
  onBulkApprove: () => void;
  onBulkDeny: () => void;
  className?: string;
}

export const BulkModerationControls: React.FC<BulkModerationControlsProps> = ({
  selectedVideos,
  totalVideos,
  isSelectAll,
  isBulkOperationInProgress,
  bulkOperationProgress,
  onSelectAll,
  onSelectNone,
  onBulkApprove,
  onBulkDeny,
  className,
}) => {
  const selectedCount = selectedVideos.size;
  const hasSelection = selectedCount > 0;
  const isIndeterminate = hasSelection && !isSelectAll;

  return (
    <div className={cn("border-b border-gray-200 p-4 bg-gray-50", className)}>
      {/* Selection Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelectAll}
              ref={(input) => {
                if (input) {
                  input.indeterminate = isIndeterminate;
                }
              }}
              onChange={onSelectAll}
              disabled={isBulkOperationInProgress}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-sm font-medium text-gray-700">
              Select All ({totalVideos})
            </span>
          </label>
          
          {hasSelection && (
            <span className="text-sm text-gray-600">
              {selectedCount} selected
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSelectNone}
            disabled={!hasSelection || isBulkOperationInProgress}
            className={cn(
              "px-3 py-1.5 text-sm border rounded transition-colors",
              hasSelection && !isBulkOperationInProgress
                ? "border-gray-300 text-gray-700 hover:bg-gray-100"
                : "border-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {hasSelection && (
        <div className="flex items-center gap-3">
          <button
            onClick={onBulkApprove}
            disabled={isBulkOperationInProgress}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors",
              isBulkOperationInProgress
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Approve Selected ({selectedCount})
          </button>
          
          <button
            onClick={onBulkDeny}
            disabled={isBulkOperationInProgress}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors",
              isBulkOperationInProgress
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700 text-white"
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Deny Selected ({selectedCount})
          </button>

          {isBulkOperationInProgress && bulkOperationProgress && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
              Processing {bulkOperationProgress.completed}/{bulkOperationProgress.total}...
            </div>
          )}
        </div>
      )}

      {/* Progress Details */}
      {isBulkOperationInProgress && bulkOperationProgress && bulkOperationProgress.failed.length > 0 && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-700">
            {bulkOperationProgress.failed.length} videos failed to process
          </p>
        </div>
      )}
    </div>
  );
};

export default BulkModerationControls;