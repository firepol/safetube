import React from 'react';
import { cn } from '@/lib/utils';
import { formatDuration } from '../../lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useNavigate } from 'react-router-dom';
import { VideoLoadError } from '../../../shared/videoErrorHandling';

export interface VideoCardBaseProps {
  id: string;
  thumbnail: string;
  title: string;
  duration: number;
  resumeAt?: number | null;
  watched?: boolean;
  type: 'youtube' | 'dlna' | 'local';
  progress?: number;
  // Enhanced error handling props
  isAvailable?: boolean;
  isFallback?: boolean;
  errorInfo?: VideoLoadError;
}

export const VideoCardBase: React.FC<VideoCardBaseProps> = ({
  id,
  thumbnail,
  title,
  duration,
  resumeAt,
  watched,
  type,
  progress,
  isAvailable = true,
  isFallback = false,
  errorInfo,
}) => {
  const progressPercentage = Math.min(100, Math.max(0, progress ?? 0));
  const isLongTitle = title.length > 32;
  const navigate = useNavigate();

  const handleClick = () => {
    if (isFallback) {
      // Open external YouTube link for fallback videos
      window.electron?.openExternal(`https://www.youtube.com/watch?v=${id}`);
    } else {
      // Normal navigation for available videos
      navigate(`/player/${id}`);
    }
  };

  return (
    <div
      className={cn(
        'bg-card rounded-xl border shadow-md flex flex-col max-w-[340px] w-full cursor-pointer',
        'transition-transform hover:scale-[1.03]',
        isFallback ? 'opacity-60 border-dashed border-yellow-400' : '',
        watched ? 'opacity-80' : ''
      )}
      tabIndex={0}
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-xl">
        {isFallback ? (
          <div className="h-full w-full bg-gray-200 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <div className="text-sm text-gray-600">Video Unavailable</div>
              <div className="text-xs text-gray-500 mt-1">Open in browser</div>
            </div>
          </div>
        ) : (
          <img
            src={thumbnail}
            alt={title}
            className="h-full w-full object-cover"
          />
        )}
        
        {/* Error indicator overlay */}
        {isFallback && errorInfo && (
          <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs">
            {errorInfo.type === 'deleted' ? 'Deleted' : 
             errorInfo.type === 'private' ? 'Private' : 
             errorInfo.type === 'restricted' ? 'Restricted' : 'Unavailable'}
          </div>
        )}
        
        {/* Duration Overlay - only show for available videos */}
        {!isFallback && (
          <div className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs text-white">
            {formatDuration(duration)}
          </div>
        )}
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
        {resumeAt !== null && resumeAt !== undefined && (
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
                'text-base font-semibold truncate',
                isFallback ? 'text-gray-500 italic' : 'text-foreground',
                isLongTitle && 'cursor-help'
              )}
              tabIndex={0}
            >
              {isFallback ? `Video ${id}` : title}
            </h3>
          </Tooltip.Trigger>
          {isLongTitle && (
            <Tooltip.Portal>
              <Tooltip.Content side="top" className="z-50 rounded bg-black px-2 py-1 text-xs text-white shadow-lg">
                {isFallback ? `Video ${id} (Unavailable)` : title}
                <Tooltip.Arrow className="fill-black" />
              </Tooltip.Content>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
        
        {isFallback && (
          <p className="text-xs text-yellow-600 mt-1">
            Click to open in YouTube
          </p>
        )}
        
        <p className="mt-1 text-xs text-muted-foreground capitalize">
          {type}
        </p>
      </div>
    </div>
  );
}; 