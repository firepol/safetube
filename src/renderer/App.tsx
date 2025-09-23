import { KidScreen } from './pages/KidScreen';
import * as Tooltip from '@radix-ui/react-tooltip';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { PlayerRouter } from './pages/PlayerRouter';
import { TimeUpPage } from './pages/TimeUpPage';
import { SourcePage } from './pages/SourcePage';
import { AdminPage } from './pages/AdminPage';
import { WatchedVideosPage } from './components/video/WatchedVideosPage';
import { HistoryPage } from './pages/HistoryPage';
import { ErrorFallbackPage } from './pages/ErrorFallbackPage';
import { RateLimitWarning } from './components/layout/RateLimitWarning';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Context for managing rate limit warning state
interface RateLimitContextType {
  showWarning: (lastFetched?: string) => void;
  hideWarning: () => void;
  isVisible: boolean;
  lastFetched?: string;
}

const RateLimitContext = createContext<RateLimitContextType | undefined>(undefined);

export const useRateLimit = () => {
  const context = useContext(RateLimitContext);
  if (!context) {
    throw new Error('useRateLimit must be used within a RateLimitProvider');
  }
  return context;
};

interface RateLimitProviderProps {
  children: ReactNode;
}

const RateLimitProvider: React.FC<RateLimitProviderProps> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [lastFetched, setLastFetched] = useState<string>();

  const showWarning = useCallback((lastFetched?: string) => {
    setIsVisible(true);
    if (lastFetched) {
      setLastFetched(lastFetched);
    }
  }, []);

  const hideWarning = useCallback(() => {
    setIsVisible(false);
  }, []);

  return (
    <RateLimitContext.Provider value={{ showWarning, hideWarning, isVisible, lastFetched }}>
      {children}
      <RateLimitWarning isVisible={isVisible} lastFetched={lastFetched} />
    </RateLimitContext.Provider>
  );
};

// Component to handle YouTube iframe navigation events
const YouTubeNavigationHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.electron?.onNavigateToVideo) {
      console.warn('[YouTubeNavigationHandler] Navigation events not available');
      return;
    }

    const handleNavigateToVideo = (videoId: string) => {
      console.log('[YouTubeNavigationHandler] Navigating to video:', videoId);
      // Navigate to the video player with the extracted video ID
      navigate(`/player/${encodeURIComponent(videoId)}`);
    };

    // Subscribe to navigation events
    const wrappedCallback = window.electron.onNavigateToVideo(handleNavigateToVideo);

    // Cleanup on unmount
    return () => {
      if (window.electron?.offNavigateToVideo && wrappedCallback) {
        window.electron.offNavigateToVideo(wrappedCallback);
      }
    };
  }, [navigate]);

  return null; // This component doesn't render anything
};

function App() {
  return (
    <ErrorBoundary>
      <Tooltip.Provider>
        <RateLimitProvider>
          <HashRouter>
            <YouTubeNavigationHandler />
            <div className="min-h-screen bg-background">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<KidScreen />} />
                  <Route path="/source/:sourceId" element={
                    <ErrorBoundary>
                      <SourcePage />
                    </ErrorBoundary>
                  } />
                  <Route path="/source/:sourceId/page/:page" element={
                    <ErrorBoundary>
                      <SourcePage />
                    </ErrorBoundary>
                  } />
                  <Route path="/source/:sourceId/watched" element={
                    <ErrorBoundary>
                      <WatchedVideosPage />
                    </ErrorBoundary>
                  } />
                  <Route path="/source/:sourceId/watched/:page" element={
                    <ErrorBoundary>
                      <WatchedVideosPage />
                    </ErrorBoundary>
                  } />
                  <Route path="/history" element={
                    <ErrorBoundary>
                      <HistoryPage />
                    </ErrorBoundary>
                  } />
                  <Route path="/player/:id" element={
                    <ErrorBoundary>
                      <PlayerRouter />
                    </ErrorBoundary>
                  } />
                  <Route path="/time-up" element={<TimeUpPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<ErrorFallbackPage />} />
                </Routes>
              </ErrorBoundary>
            </div>
          </HashRouter>
        </RateLimitProvider>
      </Tooltip.Provider>
    </ErrorBoundary>
  );
}

export default App; 