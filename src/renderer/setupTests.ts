import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.electron
const mockElectron = {
  getLocalFile: vi.fn().mockResolvedValue('file:///mock.mp4'),
  getDlnaFile: vi.fn().mockResolvedValue('http://mockserver:8200/MediaItems/573.mkv')
};

// Add to window object
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
}); 