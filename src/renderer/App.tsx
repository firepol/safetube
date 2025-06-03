import { KidScreen } from './pages/KidScreen';
import * as Tooltip from '@radix-ui/react-tooltip';

function App() {
  return (
    <Tooltip.Provider>
      <div className="min-h-screen bg-background">
        <KidScreen />
      </div>
    </Tooltip.Provider>
  );
}

export default App; 