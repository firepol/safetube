import fs from 'fs';
import path from 'path';
import { YouTubePageCache } from '../../preload/youtubePageCache';

describe('Source Cache Reset', () => {
  const testCacheDir = path.join(process.cwd(), '.cache');
  const testSourceId = 'test-source-123';

  beforeAll(() => {
    if (!fs.existsSync(testCacheDir)) {
      fs.mkdirSync(testCacheDir, { recursive: true });
    }
  });

  afterAll(() => {
    const files = fs.readdirSync(testCacheDir).filter(f => f.startsWith(`youtube-pages-${testSourceId}-`));
    files.forEach(file => {
      fs.unlinkSync(path.join(testCacheDir, file));
    });
  });

  beforeEach(() => {
    const files = fs.readdirSync(testCacheDir).filter(f =>
      f.startsWith(`youtube-pages-${testSourceId}-`) ||
      f.startsWith('youtube-pages-other-source-') ||
      f === 'unrelated-file.json'
    );
    files.forEach(file => {
      fs.unlinkSync(path.join(testCacheDir, file));
    });
  });

  it('should clear cache files for a specific source', () => {
    fs.writeFileSync(
      path.join(testCacheDir, `youtube-pages-${testSourceId}-page-1.json`),
      JSON.stringify({ videos: [], pageNumber: 1, totalResults: 0, timestamp: Date.now(), sourceId: testSourceId, sourceType: 'youtube_channel' })
    );
    fs.writeFileSync(
      path.join(testCacheDir, `youtube-pages-${testSourceId}-page-2.json`),
      JSON.stringify({ videos: [], pageNumber: 2, totalResults: 0, timestamp: Date.now(), sourceId: testSourceId, sourceType: 'youtube_channel' })
    );
    fs.writeFileSync(
      path.join(testCacheDir, `youtube-pages-other-source-page-1.json`),
      JSON.stringify({ videos: [], pageNumber: 1, totalResults: 0, timestamp: Date.now(), sourceId: 'other-source', sourceType: 'youtube_channel' })
    );

    expect(fs.existsSync(path.join(testCacheDir, `youtube-pages-${testSourceId}-page-1.json`))).toBe(true);
    expect(fs.existsSync(path.join(testCacheDir, `youtube-pages-${testSourceId}-page-2.json`))).toBe(true);
    expect(fs.existsSync(path.join(testCacheDir, `youtube-pages-other-source-page-1.json`))).toBe(true);

    YouTubePageCache.clearSourcePages(testSourceId);

    expect(fs.existsSync(path.join(testCacheDir, `youtube-pages-${testSourceId}-page-1.json`))).toBe(false);
    expect(fs.existsSync(path.join(testCacheDir, `youtube-pages-${testSourceId}-page-2.json`))).toBe(false);
    expect(fs.existsSync(path.join(testCacheDir, `youtube-pages-other-source-page-1.json`))).toBe(true);
  });

  it('should handle clearing cache when no cache files exist', () => {
    expect(() => YouTubePageCache.clearSourcePages(testSourceId)).not.toThrow();
  });

  it('should only delete files matching the source ID pattern', () => {
    fs.writeFileSync(
      path.join(testCacheDir, `youtube-pages-${testSourceId}-page-1.json`),
      JSON.stringify({ videos: [], pageNumber: 1, totalResults: 0, timestamp: Date.now(), sourceId: testSourceId, sourceType: 'youtube_channel' })
    );
    fs.writeFileSync(
      path.join(testCacheDir, `unrelated-file.json`),
      JSON.stringify({ data: 'test' })
    );

    YouTubePageCache.clearSourcePages(testSourceId);

    expect(fs.existsSync(path.join(testCacheDir, `youtube-pages-${testSourceId}-page-1.json`))).toBe(false);
    expect(fs.existsSync(path.join(testCacheDir, `unrelated-file.json`))).toBe(true);
  });
});