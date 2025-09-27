import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface VideoSkeletonProps {
  count?: number;
  className?: string;
}

export const VideoSkeleton: React.FC<VideoSkeletonProps> = memo(({
  count = 15,
  className
}) => {
  // 🚀 PERFORMANCE: Memoize skeleton items to prevent re-creation
  const skeletonItems = React.useMemo(() => {
    const start = performance.now();
    console.log(`💀 [VideoSkeleton] Rendering ${count} skeleton items`);

    const items = Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-gray-200 rounded-lg animate-pulse">
        <div className="aspect-video bg-gray-300 rounded-t-lg"></div>
        <div className="p-3">
          <div className="h-4 bg-gray-300 rounded mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-3/4"></div>
        </div>
      </div>
    ));

    const duration = performance.now() - start;
    console.log(`🚀 [VideoSkeleton] Created skeleton in ${duration.toFixed(2)}ms`);
    performance.mark(`videoskeleton-render-${count}`);

    return items;
  }, [count]);

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4', className)}>
      {skeletonItems}
    </div>
  );
});

VideoSkeleton.displayName = 'VideoSkeleton';