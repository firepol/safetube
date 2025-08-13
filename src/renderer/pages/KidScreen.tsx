import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoGrid } from '../components/layout/VideoGrid';
import { TimeIndicator, TimeTrackingState } from '../components/layout/TimeIndicator';

export const KidScreen: React.FC = () => {
  const navigate = useNavigate();
  const [timeTrackingState, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [videos, setVideos] = useState<any[]>([]);
  const [loaderDebug, setLoaderDebug] = useState<string[]>([]);
  const [loaderError, setLoaderError] = useState<string | null>(null);

  useEffect(() => {
    const checkTimeLimits = async () => {
      try {
        if (!(window as any).electron || !(window as any).electron.getTimeTrackingState) {
          throw new Error('window.electron.getTimeTrackingState not available');
        }
        const state = await (window as any).electron.getTimeTrackingState();
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
      } catch (error) {
        console.error('Error checking time limits:', error);
      }
    };
    checkTimeLimits();
  }, [navigate]);

  useEffect(() => {
    setIsLoading(true);
    const api = (window as any).electron;
    if (api && api.loadAllVideosFromSources) {
      api.loadAllVideosFromSources()
        .then(({ videos, debug }: { videos: any[]; debug: string[] }) => {
          setVideos(videos);
          setLoaderDebug(debug);
          setLoaderError(null);
        })
        .catch((err: unknown) => {
          setVideos([]);
          setLoaderDebug([]);
          setLoaderError('Error loading videos from sources: ' + (err instanceof Error ? err.message : String(err)));
        })
        .finally(() => setIsLoading(false));
    } else {
      setLoaderError('window.electron.loadAllVideosFromSources is not available');
      setIsLoading(false);
    }
  }, []);

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

  if (!videos.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="text-lg mb-2">No videos found. Please check your configuration.</div>
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
      <VideoGrid
        videos={videos.map((v) => ({
          id: v.id,
          title: v.title,
          thumbnail: v.thumbnail,
          duration: Number(v.duration),
          type: v.type
        }))}
      />
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-gray-500">Loader Debug Info</summary>
        <pre className="bg-gray-100 p-2 rounded text-xs max-w-xl overflow-x-auto text-left">
          {loaderDebug.join('\n')}
        </pre>
      </details>
    </div>
  );
}; 