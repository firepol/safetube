import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SourceGrid } from '../components/layout/SourceGrid';
import { TimeIndicator } from '../components/layout/TimeIndicator';
import { useRateLimit } from '../App';

export const KidScreen: React.FC = () => {
  const navigate = useNavigate();
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderError, setLoaderError] = useState<string | null>(null);
  const [loaderDebug, setLoaderDebug] = useState<string[]>([]);
  const [timeTrackingState, setTimeTrackingState] = useState<any>(null);
  const { showWarning } = useRateLimit();

  useEffect(() => {
    const checkTimeLimits = async () => {
      try {
        if (window.electron && window.electron.getTimeTrackingState) {
          const state = await window.electron.getTimeTrackingState();
          if (state.isLimitReached) {
            navigate('/time-up');
            return;
          }
          setTimeTrackingState({
            timeRemaining: state.timeRemaining,
            timeLimit: state.timeLimitToday,
            timeUsed: state.timeUsedToday,
            isLimitReached: state.isLimitReached
          });
        }
      } catch (error) {
        console.error('Error checking time limits:', error);
      }
    };
    checkTimeLimits();
  }, [navigate]);

  useEffect(() => {
    setIsLoading(true);
    if (window.electron && window.electron.loadVideosFromSources) {
      window.electron.loadVideosFromSources()
        .then((result: any) => {
          const { videosBySource, debug } = result;
          setSources(videosBySource || []);
          setLoaderDebug(debug || []);
          setLoaderError(null);
          
          // Check if any sources are using cached data due to API failures
          const hasCachedData = videosBySource?.some((source: any) => source.usingCachedData);
          if (hasCachedData) {
            const cachedSource = videosBySource.find((source: any) => source.usingCachedData);
            if (cachedSource?.lastFetched) {
              showWarning(cachedSource.lastFetched);
            } else {
              showWarning();
            }
          }
          
          // Log the new structure for debugging
          console.log('Loaded videos by source:', videosBySource);
        })
        .catch((err: unknown) => {
          setSources([]);
          setLoaderDebug([]);
          setLoaderError('Error loading videos from sources: ' + (err instanceof Error ? err.message : String(err)));
        })
        .finally(() => setIsLoading(false));
    } else {
      setLoaderError('window.electron.loadVideosFromSources is not available');
      setIsLoading(false);
    }
  }, [showWarning]);

  // Load videos for a specific page when source or page changes
  useEffect(() => {
    // This effect is no longer needed since we don't load videos here anymore
    // Sources now navigate to separate pages
  }, []);

  const handleSourceClick = (source: any) => {
    navigate(`/source/${source.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">Loading...</div>
        </div>
      </div>
    );
  }

  if (loaderError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="text-red-600 font-bold mb-2">{loaderError}</div>
        <pre className="bg-gray-100 p-2 rounded text-xs max-w-xl overflow-x-auto text-left">
          {loaderDebug.join('\n')}
        </pre>
      </div>
    );
  }

  if (!sources.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="text-lg mb-2">No video sources found. Please check your configuration.</div>
        <pre className="bg-gray-100 p-2 rounded text-xs max-w-xl overflow-x-auto text-left">
          {loaderDebug.join('\n')}
        </pre>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Kid-Friendly Videos</h1>
        <TimeIndicator initialState={timeTrackingState} />
      </div>
      
      {/* Sources Container */}
      <div className="sources-container">
        <SourceGrid 
          sources={sources} 
          onSourceClick={handleSourceClick}
        />
      </div>
      
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-gray-500">Loader Debug Info</summary>
        <pre className="bg-gray-100 p-2 rounded text-xs max-w-xl overflow-x-auto text-left">
          {loaderDebug.join('\n')}
        </pre>
      </details>
    </div>
  );
}; 