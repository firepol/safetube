import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import { VideoCardBase, VideoCardBaseProps } from '../video/VideoCardBase';
import { useThumbnailUpdates } from '../../hooks/useThumbnailUpdates';
import { useFavoriteStatus } from '../../hooks/useFavoriteStatus';
import { FavoritesService } from '../../services/favoritesService';
import { normalizeVideoSource } from '../../../shared/favoritesUtils';
import { logVerbose } from '../../lib/logging';
import { useRenderTiming } from '../../lib/performanceUtils';

interface VideoGridProps {
  videos: VideoCardBaseProps[];
  groupByType?: boolean;
  className?: string;
  showFavoriteIcons?: boolean; // Whether to show favorite star icons
}

export const VideoGrid: React.FC<VideoGridProps> = memo(({
  videos,
  groupByType = true,
  className,
  showFavoriteIcons = false,
}) => {
  // 🚀 PERFORMANCE: Track render timing
  const renderStart = React.useMemo(() => {
    const start = performance.now();
    console.log(`🎨 [VideoGrid] Render start - ${videos.length} videos`);
    return start;
  }, [videos.length]);

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

      // Determine the correct sourceId, avoiding 'unknown' fallback
      let sourceId = video.sourceId;
      if (!sourceId || sourceId === 'unknown') {
        // For local videos, try to determine source from video path if available
        if (video.type === 'local' && video.id.includes('local:')) {
          // Extract path from local video ID and try to match with known sources
          const videoPath = video.id.replace('local:', '');
          // Try to get sources and find matching source for this path
          try {
            const allSources = await window.electron.videoSourcesGetAll();
            const localSources = allSources.filter((s: any) => s.type === 'local');
            for (const source of localSources) {
              if (videoPath.startsWith(source.path)) {
                sourceId = source.id;
                break;
              }
            }
          } catch (error) {
            console.warn('Could not determine source for local video:', error);
          }
        }
        // Final fallback to 'unknown' only if we couldn't determine the correct source
        if (!sourceId) {
          sourceId = 'unknown';
        }
      }

      // Use the existing service to toggle favorite
      await FavoritesService.toggleFavorite(
        video.id,
        sourceId,
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

  // 🚀 PERFORMANCE: Optimized memoization to prevent re-render cascades
  const processedVideos = useMemo(() => {
    const start = performance.now();

    const result = videos.map(video => ({
      ...video,
      thumbnail: thumbnailUpdates[video.id] || video.thumbnail,
      showFavoriteIcon: showFavoriteIcons,
      onFavoriteToggle: showFavoriteIcons ? handleFavoriteToggle : undefined,
      isFavorite: isFavoriteVideo(video.id, video.type)
    }));

    const duration = performance.now() - start;
    console.log(`🚀 [VideoGrid] Video processing: ${duration.toFixed(2)}ms`);
    return result;
  }, [videos, thumbnailUpdates, showFavoriteIcons, handleFavoriteToggle, isFavoriteVideo]);

  // 🚀 PERFORMANCE: Optimized grouping with early return
  const groupedVideos = useMemo(() => {
    const start = performance.now();

    const result = groupByType
      ? processedVideos.reduce((acc, video) => {
          const type = video.type;
          if (!acc[type]) {
            acc[type] = [];
          }
          acc[type].push(video);
          return acc;
        }, {} as Record<string, VideoCardBaseProps[]>)
      : { all: processedVideos };

    const duration = performance.now() - start;
    console.log(`🚀 [VideoGrid] Grouping: ${duration.toFixed(2)}ms`);
    return result;
  }, [groupByType, processedVideos]);

  // 🚀 PERFORMANCE: Log total render time
  React.useEffect(() => {
    const totalRenderTime = performance.now() - renderStart;
    console.log(`🎨 [VideoGrid] Total render time: ${totalRenderTime.toFixed(2)}ms`);
    performance.mark(`videogrid-render-complete-${videos.length}`);
  });

  return (
    <div className={cn('space-y-8', className)}>
      {Object.entries(groupedVideos).map(([type, typeVideos]) => (
        <div key={type} className="space-y-4">
          {groupByType && (
            <h2 className="text-xl font-semibold capitalize">{type}</h2>
          )}
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {typeVideos.map((video, index) => (
              <div key={`${video.id || video.type}-${index}`} className="w-full flex justify-center">
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
});

VideoGrid.displayName = 'VideoGrid';