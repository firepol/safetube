import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoGrid } from '../components/layout/VideoGrid';
import { TimeIndicator, TimeTrackingState } from '../components/layout/TimeIndicator';
import { loadAllVideosFromSources } from '../lib/loadAllVideosFromSources';

export const KidScreen: React.FC = () => {
  const navigate = useNavigate();
  const [timeTrackingState, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    const checkTimeLimits = async () => {
      try {
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
      } catch (error) {
        console.error('Error checking time limits:', error);
      }
    };
    checkTimeLimits();
  }, [navigate]);

  useEffect(() => {
    setIsLoading(true);
    loadAllVideosFromSources()
      .then(setVideos)
      .catch((err) => {
        console.error('Error loading videos from sources:', err);
        setVideos([]);
      })
      .finally(() => setIsLoading(false));
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
    </div>
  );
}; 