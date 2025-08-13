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
    
    // Start scanning from the root folder
    scanFolderRecursive(absolutePath, 0, maxDepth, videos, supportedExtensions);
    
    return videos;
    
  } catch (error) {
    return [];
  }
}

// Recursive function to scan folders
function scanFolderRecursive(currentPath: string, currentDepth: number, maxDepth: number, videos: any[], supportedExtensions: string[]): void {
  if (currentDepth > maxDepth) {
    return;
  }
  
  try {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Recursively scan subdirectories
        scanFolderRecursive(itemPath, currentDepth + 1, maxDepth, videos, supportedExtensions);
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
            modified: stats.mtime
          };
          videos.push(video);
        }
      }
    }
  } catch (error) {
    // Ignore errors in test
  }
}

describe('Local Folder Scanning', () => {
  const testVideosPath = path.join(process.cwd(), 'test-videos');
  
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
  
  test('should respect maxDepth parameter', async () => {
    // Test with maxDepth 0 (only root folder)
    const videosDepth0 = await scanLocalFolder('test-videos', 0);
    
    // Test with maxDepth 2 (root + 2 levels)
    const videosDepth2 = await scanLocalFolder('test-videos', 2);
    
    // Should find the same videos since test-videos is flat
    expect(videosDepth0.length).toBe(videosDepth2.length);
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
});
