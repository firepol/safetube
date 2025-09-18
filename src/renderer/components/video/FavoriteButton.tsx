import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import { FavoritesService } from '../../services/favoritesService';
import { logVerbose } from '../../lib/logging';

export interface FavoriteButtonProps {
  videoId: string;
  source: string;
  type: 'youtube' | 'local' | 'dlna';
  title: string;
  thumbnail: string;
  duration: number;
  lastWatched?: string;
  isFavorite?: boolean; // Initial state, can be overridden by async check
  onToggle?: (videoId: string, isFavorite: boolean) => void; // Callback for parent components
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  videoId,
  source,
  type,
  title,
  thumbnail,
  duration,
  lastWatched,
  isFavorite: initialFavorite,
  onToggle,
  size = 'medium',
  showLabel = false,
  className,
  disabled = false,
  'data-testid': testId
}) => {
  // State for favorite status and loading
  const [isFavorite, setIsFavorite] = useState<boolean>(initialFavorite ?? false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial favorite status if not provided
  useEffect(() => {
    if (initialFavorite === undefined && !disabled) {
      loadFavoriteStatus();
    }
  }, [videoId, initialFavorite, disabled]);

  const loadFavoriteStatus = async () => {
    try {
      const status = await FavoritesService.isFavorite(videoId, type);
      setIsFavorite(status);
      logVerbose('[FavoriteButton] Loaded initial status for', videoId, ':', status);
    } catch (error) {
      logVerbose('[FavoriteButton] Error loading favorite status:', error);
      setError('Failed to load favorite status');
    }
  };

  const handleToggle = useCallback(async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      logVerbose('[FavoriteButton] Toggling favorite for:', { videoId, isFavorite });

      const result = await FavoritesService.toggleFavorite(
        videoId,
        source,
        type,
        title,
        thumbnail,
        duration,
        lastWatched
      );

      setIsFavorite(result.isFavorite);

      // Call parent callback if provided
      if (onToggle) {
        onToggle(videoId, result.isFavorite);
      }

      logVerbose('[FavoriteButton] Successfully toggled favorite:', videoId, 'now', result.isFavorite);
    } catch (error) {
      logVerbose('[FavoriteButton] Error toggling favorite:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle favorite');

      // Keep the previous state on error
      // The optimistic update in the service will handle rollback
    } finally {
      setIsLoading(false);
    }
  }, [videoId, source, type, title, thumbnail, duration, lastWatched, isFavorite, onToggle, disabled, isLoading]);

  // Size-based styling
  const sizeClasses = {
    small: 'w-5 h-5 text-sm',
    medium: 'w-6 h-6 text-base',
    large: 'w-8 h-8 text-lg'
  };

  // Loading state styling
  const loadingClass = isLoading ? 'animate-pulse opacity-60' : '';

  // Favorite state styling
  const favoriteClass = isFavorite
    ? 'text-yellow-500 hover:text-yellow-600'
    : 'text-gray-400 hover:text-yellow-500';

  // Disabled state styling
  const disabledClass = disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer';

  // Error state styling
  const errorClass = error ? 'text-red-500' : '';

  const buttonClasses = cn(
    'transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 rounded',
    sizeClasses[size],
    loadingClass,
    error ? errorClass : favoriteClass,
    disabledClass,
    className
  );

  // Star icon - filled if favorite, outline if not
  const starIcon = isFavorite ? '⭐' : '☆';

  const buttonContent = (
    <button
      onClick={handleToggle}
      disabled={disabled || isLoading}
      className={buttonClasses}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={error || (isFavorite ? 'Remove from favorites' : 'Add to favorites')}
      data-testid={testId}
    >
      <span className="flex items-center justify-center">
        {starIcon}
        {showLabel && (
          <span className="ml-1 text-xs">
            {isFavorite ? 'Remove' : 'Add'}
          </span>
        )}
      </span>
    </button>
  );

  // If we have a tooltip-worthy error or we want to show detailed status
  if (error || showLabel) {
    return (
      <Tooltip.Root delayDuration={300}>
        <Tooltip.Trigger asChild>
          {buttonContent}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            className="z-50 rounded bg-black px-2 py-1 text-xs text-white shadow-lg"
          >
            {error || (isFavorite ? 'Remove from favorites' : 'Add to favorites')}
            <Tooltip.Arrow className="fill-black" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return buttonContent;
};

// Higher-order component wrapper for use with video cards
export const withFavoriteButton = <T extends object>(
  Component: React.ComponentType<T>
) => {
  return React.forwardRef<any, T & { showFavoriteButton?: boolean }>((props, ref) => {
    const { showFavoriteButton = false, ...componentProps } = props;

    if (!showFavoriteButton) {
      return <Component ref={ref} {...componentProps as T} />;
    }

    // This would need to be implemented based on the specific component structure
    // For now, just render the original component
    return <Component ref={ref} {...componentProps as T} />;
  });
};