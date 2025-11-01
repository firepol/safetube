import { ipcMain } from 'electron';
import log from '../logger';
import { IPC } from '../../shared/ipc-channels';
import { NetworkUtils } from '../services/NetworkUtils';
import type { HttpServerManager } from '../services/HttpServerManager';

/**
 * Register HTTP server IPC handlers
 * @param httpServerManager - The HTTP server manager instance (may be null if not started)
 */
export function registerServerHandlers(httpServerManager: HttpServerManager | null): void {
  /**
   * Get HTTP server information
   * Returns current server status (port, host, URL)
   */
  ipcMain.handle(IPC.SERVER.GET_SERVER_INFO, async () => {
    try {
      if (!httpServerManager) {
        log.debug('[Server IPC] HTTP server not initialized');
        return null;
      }

      const info = httpServerManager.getInfo();

      if (!info) {
        log.debug('[Server IPC] HTTP server not started');
        return null;
      }

      log.debug('[Server IPC] GET_SERVER_INFO requested', {
        port: info.port,
        host: info.host,
        started: info.started,
      });

      return info;
    } catch (error) {
      log.error('[Server IPC] Error getting server info:', error instanceof Error ? error.message : error);
      return null;
    }
  });

  /**
   * Get network information for remote access display
   * Only returns info if remote access is enabled (host is 0.0.0.0)
   */
  ipcMain.handle(IPC.SERVER.GET_NETWORK_INFO, async () => {
    try {
      if (!httpServerManager) {
        log.debug('[Server IPC] HTTP server not initialized');
        return null;
      }

      const serverInfo = httpServerManager.getInfo();

      if (!serverInfo || !serverInfo.started) {
        log.debug('[Server IPC] HTTP server not started');
        return null;
      }

      // Only return network info if bound to 0.0.0.0 (remote access enabled)
      if (serverInfo.host !== '0.0.0.0') {
        log.debug('[Server IPC] Remote access not enabled (host is not 0.0.0.0)');
        return null;
      }

      // Get local IP address for network info display
      const localIP = NetworkUtils.getLocalIPAddress();

      const networkInfo = {
        localIP,
        port: serverInfo.port,
        url: `http://${localIP}:${serverInfo.port}`,
      };

      log.debug('[Server IPC] GET_NETWORK_INFO requested', networkInfo);

      return networkInfo;
    } catch (error) {
      log.error('[Server IPC] Error getting network info:', error instanceof Error ? error.message : error);
      return null;
    }
  });

  log.info('[Server IPC] Server handlers registered successfully');
}
