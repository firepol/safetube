import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SourceGrid } from '../components/layout/SourceGrid';
import { TimeIndicator, TimeTrackingState } from '../components/layout/TimeIndicator';

export const KidScreen: React.FC = () => {
  const navigate = useNavigate();
  const [timeTrackingState, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [sources, setSources] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState<any>(null);
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
    if (window.electron && window.electron.loadAllVideosFromSources) {
      window.electron.loadAllVideosFromSources()
        .then((result: any) => {
          const { videosBySource, debug } = result;
          setSources(videosBySource || []);
          setLoaderDebug(debug || []);
          setLoaderError(null);
          
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
      <SourceGrid 
        sources={sources} 
        onSourceClick={(source) => setSelectedSource(source)}
      />
      
      {/* Show videos when a source is selected */}
      {selectedSource && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSelectedSource(null)}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
              >
                ← Back to Sources
              </button>
              <h2 className="text-xl font-semibold">{selectedSource.title}</h2>
              <span className="text-sm text-gray-500">({selectedSource.videoCount} videos)</span>
            </div>
          </div>
          
          {/* Video Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {selectedSource.videos.map((video: any) => (
              <div
                key={video.id}
                className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                onClick={() => {
                  if (video.type === 'youtube') {
                    navigate(`/youtube-player/${video.id}`, { 
                      state: { videoTitle: video.title } 
                    });
                  } else if (video.type === 'local') {
                    navigate(`/player/${video.id}`);
                  }
                }}
              >
                <div className="aspect-video bg-gray-200 overflow-hidden">
                  {video.thumbnail ? (
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                      <div className="text-2xl text-gray-500">📹</div>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
                    {video.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {video.type === 'youtube' ? 'YouTube' : 'Local Video'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-gray-500">Loader Debug Info</summary>
        <pre className="bg-gray-100 p-2 rounded text-xs max-w-xl overflow-x-auto text-left">
          {loaderDebug.join('\n')}
        </pre>
      </details>
    </div>
  );
}; 