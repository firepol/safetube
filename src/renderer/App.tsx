import { KidScreen } from './pages/KidScreen';
import * as Tooltip from '@radix-ui/react-tooltip';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlayerRouter } from './pages/PlayerRouter';
import { TimeUpPage } from './pages/TimeUpPage';
import { TestYouTubeIframePage } from './pages/TestYouTubeIframePage';

function App() {
  return (
    <Tooltip.Provider>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<KidScreen />} />
            <Route path="/player/:id" element={<PlayerRouter />} />
            <Route path="/time-up" element={<TimeUpPage />} />
            <Route path="/test-youtube-iframe" element={<TestYouTubeIframePage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </Tooltip.Provider>
  );
}

export default App; 