import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ipcMain } from 'electron';
import { registerServerHandlers } from '../serverHandlers';
import type { HttpServerManager } from '../../services/HttpServerManager';
import type { ServerInfo } from '../../../shared/types/server';

// Mock electron ipcMain
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock NetworkUtils
vi.mock('../../services/NetworkUtils', () => ({
  NetworkUtils: {
    getLocalIPAddress: vi.fn(() => '192.168.1.100'),
  },
}));

describe('Server IPC Handlers', () => {
  let mockServerManager: Partial<HttpServerManager>;
  let handlers: Map<string, Function>;

  beforeEach(() => {
    handlers = new Map();
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers.set(channel, handler);
      return ipcMain as any;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    handlers.clear();
  });

  describe('registerServerHandlers', () => {
    it('should register GET_SERVER_INFO handler', () => {
      mockServerManager = { getInfo: vi.fn() };

      registerServerHandlers(mockServerManager as HttpServerManager);

      expect(handlers.has('server:get-info')).toBe(true);
    });

    it('should register GET_NETWORK_INFO handler', () => {
      mockServerManager = { getInfo: vi.fn() };

      registerServerHandlers(mockServerManager as HttpServerManager);

      expect(handlers.has('server:get-network-info')).toBe(true);
    });

    it('should handle null server manager gracefully', () => {
      registerServerHandlers(null);

      expect(handlers.has('server:get-info')).toBe(true);
      expect(handlers.has('server:get-network-info')).toBe(true);
    });
  });

  describe('GET_SERVER_INFO handler', () => {
    it('should return server info when server is running', async () => {
      const serverInfo: ServerInfo = {
        started: true,
        port: 3000,
        host: '127.0.0.1',
        url: 'http://localhost:3000',
      };

      mockServerManager = {
        getInfo: vi.fn(() => serverInfo),
      };

      registerServerHandlers(mockServerManager as HttpServerManager);
      const handler = handlers.get('server:get-info');

      const result = await handler();

      expect(result).toEqual(serverInfo);
    });

    it('should return null when server is not started', async () => {
      mockServerManager = {
        getInfo: vi.fn(() => null),
      };

      registerServerHandlers(mockServerManager as HttpServerManager);
      const handler = handlers.get('server:get-info');

      const result = await handler();

      expect(result).toBeNull();
    });

    it('should return null when server manager is null', async () => {
      registerServerHandlers(null);
      const handler = handlers.get('server:get-info');

      const result = await handler();

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockServerManager = {
        getInfo: vi.fn(() => {
          throw new Error('Test error');
        }),
      };

      registerServerHandlers(mockServerManager as HttpServerManager);
      const handler = handlers.get('server:get-info');

      const result = await handler();

      expect(result).toBeNull();
    });
  });

  describe('GET_NETWORK_INFO handler', () => {
    it('should return network info when remote access is enabled', async () => {
      const serverInfo: ServerInfo = {
        started: true,
        port: 3000,
        host: '0.0.0.0',
        url: 'http://localhost:3000',
      };

      mockServerManager = {
        getInfo: vi.fn(() => serverInfo),
      };

      registerServerHandlers(mockServerManager as HttpServerManager);
      const handler = handlers.get('server:get-network-info');

      const result = await handler();

      expect(result).toEqual({
        localIP: '192.168.1.100',
        port: 3000,
        url: 'http://192.168.1.100:3000',
      });
    });

    it('should return null when remote access is disabled (host is 127.0.0.1)', async () => {
      const serverInfo: ServerInfo = {
        started: true,
        port: 3000,
        host: '127.0.0.1',
        url: 'http://localhost:3000',
      };

      mockServerManager = {
        getInfo: vi.fn(() => serverInfo),
      };

      registerServerHandlers(mockServerManager as HttpServerManager);
      const handler = handlers.get('server:get-network-info');

      const result = await handler();

      expect(result).toBeNull();
    });

    it('should return null when server is not started', async () => {
      mockServerManager = {
        getInfo: vi.fn(() => null),
      };

      registerServerHandlers(mockServerManager as HttpServerManager);
      const handler = handlers.get('server:get-network-info');

      const result = await handler();

      expect(result).toBeNull();
    });

    it('should return null when server manager is null', async () => {
      registerServerHandlers(null);
      const handler = handlers.get('server:get-network-info');

      const result = await handler();

      expect(result).toBeNull();
    });

    it('should include correct network info format', async () => {
      const serverInfo: ServerInfo = {
        started: true,
        port: 3001,
        host: '0.0.0.0',
        url: 'http://localhost:3001',
      };

      mockServerManager = {
        getInfo: vi.fn(() => serverInfo),
      };

      registerServerHandlers(mockServerManager as HttpServerManager);
      const handler = handlers.get('server:get-network-info');

      const result = await handler();

      expect(result).toBeDefined();
      expect(result?.localIP).toBe('192.168.1.100');
      expect(result?.port).toBe(3001);
      expect(result?.url).toBe('http://192.168.1.100:3001');
    });

    it('should handle errors gracefully', async () => {
      mockServerManager = {
        getInfo: vi.fn(() => {
          throw new Error('Test error');
        }),
      };

      registerServerHandlers(mockServerManager as HttpServerManager);
      const handler = handlers.get('server:get-network-info');

      const result = await handler();

      expect(result).toBeNull();
    });
  });
});
