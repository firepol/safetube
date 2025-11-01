import { describe, it, expect } from 'vitest';
import { IPC } from '../ipc-channels';
import type { ServerConfig, ServerInfo, NetworkInfo } from './server';

describe('Server Types', () => {
  it('should export ServerConfig interface', () => {
    // This test verifies that the type can be imported and used
    const config: ServerConfig = {
      port: 3000,
      host: '127.0.0.1',
      distPath: '/path/to/dist',
    };

    expect(config.port).toBe(3000);
    expect(config.host).toBe('127.0.0.1');
  });

  it('should export ServerInfo interface', () => {
    const info: ServerInfo = {
      started: true,
      port: 3000,
      host: '127.0.0.1',
      url: 'http://localhost:3000',
    };

    expect(info.started).toBe(true);
    expect(info.url).toBe('http://localhost:3000');
  });

  it('should export NetworkInfo interface', () => {
    const networkInfo: NetworkInfo = {
      localIP: '192.168.1.100',
      port: 3000,
      url: 'http://192.168.1.100:3000',
    };

    expect(networkInfo.localIP).toBe('192.168.1.100');
  });

  it('should have SERVER IPC channels defined', () => {
    expect(IPC.SERVER).toBeDefined();
    expect(IPC.SERVER.GET_SERVER_INFO).toBe('server:get-info');
    expect(IPC.SERVER.GET_NETWORK_INFO).toBe('server:get-network-info');
  });
});
