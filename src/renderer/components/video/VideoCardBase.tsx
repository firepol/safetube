import React from 'react';
import { cn } from '@/lib/utils';
import { formatDuration } from '../../lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';

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
  const isLongTitle = title.length > 32;

  return (
    <div
      className={cn(
        'bg-card rounded-xl border shadow-md flex flex-col max-w-[340px] w-full',
        'transition-transform hover:scale-[1.03]',
        watched ? 'opacity-80' : ''
      )}
      tabIndex={0}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-xl">
        <img
          src={thumbnail}
          alt={title}
          className="h-full w-full object-cover"
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
      {/* Title and Type */}
      <div className="flex-1 flex flex-col justify-between p-3">
        <Tooltip.Root delayDuration={300}>
          <Tooltip.Trigger asChild>
            <h3
              className={cn(
                'text-base font-semibold text-foreground truncate',
                isLongTitle && 'cursor-help'
              )}
              tabIndex={0}
            >
              {title}
            </h3>
          </Tooltip.Trigger>
          {isLongTitle && (
            <Tooltip.Portal>
              <Tooltip.Content side="top" className="z-50 rounded bg-black px-2 py-1 text-xs text-white shadow-lg">
                {title}
                <Tooltip.Arrow className="fill-black" />
              </Tooltip.Content>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
        <p className="mt-1 text-xs text-muted-foreground capitalize">
          {type}
        </p>
      </div>
    </div>
  );
}; 