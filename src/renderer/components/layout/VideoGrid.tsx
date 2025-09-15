import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { VideoCardBase, VideoCardBaseProps } from '../video/VideoCardBase';
import { useThumbnailUpdates } from '../../hooks/useThumbnailUpdates';

interface VideoGridProps {
  videos: VideoCardBaseProps[];
  groupByType?: boolean;
  className?: string;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  groupByType = true,
  className,
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

  // Update local state when videos prop changes
  useEffect(() => {
    setUpdatedVideos(videos);
  }, [videos]);

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