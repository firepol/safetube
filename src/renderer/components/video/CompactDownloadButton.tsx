import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Video } from '../../types';
import { cn } from '@/lib/utils';

// Download status interface
interface DownloadStatus {
  status: 'idle' | 'pending' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

// Props interface for the CompactDownloadButton component
interface CompactDownloadButtonProps {
  video: Video | null;
  downloadStatus: DownloadStatus;
  isDownloading: boolean;
  onStartDownload: () => void;
  onCancelDownload: () => void;
  onResetDownload?: () => void;
  showResetButton?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * Compact download button with tooltip-based status information
 * Replaces the large DownloadUI with a space-efficient button
 */
export const CompactDownloadButton: React.FC<CompactDownloadButtonProps> = ({
  video,
  downloadStatus,
  isDownloading,
  onStartDownload,
  onCancelDownload,
  onResetDownload,
  showResetButton = false,
  size = 'medium',
  className
}) => {
  // Only show download button for YouTube videos
  if (!video || video.type !== 'youtube') {
    return null;
  }

  // Size-based styling
  const sizeClasses = {
    small: 'w-5 h-5 text-sm p-1',
    medium: 'w-8 h-8 text-base p-1.5',
    large: 'w-10 h-10 text-lg p-2'
  };

  // Get the appropriate icon, color, and tooltip based on status
  const getStatusInfo = () => {
    switch (downloadStatus.status) {
      case 'downloading':
        return {
          icon: '⏳',
          colorClass: 'text-blue-600 bg-blue-50 border-blue-200',
          tooltip: `Downloading... ${downloadStatus.progress ? `${downloadStatus.progress}%` : ''}`,
          onClick: onCancelDownload,
          clickTooltip: 'Click to cancel download'
        };

      case 'completed':
        return {
          icon: '✓',
          colorClass: 'text-green-600 bg-green-50 border-green-200',
          tooltip: 'Video downloaded for offline viewing',
          onClick: showResetButton && onResetDownload ? onResetDownload : undefined,
          clickTooltip: showResetButton ? 'Click to reset download' : undefined
        };

      case 'failed':
        return {
          icon: '⚠️',
          colorClass: 'text-red-600 bg-red-50 border-red-200',
          tooltip: downloadStatus.error || 'Download failed',
          onClick: onStartDownload,
          clickTooltip: 'Click to retry download'
        };

      default: // idle
        return {
          icon: '⬇️',
          colorClass: 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200',
          tooltip: 'Download for offline viewing',
          onClick: onStartDownload,
          clickTooltip: 'Click to start download'
        };
    }
  };

  const statusInfo = getStatusInfo();

  const buttonClasses = cn(
    'rounded-full border-2 transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
    'flex items-center justify-center cursor-pointer',
    sizeClasses[size],
    statusInfo.colorClass,
    isDownloading && downloadStatus.status !== 'downloading' ? 'animate-pulse opacity-60' : '',
    !statusInfo.onClick ? 'cursor-default' : '',
    className
  );

  const buttonContent = (
    <button
      onClick={statusInfo.onClick}
      disabled={!statusInfo.onClick || (isDownloading && downloadStatus.status !== 'downloading')}
      className={buttonClasses}
      aria-label={statusInfo.tooltip}
    >
      <span className="leading-none">{statusInfo.icon}</span>
    </button>
  );

  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>
        {buttonContent}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          className="z-50 rounded bg-black px-2 py-1 text-xs text-white shadow-lg max-w-xs"
        >
          <div className="text-center">
            <div>{statusInfo.tooltip}</div>
            {statusInfo.clickTooltip && (
              <div className="text-gray-300 mt-1">{statusInfo.clickTooltip}</div>
            )}
          </div>
          <Tooltip.Arrow className="fill-black" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

export default CompactDownloadButton;