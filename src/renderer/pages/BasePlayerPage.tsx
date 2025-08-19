import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Video } from '../types';
import { TimeIndicator } from '../components/layout/TimeIndicator';
import { CountdownOverlay } from '../components/video/CountdownOverlay';
import { audioWarningService } from '../services/audioWarning';

export interface BasePlayerPageProps {
  video: Video | null;
  isLoading: boolean;
  error: string | null;
  isVideoPlaying: boolean;
  timeRemainingSeconds: number;
  countdownWarningSeconds: number;


  children: React.ReactNode;

}

export const BasePlayerPage: React.FC<BasePlayerPageProps> = ({
  video,
  isLoading,
  error,
  isVideoPlaying,
  timeRemainingSeconds,
  countdownWarningSeconds,
  children,

}) => {
  const navigate = useNavigate();
  const location = useLocation();







  // Fetch countdown configuration and initialize audio warning service
  useEffect(() => {
    const fetchCountdownConfig = async () => {
      try {
        const timeLimits = await window.electron.getTimeLimits();
        const countdownSeconds = timeLimits.countdownWarningSeconds ?? 60;
        const audioWarningSeconds = timeLimits.audioWarningSeconds ?? 10;
        const useSystemBeep = timeLimits.useSystemBeep ?? true;
        const customBeepSound = timeLimits.customBeepSound;
        
        // logVerbose('[BasePlayerPage] Initializing audio warning service with:', {
        //   countdownSeconds,
        //   audioWarningSeconds,
        //   useSystemBeep,
        //   customBeepSound
        // });
        
        // Initialize audio warning service
        await audioWarningService.initialize({
          countdownWarningSeconds: countdownSeconds,
          audioWarningSeconds: audioWarningSeconds,
          useSystemBeep: useSystemBeep,
          customBeepSound: customBeepSound,
        });
      } catch (error) {
        console.error('Error fetching countdown configuration:', error);
      }
    };

    fetchCountdownConfig();
  }, []);

  // Cleanup audio warning service on unmount
  useEffect(() => {
    return () => {
      audioWarningService.destroy();
    };
  }, []);

  const handleBackClick = () => {
    const returnTo = (location.state as any)?.returnTo;
    if (returnTo) {
      navigate(returnTo);
    } else {
      navigate(-1);
    }
  };













  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="p-4">
          <button
            onClick={handleBackClick}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← Back
          </button>
          <div className="text-center">
            <div className="text-lg mb-2">Loading video...</div>
            <div className="text-sm text-gray-500">This may take a few moments</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="p-4">
          <button
            onClick={handleBackClick}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← Back
          </button>
          <div className="text-red-500">{error || 'Video not found'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBackClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ← Back
          </button>
          <TimeIndicator realTime={true} updateInterval={3000} />
        </div>
        <h1 className="text-2xl font-bold mb-4">{video.title}</h1>
        {isLoading && (
          <div className="text-center mb-4">
            <div className="text-lg mb-2">Loading video...</div>
            <div className="text-sm text-gray-500">This may take a few moments</div>
          </div>
        )}
        {error && (
          <div className="text-center text-red-500 mb-4">
            <div className="text-lg mb-2">Error: {error}</div>
            <div className="text-sm">The video may be unavailable or the stream may have expired</div>
          </div>
        )}
      </div>
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-4xl relative">
          {children}
          <CountdownOverlay
            isVisible={!isLoading && !error}
            timeRemainingSeconds={timeRemainingSeconds}
            isVideoPlaying={isVideoPlaying}
            shouldShowCountdown={timeRemainingSeconds <= countdownWarningSeconds && timeRemainingSeconds > 0}
          />
        </div>
      </div>
    </div>
  );
};
