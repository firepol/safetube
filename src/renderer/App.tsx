import { KidScreen } from './pages/KidScreen';
import * as Tooltip from '@radix-ui/react-tooltip';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { PlayerRouter } from './pages/PlayerRouter';
import { TimeUpPage } from './pages/TimeUpPage';
import { SourcePage } from './pages/SourcePage';
import { AdminPage } from './pages/AdminPage';
import { WatchedVideosPage } from './components/video/WatchedVideosPage';
import { HistoryPage } from './pages/HistoryPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { WishlistPage } from './pages/WishlistPage';
import { ErrorFallbackPage } from './pages/ErrorFallbackPage';
import { RateLimitWarning } from './components/layout/RateLimitWarning';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { WishlistProvider } from './contexts/WishlistContext';
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

    const handleNavigateToVideo = (data: string | { videoId: string; videoMetadata?: any }) => {
      let videoId: string;
      let videoMetadata: any = undefined;

      // Handle both old format (string videoId) and new format (object with videoId and videoMetadata)
      if (typeof data === 'string') {
        videoId = data;
      } else {
        videoId = data.videoId;
        videoMetadata = data.videoMetadata;
      }

      console.log('[YouTubeNavigationHandler] Navigating to video:', videoId, videoMetadata ? 'with metadata' : 'without metadata');

      // Navigate to the video player with the extracted video ID and pass metadata if available
      navigate(`/player/${encodeURIComponent(videoId)}`, {
        state: videoMetadata ? { videoMetadata } : undefined
      });
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

// Component to handle validation error events
const ValidationErrorHandler: React.FC = () => {
  const [channelNotApprovedError, setChannelNotApprovedError] = useState<{
    videoId: string;
    channelId: string;
    title: string;
  } | null>(null);
  const [validationError, setValidationError] = useState<{ message: string } | null>(null);

  useEffect(() => {
    if (!window.electron?.onShowChannelNotApprovedError || !window.electron?.onShowValidationError) {
      console.warn('[ValidationErrorHandler] Validation error events not available');
      return;
    }

    const handleChannelNotApprovedError = (data: { videoId: string; channelId: string; title: string }) => {
      console.log('[ValidationErrorHandler] Channel not approved:', data);
      setChannelNotApprovedError(data);
    };

    const handleValidationError = (data: { message: string }) => {
      console.log('[ValidationErrorHandler] Validation error:', data);
      setValidationError(data);
    };

    // Subscribe to error events
    const channelErrorCallback = window.electron.onShowChannelNotApprovedError(handleChannelNotApprovedError);
    const validationErrorCallback = window.electron.onShowValidationError(handleValidationError);

    // Cleanup on unmount
    return () => {
      if (window.electron?.offShowChannelNotApprovedError && channelErrorCallback) {
        window.electron.offShowChannelNotApprovedError(channelErrorCallback);
      }
      if (window.electron?.offShowValidationError && validationErrorCallback) {
        window.electron.offShowValidationError(validationErrorCallback);
      }
    };
  }, []);

  // Simple alert-based error display for now
  // TODO: Replace with proper dialog components in Phase 5
  useEffect(() => {
    if (channelNotApprovedError) {
      alert(`This video's channel is not approved.\n\nVideo: ${channelNotApprovedError.title}`);
      setChannelNotApprovedError(null);
    }
  }, [channelNotApprovedError]);

  useEffect(() => {
    if (validationError) {
      alert(`Unable to play video: ${validationError.message}`);
      setValidationError(null);
    }
  }, [validationError]);

  return null; // This component doesn't render anything
};

function App() {
  return (
    <ErrorBoundary>
      <Tooltip.Provider>
        <RateLimitProvider>
          <WishlistProvider>
            <HashRouter>
              <YouTubeNavigationHandler />
              <ValidationErrorHandler />
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
                  <Route path="/search" element={
                    <ErrorBoundary>
                      <SearchResultsPage />
                    </ErrorBoundary>
                  } />
                  <Route path="/wishlist" element={
                    <ErrorBoundary>
                      <WishlistPage />
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
        </WishlistProvider>
      </RateLimitProvider>
    </Tooltip.Provider>
  </ErrorBoundary>
);
}

export default App; 