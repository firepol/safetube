import { vi } from 'vitest';

export const mockApp = {
  getPath: vi.fn().mockReturnValue('/mock/user/data/path'),
};

vi.mock('electron', () => ({
  app: mockApp,
})); 