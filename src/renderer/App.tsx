import { KidScreen } from './pages/KidScreen';
import * as Tooltip from '@radix-ui/react-tooltip';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlayerRouter } from './pages/PlayerRouter';
import { TimeUpPage } from './pages/TimeUpPage';

function App() {
  return (
    <Tooltip.Provider>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<KidScreen />} />
            <Route path="/player/:id" element={<PlayerRouter />} />
            <Route path="/time-up" element={<TimeUpPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </Tooltip.Provider>
  );
}

export default App; 