import React from 'react';
import { cn } from '@/lib/utils';

export type VideoSourceType = 'youtube' | 'dlna' | 'local';

export interface VideoCardBaseProps {
  thumbnail: string;
  title: string;
  duration: number | null;
  resumeAt: number | null;
  watched: boolean;
  type: VideoSourceType;
  progress: number;
  className?: string;
  onClick?: () => void;
}

export const VideoCardBase: React.FC<VideoCardBaseProps> = ({
  thumbnail,
  title,
  duration,
  resumeAt,
  watched,
  type,
  progress,
  className,
  onClick,
}) => {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'group relative aspect-video w-full overflow-hidden rounded-lg bg-muted transition-all hover:scale-[1.02]',
        watched && 'opacity-75',
        className
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative h-full w-full">
        <img
          src={thumbnail}
          alt={title}
          className="h-full w-full object-cover"
        />
        
        {/* Progress Bar */}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 h-1 w-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${progress}%` }}
              role="progressbar"
            />
          </div>
        )}

        {/* Duration Badge */}
        {duration && (
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1 text-xs text-white">
            {formatDuration(duration)}
          </div>
        )}

        {/* Resume Indicator */}
        {resumeAt && (
          <div className="absolute left-2 top-2 rounded bg-black/80 px-1 text-xs text-white">
            Resume at {formatDuration(resumeAt)}
          </div>
        )}

        {/* Source Type Badge */}
        <div className="absolute right-2 top-2 rounded bg-black/80 px-1 text-xs text-white">
          {type}
        </div>
      </div>

      {/* Title */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2">
        <h3 className="text-sm font-medium text-white line-clamp-2">{title}</h3>
      </div>
    </div>
  );
}; 