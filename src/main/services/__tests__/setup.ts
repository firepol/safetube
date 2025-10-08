import { vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') {
        return '/tmp/claude/safetube-test';
      }
      return '/tmp/claude/safetube-test';
    },
    whenReady: async () => Promise.resolve(),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: () => [],
    fromWebContents: () => ({
      isDestroyed: () => false,
    }),
  },
}));
