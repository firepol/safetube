import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { VideoCardBase, VideoCardBaseProps } from '../video/VideoCardBase';
import { useThumbnailUpdates } from '../../hooks/useThumbnailUpdates';
import { useFavoriteUpdates } from '../../hooks/useFavoriteUpdates';
import { FavoritesService } from '../../services/favoritesService';
import { normalizeVideoSource } from '../../../shared/favoritesUtils';
import { logVerbose } from '../../lib/logging';

interface VideoGridProps {
  videos: VideoCardBaseProps[];
  groupByType?: boolean;
  className?: string;
  showFavoriteIcons?: boolean; // Whether to show favorite star icons
  enableFavoriteSync?: boolean; // Whether to enable real-time favorite synchronization
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  groupByType = true,
  className,
  showFavoriteIcons = false,
  enableFavoriteSync = true,
}) => {
  const [updatedVideos, setUpdatedVideos] = useState<VideoCardBaseProps[]>(videos);

  // Use the thumbnail updates hook
  const { getThumbnailForVideo } = useThumbnailUpdates({
    onThumbnailUpdate: (videoId: string, thumbnailUrl: string) => {
      // Update the video with the new thumbnail
      setUpdatedVideos(prevVideos =>
        prevVideos.map(video =>
          video.id === videoId
            ? { ...video, thumbnail: thumbnailUrl }
            : video
        )
      );
    }
  });

  // Use the favorite updates hook for real-time synchronization
  const {
    favoriteUpdates,
    loadFavoriteStatusesWithSync,
    updateFavoriteStatus,
    getFavoriteStatus,
    hasFavoriteStatus,
    toggleFavoriteWithSync,
    isLoading: favoritesLoading
  } = useFavoriteUpdates({
    onFavoriteUpdate: (videoId: string, isFavorite: boolean) => {
      // Update the video with the new favorite status
      setUpdatedVideos(prevVideos =>
        prevVideos.map(video =>
          video.id === videoId
            ? { ...video, isFavorite, showFavoriteIcon: showFavoriteIcons }
            : video
        )
      );

      logVerbose('[VideoGrid] Updated favorite status for video:', { videoId, isFavorite });
    },
    autoSync: false, // Disable auto-sync to prevent infinite loops
    enableRealTimeSync: enableFavoriteSync
  });

  // Handle favorite toggle with proper metadata extraction and synchronization
  const handleFavoriteToggle = async (videoId: string, isFavorite: boolean) => {
    try {
      const video = updatedVideos.find(v => v.id === videoId);
      if (!video) {
        logVerbose('[VideoGrid] Video not found for favorite toggle:', videoId);
        return;
      }

      logVerbose('[VideoGrid] Toggling favorite for video:', { videoId, isFavorite, video: { title: video.title, type: video.type } });

      // Normalize the video source using the utility from Task 1.3
      const normalizedSource = normalizeVideoSource({
        id: video.id,
        type: video.type,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.duration,
        url: video.source
      });

      // Use the sync service for cross-player synchronization
      const result = await toggleFavoriteWithSync(
        normalizedSource.id,
        video.source || 'unknown',
        normalizedSource.type,
        normalizedSource.title,
        normalizedSource.thumbnail || '',
        normalizedSource.duration || 0
      );

      logVerbose('[VideoGrid] Favorite toggle completed with sync:', { videoId, newStatus: result.isFavorite });
    } catch (error) {
      logVerbose('[VideoGrid] Error toggling favorite:', error);
      // Revert optimistic update on error
      updateFavoriteStatus(videoId, !isFavorite);
    }
  };

  // Load favorite statuses when videos change (debounced to prevent rapid calls)
  useEffect(() => {
    if (!enableFavoriteSync || videos.length === 0) return;

    const timeoutId = setTimeout(() => {
      const videoIds = videos.map(v => v.id);
      const youtubeVideoIds = videos.filter(v => v.type === 'youtube').map(v => v.id);

      // Debug logging for YouTube videos
      if (youtubeVideoIds.length > 0) {
        logVerbose('[VideoGrid] Loading favorite statuses for YouTube videos:', youtubeVideoIds);
      }

      if (videoIds.length > 0) {
        loadFavoriteStatusesWithSync(videoIds);
      }
    }, 50); // Reduced debounce for better responsiveness

    return () => clearTimeout(timeoutId);
  }, [videos, enableFavoriteSync, loadFavoriteStatusesWithSync]);

  // Update local state when videos prop changes
  useEffect(() => {
    setUpdatedVideos(videos.map(video => {
      const hasStatus = hasFavoriteStatus(video.id);
      const cachedStatus = hasStatus ? getFavoriteStatus(video.id) : null;
      const finalFavorite = hasStatus ? (cachedStatus || false) : (video.isFavorite || false);

      // Debug logging for YouTube videos to understand favorite status resolution
      if (video.type === 'youtube') {
        logVerbose('[VideoGrid] YouTube video favorite status resolution:', {
          videoId: video.id,
          title: video.title,
          hasStatus,
          cachedStatus,
          originalIsFavorite: video.isFavorite,
          finalFavorite,
          showFavoriteIcons
        });
      }

      return {
        ...video,
        showFavoriteIcon: showFavoriteIcons,
        onFavoriteToggle: showFavoriteIcons ? handleFavoriteToggle : undefined,
        // Use cached favorite status if available, with proper fallback
        isFavorite: finalFavorite
      };
    }));
  }, [videos, showFavoriteIcons, hasFavoriteStatus, getFavoriteStatus]);

  const groupedVideos = groupByType
    ? updatedVideos.reduce((acc, video) => {
        const type = video.type;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(video);
        return acc;
      }, {} as Record<string, VideoCardBaseProps[]>)
    : { all: updatedVideos };

  return (
    <div className={cn('space-y-8', className)}>
      {Object.entries(groupedVideos).map(([type, typeVideos]) => (
        <div key={type} className="space-y-4">
          {groupByType && (
            <h2 className="text-xl font-semibold capitalize">{type}</h2>
          )}
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {typeVideos.map((video, index) => (
              <div key={`${video.type}-${index}`} className="w-full flex justify-center">
                <VideoCardBase
                  {...video}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}; 