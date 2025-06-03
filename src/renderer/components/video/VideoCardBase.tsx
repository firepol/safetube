import React from 'react';
import { cn } from '@/lib/utils';
import { formatDuration } from '../../lib/utils';

export interface VideoCardBaseProps {
  thumbnail: string;
  title: string;
  duration: number;
  resumeAt: number | null;
  watched: boolean;
  type: 'youtube' | 'dlna' | 'local';
  progress: number;
}

export const VideoCardBase: React.FC<VideoCardBaseProps> = ({
  thumbnail,
  title,
  duration,
  resumeAt,
  watched,
  type,
  progress,
}) => {
  const progressPercentage = Math.min(100, Math.max(0, progress));

  return (
    <div className="group relative overflow-hidden rounded-lg bg-card shadow-sm transition-all hover:shadow-md">
      {/* Thumbnail Container */}
      <div className="relative aspect-video w-full overflow-hidden">
        <img
          src={thumbnail}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Duration Overlay */}
        <div className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs text-white">
          {formatDuration(duration)}
        </div>

        {/* Progress Bar */}
        {watched && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
            />
          </div>
        )}

        {/* Resume Overlay */}
        {resumeAt !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-black">
              Resume at {formatDuration(resumeAt)}
            </div>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground capitalize">
          {type}
        </p>
      </div>
    </div>
  );
}; 