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
  isClicked?: boolean;
  type: 'youtube' | 'dlna' | 'local';
  progress?: number;
  // Enhanced error handling props
  isAvailable?: boolean;
  isFallback?: boolean;
  errorInfo?: VideoLoadError;
  // Optional custom click handler
  onVideoClick?: (video: VideoCardBaseProps) => void;
}

export const VideoCardBase: React.FC<VideoCardBaseProps> = ({
  id,
  thumbnail,
  title,
  duration,
  resumeAt,
  watched,
  isClicked,
  type,
  progress,
  isAvailable = true,
  isFallback = false,
  errorInfo,
  onVideoClick,
}) => {
  const progressPercentage = Math.min(100, Math.max(0, progress ?? 0));
  const isLongTitle = title.length > 32;
  const navigate = useNavigate();

  const handleClick = () => {
    // Only handle click for available videos - fallback videos use the link
    if (!isFallback) {
      if (onVideoClick) {
        // Use custom click handler if provided
        onVideoClick({
          id,
          thumbnail,
          title,
          duration,
          resumeAt,
          watched,
          isClicked,
          type,
          progress,
          isAvailable,
          isFallback,
          errorInfo,
          onVideoClick
        });
      } else {
        // Default navigation - URL encode the video ID to handle special characters
        navigate(`/player/${encodeURIComponent(id)}`);
      }
    }
  };

  // Common card content
  const cardContent = (
    <>
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
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="h-full w-full object-cover"
            onError={(e) => {
              // Hide broken image and show fallback
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}

        {/* Fallback thumbnail for local videos or broken images */}
        {(!thumbnail || type === 'local') && (
          <div
            className="h-full w-full bg-gray-300 flex items-center justify-center"
            style={{ display: thumbnail && type !== 'local' ? 'none' : 'flex' }}
          >
            <div className="text-4xl text-gray-500">🎬</div>
          </div>
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
          <div className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs text-white z-20">
            {formatDuration(duration)}
          </div>
        )}

        {/* Watched Video Overlay Effect */}
        {watched && !isFallback && (
          <>
            {/* White faded overlay to make thumbnail look washed out */}
            <div className="absolute inset-0 bg-white/40 rounded-t-xl z-10" />
            {/* Checkmark - appears above overlay */}
            <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg z-20">
              ✓
            </div>
          </>
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
        
        <p className={cn(
          "mt-1 text-xs capitalize",
          isClicked ? "bg-violet-500 text-white px-2 py-1 rounded" : "text-muted-foreground"
        )}>
          {type}
        </p>
      </div>
    </>
  );

  const cardClasses = cn(
    'bg-card rounded-xl border shadow-md flex flex-col w-full cursor-pointer',
    'max-w-[280px] sm:max-w-[320px] lg:max-w-[380px] xl:max-w-[420px] 2xl:max-w-[500px]',
    'transition-transform hover:scale-[1.03]',
    isFallback ? 'opacity-60 border-dashed border-yellow-400' : ''
  );

  // For fallback videos, wrap in a link that opens externally
  if (isFallback) {
    return (
      <a
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(cardClasses, 'no-underline text-inherit')}
      >
        {cardContent}
      </a>
    );
  }

  // For available videos, use the regular div with click handler
  return (
    <div
      className={cardClasses}
      tabIndex={0}
      onClick={handleClick}
    >
      {cardContent}
    </div>
  );
}; 