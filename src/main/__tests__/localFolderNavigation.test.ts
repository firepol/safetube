import fs from 'fs';
import path from 'path';

// Mock the getLocalFolderContents function for testing
async function getLocalFolderContents(folderPath: string, maxDepth: number, currentDepth: number = 1): Promise<{folders: any[], videos: any[], depth: number}> {
  const folders: any[] = [];
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
  
  try {
    // Resolve relative paths from project root
    const absolutePath = path.isAbsolute(folderPath) ? folderPath : path.join(process.cwd(), folderPath);
    
    if (!fs.existsSync(absolutePath)) {
      return { folders, videos, depth: currentDepth };
    }

    const items = fs.readdirSync(absolutePath);
    
    for (const item of items) {
      const itemPath = path.join(absolutePath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Only show folders if we haven't reached maxDepth
        if (currentDepth < maxDepth) {
          folders.push({
            name: item,
            path: itemPath,
            type: 'folder',
            depth: currentDepth + 1
          });
        } else {
          // At maxDepth, flatten deeper content
          const flattenedContent = await getFlattenedContent(itemPath, currentDepth + 1);
          videos.push(...flattenedContent);
        }
      } else if (stats.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          const relativePath = path.relative(path.join(process.cwd(), 'test-videos'), itemPath);
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
            depth: currentDepth,
            relativePath: relativePath
          };
          videos.push(video);
        }
      }
    }
    
  } catch (error) {
    // Ignore errors in test
  }
  
  return { folders, videos, depth: currentDepth };
}

// Helper function to get flattened content from deeper levels
async function getFlattenedContent(folderPath: string, depth: number): Promise<any[]> {
  const videos: any[] = [];
  const supportedExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
  
  try {
    const items = fs.readdirSync(folderPath);
    
    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Continue scanning deeper recursively
        const deeperVideos = await getFlattenedContent(itemPath, depth + 1);
        videos.push(...deeperVideos);
      } else if (stats.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          const relativePath = path.relative(path.join(process.cwd(), 'test-videos'), itemPath);
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
            depth: depth - 1, // Mark as being at the previous depth (flattened)
            relativePath: relativePath,
            flattened: true
          };
          videos.push(video);
        }
      }
    }
  } catch (error) {
    // Ignore errors in test
  }
  
  return videos;
}

describe('Local Folder Navigation', () => {
  const testVideosPath = path.join(process.cwd(), 'test-videos');
  
  beforeAll(() => {
    // Ensure test-videos directory exists
    expect(fs.existsSync(testVideosPath)).toBe(true);
  });
  
  test('should get root folder contents with folders and files', async () => {
    const contents = await getLocalFolderContents(testVideosPath, 3, 1);
    
    expect(contents.depth).toBe(1);
    expect(contents.folders.length).toBeGreaterThan(0);
    expect(contents.videos.length).toBeGreaterThan(0);
    
    // Should have folders
    expect(contents.folders.some(f => f.name === 'judo')).toBe(true);
    expect(contents.folders.some(f => f.name === 'subfolder1')).toBe(true);
    
    // Should have root level videos
    expect(contents.videos.some(v => v.filename === 'sample-local.mp4')).toBe(true);
    
    // Should NOT have videos from deeper folders (they should be in folders)
    expect(contents.videos.some(v => v.filename === 'tai-otoshi.mp4')).toBe(false);
    expect(contents.videos.some(v => v.filename === 'uki-goshi.webm')).toBe(false);
  });
  
  test('should navigate into subfolder and show its contents', async () => {
    const judoPath = path.join(testVideosPath, 'judo');
    const contents = await getLocalFolderContents(judoPath, 3, 2);
    
    expect(contents.depth).toBe(2);
    expect(contents.folders.length).toBeGreaterThan(0);
    expect(contents.videos.length).toBe(0); // judo folder has no videos directly
    
    // Should have subfolders
    expect(contents.folders.some(f => f.name === 'otoshi')).toBe(true);
    expect(contents.folders.some(f => f.name === 'goshi')).toBe(true);
    
    // Should NOT have videos from deeper levels yet
    expect(contents.videos.some(v => v.filename === 'tai-otoshi.mp4')).toBe(false);
    expect(contents.videos.some(v => v.filename === 'uki-goshi.webm')).toBe(false);
  });
  
  test('should navigate into deep subfolder and show its contents', async () => {
    const otoshiPath = path.join(testVideosPath, 'judo', 'otoshi');
    const contents = await getLocalFolderContents(otoshiPath, 3, 3);
    
    expect(contents.depth).toBe(3);
    expect(contents.folders.length).toBe(0); // At maxDepth, no more folders
    expect(contents.videos.length).toBeGreaterThan(0);
    
    // Should have videos from this level
    expect(contents.videos.some(v => v.filename === 'tai-otoshi.mp4')).toBe(true);
    expect(contents.videos.some(v => v.filename === 'tai-otoshi-web.webm')).toBe(true);
  });
  
  test('should flatten content when reaching maxDepth boundary', async () => {
    const judoPath = path.join(testVideosPath, 'judo');
    const contents = await getLocalFolderContents(judoPath, 2, 2); // maxDepth 2, currentDepth 2
    
    expect(contents.depth).toBe(2);
    expect(contents.folders.length).toBe(0); // No more folders at maxDepth
    expect(contents.videos.length).toBeGreaterThan(0);
    
    // Should have videos from deeper levels flattened
    expect(contents.videos.some(v => v.filename === 'tai-otoshi.mp4')).toBe(true);
    expect(contents.videos.some(v => v.filename === 'uki-goshi.webm')).toBe(true);
    
    // These videos should be marked as flattened
    const flattenedVideos = contents.videos.filter(v => v.flattened);
    expect(flattenedVideos.length).toBeGreaterThan(0);
  });
  
  test('should respect maxDepth parameter correctly', async () => {
    // Test with maxDepth 1 - should only show root level
    const contentsDepth1 = await getLocalFolderContents(testVideosPath, 1, 1);
    expect(contentsDepth1.folders.length).toBe(0); // No folders at maxDepth 1
    expect(contentsDepth1.videos.some(v => v.filename === 'sample-local.mp4')).toBe(true);
    
    // Test with maxDepth 2 - should show folders and flatten deeper content
    const contentsDepth2 = await getLocalFolderContents(testVideosPath, 2, 1);
    expect(contentsDepth2.folders.length).toBeGreaterThan(0); // Should have folders
    expect(contentsDepth2.videos.some(v => v.filename === 'sample-local.mp4')).toBe(true);
    
    // Test with maxDepth 3 - should show folders and not flatten until depth 3
    const contentsDepth3 = await getLocalFolderContents(testVideosPath, 3, 1);
    expect(contentsDepth3.folders.length).toBeGreaterThan(0); // Should have folders
    expect(contentsDepth3.videos.some(v => v.filename === 'sample-local.mp4')).toBe(true);
  });
  
  test('should handle non-existent folders gracefully', async () => {
    const contents = await getLocalFolderContents('non-existent-folder', 3, 1);
    
    expect(contents.folders).toEqual([]);
    expect(contents.videos).toEqual([]);
    expect(contents.depth).toBe(1);
  });
});
