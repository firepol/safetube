import { KidScreen } from './pages/KidScreen';
import * as Tooltip from '@radix-ui/react-tooltip';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { PlayerRouter } from './pages/PlayerRouter';
import { TimeUpPage } from './pages/TimeUpPage';
import { SourcePage } from './pages/SourcePage';
import { AdminPage } from './pages/AdminPage';
import { RateLimitWarning } from './components/layout/RateLimitWarning';
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

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

function App() {
  return (
    <Tooltip.Provider>
      <RateLimitProvider>
        <HashRouter>
          <div className="min-h-screen bg-background">
            <Routes>
              <Route path="/" element={<KidScreen />} />
              <Route path="/source/:sourceId" element={<SourcePage />} />
              <Route path="/source/:sourceId/page/:page" element={<SourcePage />} />
              <Route path="/player/:id" element={<PlayerRouter />} />
              <Route path="/time-up" element={<TimeUpPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </div>
        </HashRouter>
      </RateLimitProvider>
    </Tooltip.Provider>
  );
}

export default App; 