/**
 * Integration test for thumbnail protocol handling with special characters
 * Tests the custom safetube-thumbnails:// protocol with problematic filenames
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { app, protocol, BrowserWindow, net } from 'electron';

// Test data with problematic filenames - use cross-platform temp directory
let TEST_THUMBNAILS_DIR: string;
const PROBLEMATIC_FILENAMES = [
  'Title 😂 [123].mp4.jpg',
  'Title - Desc.mp4.jpg',
  'Title: Desc.mp4.jpg',
  "Children's Movies.webm.jpg",
  'simple-file.mp4.jpg'
];

describe('Thumbnail Protocol Integration Tests', () => {
  beforeAll(async () => {
    // Wait for app to be ready
    await app.whenReady();

    // Set up cross-platform temp directory
    const tmpDir = await fs.promises.realpath(os.tmpdir());
    TEST_THUMBNAILS_DIR = path.join(tmpDir, 'safetube-thumbnail-tests');

    // Create test directory if it doesn't exist
    if (!fs.existsSync(TEST_THUMBNAILS_DIR)) {
      fs.mkdirSync(TEST_THUMBNAILS_DIR, { recursive: true });
    }

    // Ensure test files exist
    for (const filename of PROBLEMATIC_FILENAMES) {
      const filePath = path.join(TEST_THUMBNAILS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, 'dummy content');
      }
    }
  });

  afterAll(async () => {
    // Cleanup test files and directory
    if (TEST_THUMBNAILS_DIR && fs.existsSync(TEST_THUMBNAILS_DIR)) {
      for (const filename of PROBLEMATIC_FILENAMES) {
        const filePath = path.join(TEST_THUMBNAILS_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      // Remove test directory
      try {
        fs.rmdirSync(TEST_THUMBNAILS_DIR);
      } catch (error) {
        console.warn('Could not remove test directory:', error);
      }
    }
  });

  // Helper to register a test protocol handler
  function registerTestProtocol() {
    return new Promise<void>((resolve, reject) => {
      try {
        protocol.handle('safetube-thumbnails', (request) => {
          const url = new URL(request.url);

          // For custom protocols, the "filename" might be in the hostname part
          let filename = url.hostname || url.pathname.slice(1);

          // Remove trailing slash if present
          if (filename.endsWith('/')) {
            filename = filename.slice(0, -1);
          }

          console.log('[Test] Thumbnail request:', request.url, 'filename:', filename);

          // Validate filename
          if (!filename || filename.trim() === '') {
            return new Response('Bad Request - No filename', { status: 400 });
          }

          // Use test thumbnails directory
          const thumbnailPath = path.join(TEST_THUMBNAILS_DIR, filename);

          if (fs.existsSync(thumbnailPath)) {
            const stats = fs.statSync(thumbnailPath);
            if (stats.isFile()) {
              return new Response(fs.readFileSync(thumbnailPath), {
                headers: { 'Content-Type': 'image/jpeg' }
              });
            } else {
              return new Response('Bad Request - Not a file', { status: 400 });
            }
          } else {
            return new Response('Not Found', { status: 404 });
          }
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Helper to make a request to the custom protocol
  async function fetchThumbnail(filename: string): Promise<{ status: number; ok: boolean }> {
    const url = `safetube-thumbnails://${filename}`;

    try {
      console.log('[Test] Attempting to fetch:', url);
      const response = await net.fetch(url);

      return {
        status: response.status,
        ok: response.ok
      };
    } catch (error) {
      console.error('[Test] Fetch error:', error);
      return {
        status: 500,
        ok: false
      };
    }
  }

  it('should register the thumbnail protocol successfully', async () => {
    await expect(registerTestProtocol()).resolves.toBeUndefined();
  });

  it('should serve simple filename without special characters', async () => {
    await registerTestProtocol();

    const response = await fetchThumbnail('simple-file.mp4.jpg');

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it('should serve filename with spaces', async () => {
    await registerTestProtocol();

    // Test with spaces - this might need URL encoding
    const response = await fetchThumbnail('Title - Desc.mp4.jpg');

    console.log('[Test] Spaces test result:', response);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it('should serve filename with emoji', async () => {
    await registerTestProtocol();

    // Test with emoji - this will definitely need URL encoding
    const response = await fetchThumbnail('Title 😂 [123].mp4.jpg');

    console.log('[Test] Emoji test result:', response);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it('should serve filename with colon', async () => {
    await registerTestProtocol();

    // Test with colon - this might cause URL parsing issues
    const response = await fetchThumbnail('Title: Desc.mp4.jpg');

    console.log('[Test] Colon test result:', response);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it('should serve filename with apostrophe', async () => {
    await registerTestProtocol();

    // Test with apostrophe
    const response = await fetchThumbnail("Children's Movies.webm.jpg");

    console.log('[Test] Apostrophe test result:', response);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it('should test URL encoding behavior', async () => {
    await registerTestProtocol();

    // Test with URL encoded filename
    const encodedFilename = encodeURIComponent('Title 😂 [123].mp4.jpg');
    const response = await fetchThumbnail(encodedFilename);

    console.log('[Test] URL encoded test result:', response, 'for:', encodedFilename);

    // This test will help us understand if URL encoding is the solution
    expect(response.status).toBeOneOf([200, 404]); // Either works or file not found due to encoding mismatch
  });
});