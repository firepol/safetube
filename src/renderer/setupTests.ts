import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.electron
const mockElectron = {
  getLocalFile: vi.fn().mockResolvedValue('file:///mock.mp4'),
  getDlnaFile: vi.fn().mockResolvedValue('http://mockserver:8200/MediaItems/573.mkv')
};

// Mock time tracking functions
vi.mock('../../shared/timeTracking', () => ({
  recordVideoWatching: vi.fn().mockResolvedValue(undefined),
  getTimeTrackingState: vi.fn().mockResolvedValue({
    timeRemaining: 3600, // 1 hour remaining
    isLimitReached: false
  })
}));

// Add to window object
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
}); 