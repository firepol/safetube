import React from 'react';
import { FavoriteButton, FavoriteButtonProps } from './FavoriteButton';
import { CompactDownloadButton } from './CompactDownloadButton';
import { Video } from '../../types';
import { cn } from '@/lib/utils';

// Download status interface
interface DownloadStatus {
  status: 'idle' | 'pending' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

// Props interface for the CompactControlsRow component
interface CompactControlsRowProps {
  // Video data
  video: Video | null;

  // Favorite button props
  isFavorite: boolean;
  onFavoriteToggle: (videoId: string, isFavorite: boolean) => void;

  // Download button props
  downloadStatus: DownloadStatus;
  isDownloading: boolean;
  onStartDownload: () => void;
  onCancelDownload: () => void;
  onResetDownload?: () => void;
  showResetButton?: boolean;

  // Styling props
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Compact controls row that displays favorite and download buttons side-by-side
 * Replaces the separate DownloadUI and Favorites UI sections with a clean, space-efficient layout
 */
export const CompactControlsRow: React.FC<CompactControlsRowProps> = ({
  video,
  isFavorite,
  onFavoriteToggle,
  downloadStatus,
  isDownloading,
  onStartDownload,
  onCancelDownload,
  onResetDownload,
  showResetButton = false,
  className,
  size = 'medium'
}) => {
  // Don't render if no video
  if (!video) {
    return null;
  }

  // Container styling
  const containerClasses = cn(
    'flex items-center justify-end gap-3 p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm',
    'border border-gray-200/50',
    className
  );

  return (
    <div className={containerClasses}>
      {/* Favorite Button */}
      <FavoriteButton
        videoId={video.id}
        source={video.url || video.sourceId || 'unknown'}
        type={video.type}
        title={video.title}
        thumbnail={video.thumbnail || ''}
        duration={video.duration || 0}
        lastWatched={new Date().toISOString()}
        isFavorite={isFavorite}
        onToggle={onFavoriteToggle}
        size={size}
        showLabel={false}
        data-testid="favorite-button"
      />

      {/* Download Button - only for YouTube videos */}
      {video.type === 'youtube' && (
        <CompactDownloadButton
          video={video}
          downloadStatus={downloadStatus}
          isDownloading={isDownloading}
          onStartDownload={onStartDownload}
          onCancelDownload={onCancelDownload}
          onResetDownload={onResetDownload}
          showResetButton={showResetButton}
          size={size}
        />
      )}
    </div>
  );
};

export default CompactControlsRow;