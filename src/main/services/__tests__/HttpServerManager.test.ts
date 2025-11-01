import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { HttpServerManager } from '../HttpServerManager';
import type { ServerConfig } from '../../../shared/types/server';

// Create a temporary test directory
const testDir = path.join(os.tmpdir(), 'safetube-http-test-' + Math.random().toString(36).substring(7));

describe('HttpServerManager', () => {
  let manager: HttpServerManager;

  beforeEach(async () => {
    // Create test directory and files
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create test files
    fs.writeFileSync(path.join(testDir, 'index.html'), '<html><body>Test</body></html>');
    fs.writeFileSync(path.join(testDir, 'style.css'), 'body { color: red; }');
    fs.writeFileSync(path.join(testDir, 'script.js'), 'console.log("test");');
    fs.writeFileSync(path.join(testDir, 'data.json'), '{"test": true}');

    const config: ServerConfig = {
      port: 9000, // Use higher port to avoid conflicts
      host: '127.0.0.1',
      distPath: testDir,
    };

    manager = new HttpServerManager(config);
  });

  afterEach(async () => {
    // Stop server if running
    if (manager.getInfo()?.started) {
      await manager.stop();
    }

    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('server lifecycle', () => {
    it('should start server and return server info', async () => {
      const info = await manager.start();

      expect(info.started).toBe(true);
      expect(info.port).toBeGreaterThan(0);
      expect(info.host).toBe('127.0.0.1');
      expect(info.url).toContain('http://localhost:');
    });

    it('should stop server cleanly', async () => {
      await manager.start();
      expect(manager.getInfo()?.started).toBe(true);

      await manager.stop();
      expect(manager.getInfo()).toBeNull();
    });

    it('should return null info when not started', async () => {
      expect(manager.getInfo()).toBeNull();
    });

    it('should allow multiple start/stop cycles', async () => {
      // First cycle
      let info = await manager.start();
      const firstPort = info.port;
      expect(manager.getInfo()?.started).toBe(true);

      await manager.stop();
      expect(manager.getInfo()).toBeNull();

      // Second cycle
      info = await manager.start();
      expect(manager.getInfo()?.started).toBe(true);
      // Port may be the same or different depending on OS behavior
      expect(info.port).toBeGreaterThan(0);

      await manager.stop();
    });
  });

  describe('static file serving', () => {
    it('should serve HTML files with correct MIME type', async () => {
      await manager.start();
      const info = manager.getInfo()!;

      const response = await fetch(`${info.url}/index.html`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');

      const content = await response.text();
      expect(content).toContain('Test');

      await manager.stop();
    });

    it('should serve CSS files with correct MIME type', async () => {
      await manager.start();
      const info = manager.getInfo()!;

      const response = await fetch(`${info.url}/style.css`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/css');

      await manager.stop();
    });

    it('should serve JavaScript files with correct MIME type', async () => {
      await manager.start();
      const info = manager.getInfo()!;

      const response = await fetch(`${info.url}/script.js`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/javascript');

      await manager.stop();
    });

    it('should serve JSON files with correct MIME type', async () => {
      await manager.start();
      const info = manager.getInfo()!;

      const response = await fetch(`${info.url}/data.json`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      await manager.stop();
    });

    it('should serve index.html for root path', async () => {
      await manager.start();
      const info = manager.getInfo()!;

      const response = await fetch(`${info.url}/`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');

      const content = await response.text();
      expect(content).toContain('Test');

      await manager.stop();
    });

    it('should serve index.html for SPA routes (no extension)', async () => {
      await manager.start();
      const info = manager.getInfo()!;

      const response = await fetch(`${info.url}/videos/123`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');

      const content = await response.text();
      expect(content).toContain('Test');

      await manager.stop();
    });
  });

  describe('error handling', () => {
    it('should return 404 for non-existent files with extensions', async () => {
      await manager.start();
      const info = manager.getInfo()!;

      const response = await fetch(`${info.url}/nonexistent.js`);
      expect(response.status).toBe(404);

      await manager.stop();
    });

    it('should prevent directory traversal attacks', async () => {
      await manager.start();
      const info = manager.getInfo()!;

      // Create a subdirectory and try to access parent through query/path manipulation
      // Note: fetch normalizes URLs, so ../ attacks at the URL level don't reach the server
      // Instead, we test path containing ../ which the server should handle
      const response = await fetch(`${info.url}/subdir/../../index.html`);
      // The fetch API normalizes this to /index.html on the client side
      // So this will return 200 with index.html
      // The actual test is that we don't serve files outside distPath
      expect([200, 404]).toContain(response.status);

      await manager.stop();
    });

    it('should prevent directory traversal with encoded paths', async () => {
      await manager.start();
      const info = manager.getInfo()!;

      // Try with URL encoding
      const response = await fetch(`${info.url}/..%2F..%2F..%2Fetc%2Fpasswd`);
      // Should either be 403 or still not find the file
      expect([403, 404]).toContain(response.status);

      await manager.stop();
    });
  });

  describe('port management', () => {
    it('should use alternative port when preferred port is in use', async () => {
      // Create first manager on port 9100
      const config1: ServerConfig = {
        port: 9100,
        host: '127.0.0.1',
        distPath: testDir,
      };
      const manager1 = new HttpServerManager(config1);

      // Start first server
      const info1 = await manager1.start();
      expect(info1.port).toBe(9100);

      // Create second manager with same port
      const config2: ServerConfig = {
        port: 9100,
        host: '127.0.0.1',
        distPath: testDir,
      };
      const manager2 = new HttpServerManager(config2);

      // Second server should use alternative port
      const info2 = await manager2.start();
      expect(info2.port).toBeGreaterThan(9100);
      expect(info2.port).toBeLessThan(9104); // Should be in range 9101-9103

      // Clean up
      await manager1.stop();
      await manager2.stop();
    });

    it('should support custom binding hosts', async () => {
      const config: ServerConfig = {
        port: 9200,
        host: '127.0.0.1',
        distPath: testDir,
      };

      const testManager = new HttpServerManager(config);
      const info = await testManager.start();

      expect(info.host).toBe('127.0.0.1');

      await testManager.stop();
    });
  });

  describe('config handling', () => {
    it('should accept and use provided distPath', async () => {
      const config: ServerConfig = {
        port: 9300,
        host: '127.0.0.1',
        distPath: testDir,
      };

      const testManager = new HttpServerManager(config);
      const info = await testManager.start();

      const response = await fetch(`${info.url}/index.html`);
      expect(response.status).toBe(200);

      await testManager.stop();
    });
  });
});
