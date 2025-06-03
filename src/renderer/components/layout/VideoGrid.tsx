import React from 'react';
import { cn } from '@/lib/utils';
import { VideoCardBase, VideoCardBaseProps } from '../video/VideoCardBase';

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
  const groupedVideos = groupByType
    ? videos.reduce((acc, video) => {
        const type = video.type;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(video);
        return acc;
      }, {} as Record<string, VideoCardBaseProps[]>)
    : { all: videos };

  return (
    <div className={cn('space-y-8', className)}>
      {Object.entries(groupedVideos).map(([type, typeVideos]) => (
        <div key={type} className="space-y-4">
          {groupByType && (
            <h2 className="text-xl font-semibold capitalize">{type}</h2>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {typeVideos.map((video, index) => (
              <VideoCardBase
                key={`${video.type}-${index}`}
                {...video}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}; 