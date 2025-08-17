import fs from 'fs';
import path from 'path';

// Mock the scanLocalFolder function for testing
async function scanLocalFolder(folderPath: string, maxDepth: number): Promise<any[]> {
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
  
  try {
    // Resolve relative paths from project root
    const absolutePath = path.isAbsolute(folderPath) ? folderPath : path.join(process.cwd(), folderPath);
    
    if (!fs.existsSync(absolutePath)) {
      return [];
    }
    
    // Start scanning from the root folder (depth 1)
    scanFolderRecursive(absolutePath, 1, maxDepth, videos, supportedExtensions);
    
    return videos;
    
  } catch (error) {
    return [];
  }
}

// Recursive function to scan folders with flattening behavior
function scanFolderRecursive(currentPath: string, currentDepth: number, maxDepth: number, videos: any[], supportedExtensions: string[]): void {
  try {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // If we're at maxDepth, flatten all content from this directory
        if (currentDepth === maxDepth) {
          // Recursively scan deeper content but mark it as being at maxDepth
          scanFolderDeeper(itemPath, currentDepth + 1, maxDepth, videos, supportedExtensions);
        } else {
          // Continue scanning normally
          scanFolderRecursive(itemPath, currentDepth + 1, maxDepth, videos, supportedExtensions);
        }
      } else if (stats.isFile()) {
        // Check if it's a video file
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          const relativePath = path.relative(process.cwd(), itemPath);
          const video = {
            id: `local-${relativePath.replace(/[^a-zA-Z0-9]/g, '-')}`,
            title: path.basename(item, ext),
            thumbnail: 'https://via.placeholder.com/300x200?text=Local+Video',
            duration: 0,
            type: 'local',
            path: `file://${itemPath}`,
            filename: item,
            extension: ext,
            size: stats.size,
            modified: stats.mtime,
            depth: currentDepth, // Track the depth where this video was found
            relativePath: path.relative(path.join(process.cwd(), 'test-videos'), itemPath) // Track relative path from test-videos root
          };
          videos.push(video);
        }
      }
    }
  } catch (error) {
    // Ignore errors in test
  }
}

// Function to scan deeper content when flattening at maxDepth
function scanFolderDeeper(currentPath: string, currentDepth: number, maxDepth: number, videos: any[], supportedExtensions: string[]): void {
  try {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Continue scanning deeper recursively
        scanFolderDeeper(itemPath, currentDepth + 1, maxDepth, videos, supportedExtensions);
      } else if (stats.isFile()) {
        // Check if it's a video file
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          const relativePath = path.relative(process.cwd(), itemPath);
          const video = {
            id: `local-${relativePath.replace(/[^a-zA-Z0-9]/g, '-')}`,
            title: path.basename(item, ext),
            thumbnail: 'https://via.placeholder.com/300x200?text=Local+Video',
            duration: 0,
            type: 'local',
            path: `file://${itemPath}`,
            filename: item,
            extension: ext,
            size: stats.size,
            modified: stats.mtime,
            depth: maxDepth, // Mark as being at maxDepth (flattened)
            relativePath: path.relative(path.join(process.cwd(), 'test-videos'), itemPath), // Track relative path from test-videos root
            flattened: true // Mark as flattened content
          };
          videos.push(video);
        }
      }
    }
  } catch (error) {
    // Ignore errors in test
  }
}

describe('Local Folder Scanning with maxDepth', () => {
  const testVideosPath = path.join(process.cwd(), 'test-videos');
  
  beforeAll(() => {
    // Ensure test-videos directory exists
    expect(fs.existsSync(testVideosPath)).toBe(true);
  });
  
  test('should scan test-videos folder and find video files', async () => {
    const videos = await scanLocalFolder('test-videos', 2);
    
    expect(videos.length).toBeGreaterThan(0);
    expect(videos.some(v => v.filename === 'sample-local.mp4')).toBe(true);
  });
  
  test('should only include supported video file extensions', async () => {
    const videos = await scanLocalFolder('test-videos', 2);
    
    const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
    
    videos.forEach(video => {
      expect(supportedExtensions).toContain(video.extension);
      expect(video.type).toBe('local');
      expect(video.path).toMatch(/^file:\/\//);
    });
  });
  
  test('should respect maxDepth parameter - depth 1 (flattened view)', async () => {
    // Test with maxDepth 1 - should show all videos from all subfolders flattened at depth 1
    const videosDepth1 = await scanLocalFolder('test-videos', 1);
    
    // Should find videos from all depths flattened into one list at depth 1
    expect(videosDepth1.length).toBeGreaterThan(0);
    
    // Check that we have videos from different depths
    const depth1Videos = videosDepth1.filter(v => v.depth === 1);
    const depth2Videos = videosDepth1.filter(v => v.depth === 2);
    const depth3Videos = videosDepth1.filter(v => v.depth === 3);
    
    // With maxDepth 1, all videos should be at depth 1 (flattened)
    expect(depth1Videos.length).toBeGreaterThan(0);
    expect(depth2Videos.length).toBe(0);
    expect(depth3Videos.length).toBe(0);
    
    // Should see videos from all depths flattened at depth 1
    expect(videosDepth1.some(v => v.filename === 'sample-local.mp4')).toBe(true);
    expect(videosDepth1.some(v => v.filename === 'tai-otoshi.mp4')).toBe(true);
    expect(videosDepth1.some(v => v.filename === 'uki-goshi.webm')).toBe(true);
    expect(videosDepth1.some(v => v.filename === 'subfile1.mp4')).toBe(true);
  });
  
  test('should respect maxDepth parameter - depth 2 (hierarchical view)', async () => {
    // Test with maxDepth 2 - should show videos from depth 1 and 2, flatten depth 3+ at depth 2
    const videosDepth2 = await scanLocalFolder('test-videos', 2);
    
    expect(videosDepth2.length).toBeGreaterThan(0);
    
    const depth1Videos = videosDepth2.filter(v => v.depth === 1);
    const depth2Videos = videosDepth2.filter(v => v.depth === 2);
    const depth3Videos = videosDepth2.filter(v => v.depth === 3);
    
    // With maxDepth 2, we should see depth 1 and 2 videos, and depth 3+ flattened at depth 2
    expect(depth1Videos.length).toBeGreaterThan(0);
    expect(depth2Videos.length).toBeGreaterThan(0);
    expect(depth3Videos.length).toBe(0);
    
    // Check specific videos at different depths
    expect(depth1Videos.some(v => v.filename === 'sample-local.mp4')).toBe(true);
    expect(depth2Videos.some(v => v.filename === 'subfile1.mp4')).toBe(true);
    // Videos from depth 3 should be flattened and appear at depth 2
    expect(videosDepth2.some(v => v.filename === 'tai-otoshi.mp4')).toBe(true);
    expect(videosDepth2.some(v => v.filename === 'uki-goshi.webm')).toBe(true);
  });
  
  test('should respect maxDepth parameter - depth 3 (deep hierarchical view)', async () => {
    // Test with maxDepth 3 - should show videos from depth 1, 2, and 3
    const videosDepth3 = await scanLocalFolder('test-videos', 3);
    
    expect(videosDepth3.length).toBeGreaterThan(0);
    
    const depth1Videos = videosDepth3.filter(v => v.depth === 1);
    const depth2Videos = videosDepth3.filter(v => v.depth === 2);
    const depth3Videos = videosDepth3.filter(v => v.depth === 3);
    
    // With maxDepth 3, we should see videos from all three depths
    expect(depth1Videos.length).toBeGreaterThan(0);
    expect(depth2Videos.length).toBeGreaterThan(0);
    expect(depth3Videos.length).toBeGreaterThan(0);
    
    // Check specific videos at different depths
    expect(depth1Videos.some(v => v.filename === 'sample-local.mp4')).toBe(true);
    expect(depth2Videos.some(v => v.filename === 'subfile1.mp4')).toBe(true);
    expect(depth3Videos.some(v => v.filename === 'tai-otoshi.mp4')).toBe(true);
    expect(depth3Videos.some(v => v.filename === 'uki-goshi.webm')).toBe(true);
  });
  
  test('should flatten content at maxDepth boundary', async () => {
    // Test that content beyond maxDepth is flattened at the maxDepth level
    const videosDepth1 = await scanLocalFolder('test-videos', 1);
    const videosDepth2 = await scanLocalFolder('test-videos', 2);
    const videosDepth3 = await scanLocalFolder('test-videos', 3);
    
    // All maxDepth settings should find the same total videos (flattening behavior)
    expect(videosDepth1.length).toBe(videosDepth2.length);
    expect(videosDepth2.length).toBe(videosDepth3.length);
    
    // But they should be organized differently by depth
    const depth1Count1 = videosDepth1.filter(v => v.depth === 1).length;
    const depth1Count2 = videosDepth2.filter(v => v.depth === 1).length;
    const depth1Count3 = videosDepth3.filter(v => v.depth === 1).length;
    
    // With maxDepth 1, all videos should be at depth 1 (flattened)
    expect(depth1Count1).toBe(videosDepth1.length);
    
    // With maxDepth 2, some videos should be at depth 2
    expect(depth1Count2).toBeLessThan(videosDepth2.length);
    
    // With maxDepth 3, some videos should be at depth 3
    expect(depth1Count3).toBeLessThan(videosDepth3.length);
  });
  
  test('should generate unique IDs for videos', async () => {
    const videos = await scanLocalFolder('test-videos', 2);
    
    const ids = videos.map(v => v.id);
    const uniqueIds = new Set(ids);
    
    expect(ids.length).toBe(uniqueIds.size);
    expect(ids.every(id => id.startsWith('local-'))).toBe(true);
  });
  
  test('should handle non-existent folders gracefully', async () => {
    const videos = await scanLocalFolder('non-existent-folder', 2);
    
    expect(videos).toEqual([]);
  });
  
  test('should track depth and relative path correctly', async () => {
    const videos = await scanLocalFolder('test-videos', 3);
    
    // Check that depth tracking works
    videos.forEach(video => {
      expect(video.depth).toBeGreaterThan(0);
      expect(video.depth).toBeLessThanOrEqual(3);
      expect(video.relativePath).toBeDefined();
    });
    
    // Check specific depth examples
    const sampleVideo = videos.find(v => v.filename === 'sample-local.mp4');
    expect(sampleVideo?.depth).toBe(1);
    
    const subfileVideo = videos.find(v => v.filename === 'subfile1.mp4');
    expect(subfileVideo?.depth).toBe(2);
    
    const taiOtoshiVideo = videos.find(v => v.filename === 'tai-otoshi.mp4');
    expect(taiOtoshiVideo?.depth).toBe(3);
    
    const ukiGoshiVideo = videos.find(v => v.filename === 'uki-goshi.webm');
    expect(ukiGoshiVideo?.depth).toBe(3);
  });
});
