import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalVideoScanner } from './localVideoScanner';
import fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs');
const mockFs = vi.mocked(fs);

// Mock path module for consistent test results
const mockPath = '/test/videos';
const mockVideoFiles = [
  'movie1.mp4',
  'movie2.mkv',
  'show1.webm',
  'documentary.avi'
];
const mockSubfolderFiles = [
  'subfolder/episode1.mp4',
  'subfolder/episode2.mp4'
];

describe('LocalVideoScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fs.existsSync for cache directory and files
    mockFs.existsSync.mockImplementation((filePath: any) => {
      const pathStr = String(filePath);
      // Cache directory exists
      if (pathStr.includes('.cache')) return false; // No cache initially
      // Video files exist
      if (pathStr.includes('/test/videos') && mockVideoFiles.some(f => pathStr.endsWith(f))) return true;
      if (pathStr.includes('/test/videos/subfolder') && mockSubfolderFiles.some(f => pathStr.endsWith(path.basename(f)))) return true;
      // Thumbnail files don't exist for this test
      if (pathStr.includes('.jpg') || pathStr.includes('.png')) return false;
      // Test folder exists
      if (pathStr === mockPath || pathStr === path.join(mockPath, 'subfolder')) return true;
      return false;
    });

    // Mock fs.readdirSync
    mockFs.readdirSync.mockImplementation((dirPath: any, options?: any) => {
      const pathStr = String(dirPath);
      if (pathStr === mockPath) {
        return [
          { name: 'movie1.mp4', isFile: () => true, isDirectory: () => false },
          { name: 'movie2.mkv', isFile: () => true, isDirectory: () => false },
          { name: 'show1.webm', isFile: () => true, isDirectory: () => false },
          { name: 'documentary.avi', isFile: () => true, isDirectory: () => false },
          { name: 'subfolder', isFile: () => false, isDirectory: () => true }
        ] as fs.Dirent[];
      } else if (pathStr === path.join(mockPath, 'subfolder')) {
        return [
          { name: 'episode1.mp4', isFile: () => true, isDirectory: () => false },
          { name: 'episode2.mp4', isFile: () => true, isDirectory: () => false }
        ] as fs.Dirent[];
      }
      return [];
    });

    // Mock fs.mkdirSync
    mockFs.mkdirSync.mockImplementation(() => {});

    // Mock fs.writeFileSync for cache
    mockFs.writeFileSync.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate URI-style video IDs for local videos', async () => {
    const result = await LocalVideoScanner.scanFolder('test-source', mockPath, 2);

    expect(result.videos).toHaveLength(6); // 4 main + 2 subfolder

    // Check that all videos have URI-style IDs
    result.videos.forEach(video => {
      expect(video.id).toMatch(/^local:/);
      expect(video.id).toContain(mockPath);
    });

    // Check specific video
    const movie1 = result.videos.find(v => v.title === 'movie1');
    expect(movie1).toBeDefined();
    expect(movie1?.id).toBe(`local:${path.join(mockPath, 'movie1.mp4')}`);
    expect(movie1?.url).toBe(path.join(mockPath, 'movie1.mp4'));
  });

  it('should extract video titles from filenames', async () => {
    const result = await LocalVideoScanner.scanFolder('test-source', mockPath, 2);

    const expectedTitles = ['movie1', 'movie2', 'show1', 'documentary', 'episode1', 'episode2'];
    const actualTitles = result.videos.map(v => v.title).sort();

    expect(actualTitles).toEqual(expectedTitles.sort());
  });

  it('should handle different video file extensions', async () => {
    const result = await LocalVideoScanner.scanFolder('test-source', mockPath, 2);

    const extensions = result.videos.map(v => path.extname(v.url));
    expect(extensions).toContain('.mp4');
    expect(extensions).toContain('.mkv');
    expect(extensions).toContain('.webm');
    expect(extensions).toContain('.avi');
  });

  it('should respect maxDepth parameter', async () => {
    const resultDepth1 = await LocalVideoScanner.scanFolder('test-source', mockPath, 1);
    const resultDepth2 = await LocalVideoScanner.scanFolder('test-source', mockPath, 2);

    // With maxDepth 1, should only get main folder videos (4)
    expect(resultDepth1.videos).toHaveLength(4);

    // With maxDepth 2, should get main + subfolder videos (6)
    expect(resultDepth2.videos).toHaveLength(6);
  });

  it('should set correct depth for videos', async () => {
    const result = await LocalVideoScanner.scanFolder('test-source', mockPath, 2);

    const mainVideos = result.videos.filter(v => v.depth === 1);
    const subVideos = result.videos.filter(v => v.depth === 2);

    expect(mainVideos).toHaveLength(4);
    expect(subVideos).toHaveLength(2);
  });

  it('should find thumbnails when they exist', async () => {
    // Mock thumbnail existence for one video
    mockFs.existsSync.mockImplementation((filePath: any) => {
      const pathStr = String(filePath);
      if (pathStr === path.join(mockPath, 'movie1.jpg')) return true;
      // Use original logic for other files
      if (pathStr.includes('.cache')) return false;
      if (pathStr.includes('/test/videos') && mockVideoFiles.some(f => pathStr.endsWith(f))) return true;
      if (pathStr === mockPath || pathStr === path.join(mockPath, 'subfolder')) return true;
      return false;
    });

    const result = await LocalVideoScanner.scanFolder('test-source', mockPath, 2);
    const movie1 = result.videos.find(v => v.title === 'movie1');

    expect(movie1?.thumbnail).toBe(path.join(mockPath, 'movie1.jpg'));
  });

  it('should handle scanning errors gracefully', async () => {
    // Mock readdir to throw error
    mockFs.readdirSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = await LocalVideoScanner.scanFolder('test-source', '/nonexistent', 2);

    // Should return empty result without crashing
    expect(result.videos).toEqual([]);
    expect(result.totalVideos).toBe(0);
  });

});