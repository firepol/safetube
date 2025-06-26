import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoGrid } from '../components/layout/VideoGrid';
import { TimeIndicator, TimeTrackingState } from '../components/layout/TimeIndicator';
import videos from '../data/videos.json';

export const KidScreen: React.FC = () => {
  const navigate = useNavigate();
  const [timeTrackingState, setTimeTrackingState] = useState<TimeTrackingState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkTimeLimits = async () => {
      try {
        const state = await window.electron.getTimeTrackingState();
        
        // If time limit is reached, redirect to time's up page
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
      } finally {
        setIsLoading(false);
      }
    };

    checkTimeLimits();
  }, [navigate]);

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
          type: v.type as 'youtube' | 'dlna' | 'local'
        }))}
      />
    </div>
  );
}; 