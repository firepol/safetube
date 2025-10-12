import { vi } from 'vitest';
import { tmpdir } from 'os';
import path from 'path';

// Use OS temp directory for test files to avoid permission issues
const testDataPath = path.join(tmpdir(), 'safetube-test-data');

export const mockApp = {
  getPath: vi.fn().mockReturnValue(testDataPath),
};

vi.mock('electron', () => ({
  app: mockApp,
})); 