import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { VideoCardBase, VideoCardBaseProps } from '../video/VideoCardBase';
import { useThumbnailUpdates } from '../../hooks/useThumbnailUpdates';
import { useFavoriteStatus } from '../../hooks/useFavoriteStatus';
import { FavoritesService } from '../../services/favoritesService';
import { normalizeVideoSource } from '../../../shared/favoritesUtils';
import { logVerbose } from '../../lib/logging';

interface VideoGridProps {
  videos: VideoCardBaseProps[];
  groupByType?: boolean;
  className?: string;
  showFavoriteIcons?: boolean; // Whether to show favorite star icons
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  groupByType = true,
  className,
  showFavoriteIcons = false,
}) => {
  // Store thumbnail updates in separate state
  const [thumbnailUpdates, setThumbnailUpdates] = useState<Record<string, string>>({});

  // Use the thumbnail updates hook
  const { getThumbnailForVideo } = useThumbnailUpdates({
    onThumbnailUpdate: (videoId: string, thumbnailUrl: string) => {
      // Store thumbnail updates in a map
      setThumbnailUpdates(prev => ({
        ...prev,
        [videoId]: thumbnailUrl
      }));
    }
  });

  // Use simple favorite status hook - like the visited/clicked system
  const { isFavorite: isFavoriteVideo, refreshFavorites } = useFavoriteStatus();

  // Simple favorite toggle - memoized to prevent infinite loops
  const handleFavoriteToggle = useCallback(async (videoId: string, isFavorite: boolean) => {
    try {
      const video = videos.find(v => v.id === videoId);
      if (!video) {
        return;
      }

      // Validate required data before proceeding
      if (!video.title || video.title.trim() === '') {
        return;
      }

      // Use the existing service to toggle favorite
      await FavoritesService.toggleFavorite(
        video.id,
        video.source || 'unknown',
        video.type,
        video.title,
        // Use updated thumbnail if available
        thumbnailUpdates[video.id] || video.thumbnail || '',
        video.duration || 0
      );

      // Refresh favorites data to get the updated state
      refreshFavorites();

    } catch (error) {
    }
  }, [videos, thumbnailUpdates, refreshFavorites, isFavoriteVideo]);

  // Memoize the updated videos to prevent infinite re-renders
  const updatedVideos = useMemo(() => {
    return videos.map(video => ({
      ...video,
      // Apply thumbnail updates if available
      thumbnail: thumbnailUpdates[video.id] || video.thumbnail,
      showFavoriteIcon: showFavoriteIcons,
      onFavoriteToggle: showFavoriteIcons ? handleFavoriteToggle : undefined,
      // Check if this video is in favorites.json with proper ID matching
      isFavorite: isFavoriteVideo(video.id, video.type)
    }));
  }, [videos, thumbnailUpdates, showFavoriteIcons, isFavoriteVideo, handleFavoriteToggle]);

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