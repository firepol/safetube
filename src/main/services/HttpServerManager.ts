import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import net from 'net';
import log from '../logger';
import type { ServerConfig, ServerInfo } from '../../shared/types/server';

/**
 * MIME type mapping for common file extensions
 */
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * HTTP Server Manager for serving static files and handling port management
 */
export class HttpServerManager {
  private server: http.Server | null = null;
  private config: ServerConfig;
  private serverInfo: ServerInfo | null = null;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  /**
   * Check if a specific port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, this.config.host);
    });
  }

  /**
   * Find next available port starting from preferred port
   */
  private async findAvailablePort(startPort: number, maxAttempts: number = 4): Promise<number> {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      const available = await this.isPortAvailable(port);

      if (available) {
        log.info(`[HttpServer] Port ${port} is available`, { port });
        return port;
      } else {
        log.warn(`[HttpServer] Port ${port} is in use, trying next`, { port });
      }
    }

    // All static ports failed, use OS-assigned port (port 0)
    log.warn('[HttpServer] All static ports in use, using OS-assigned port');
    return 0;
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Parse URL
    const parsedUrl = url.parse(req.url || '/');
    const originalPathname = parsedUrl.pathname || '/';

    // Build file path
    let filePath = path.join(this.config.distPath, originalPathname);

    // Security: Prevent directory traversal (MUST be first)
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(this.config.distPath)) {
      log.warn('[HttpServer] Directory traversal attempt blocked', {
        attempted: originalPathname,
        normalized: normalizedPath,
      });
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Check if this is a request for a file without extension (SPA route)
    const isRouteWithoutExtension = originalPathname === '/' || !originalPathname.includes('.');

    // If it's a route without extension, try to serve the actual file first
    // then fall back to index.html for SPA routing
    if (isRouteWithoutExtension) {
      filePath = path.join(this.config.distPath, 'index.html');
    }

    // Serve file with appropriate Content-Type
    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // If we were trying to serve index.html for SPA and it doesn't exist
          if (isRouteWithoutExtension) {
            log.error('[HttpServer] Failed to serve index.html for SPA route', { path: originalPathname });
            res.writeHead(500);
            res.end('Server error');
          } else {
            // File with extension not found, return 404
            log.debug('[HttpServer] File not found', { path: originalPathname });
            res.writeHead(404);
            res.end('Not found');
          }
        } else {
          log.error('[HttpServer] Error reading file', { path: originalPathname, error: err.message });
          res.writeHead(500);
          res.end('Server error');
        }
      } else {
        const ext = path.extname(filePath);
        const contentType = getContentType(ext);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      }
    });
  }

  /**
   * Start the HTTP server
   * Attempts to use preferred port, falls back to next available ports, then OS-assigned
   */
  async start(): Promise<ServerInfo> {
    try {
      // Find available port
      const port = await this.findAvailablePort(this.config.port, 4);

      return new Promise((resolve, reject) => {
        this.server = http.createServer((req, res) => {
          this.handleRequest(req, res);
        });

        this.server.on('error', (err: NodeJS.ErrnoException) => {
          log.error('[HttpServer] Server error', { error: err.message, code: err.code });
          reject(new Error(`Failed to start HTTP server: ${err.message}`));
        });

        this.server.listen(port, this.config.host, () => {
          const actualPort = (this.server?.address() as net.AddressInfo)?.port || port;
          const actualHost = this.config.host;
          const protocol = 'http';

          this.serverInfo = {
            started: true,
            port: actualPort,
            host: actualHost,
            url: `${protocol}://localhost:${actualPort}`,
          };

          log.info('[HttpServer] Server started successfully', {
            port: actualPort,
            host: actualHost,
            url: this.serverInfo.url,
          });

          resolve(this.serverInfo);
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('[HttpServer] Failed to start server', { error: message });
      throw new Error(`Failed to start HTTP server: ${message}`);
    }
  }

  /**
   * Stop the HTTP server and release the port
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          log.error('[HttpServer] Error closing server', { error: err.message });
          reject(err);
        } else {
          log.info('[HttpServer] Server stopped successfully');
          this.server = null;
          this.serverInfo = null;
          resolve();
        }
      });
    });
  }

  /**
   * Get current server info (null if not started)
   */
  getInfo(): ServerInfo | null {
    return this.serverInfo;
  }
}
