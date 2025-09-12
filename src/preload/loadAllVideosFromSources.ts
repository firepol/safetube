import { CachedYouTubeSources } from './cached-youtube-sources';
import { VideoSource, YouTubeSourceCache } from './types';
import { PaginationService } from './paginationService';
import fs from 'fs';
import path from 'path';

// Local logging function that follows the same pattern as logVerbose
function logVerbose(...args: any[]) {
  if (process.env.ELECTRON_LOG_VERBOSE === 'true') {
    console.log('[Preload][Verbose]', ...args);
  }
}

// Helper to scan local folders recursively up to maxDepth
async function scanLocalFolder(folderPath: string, maxDepth: number, currentDepth = 1): Promise<any[]> {
  let videos: any[] = [];
  
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      
      if (entry.isDirectory()) {
        // If we're at maxDepth, flatten all content from this directory
        if (currentDepth === maxDepth) {
          logVerbose('[Preload] At maxDepth', currentDepth, 'flattening content from:', fullPath);
          // Recursively scan deeper content but mark it as being at maxDepth
          const deeperVideos = await scanFolderDeeper(fullPath, currentDepth + 1);
          videos = videos.concat(deeperVideos);
        } else {
          // Continue scanning normally
          const subVideos = await scanLocalFolder(fullPath, maxDepth, currentDepth + 1);
          videos = videos.concat(subVideos);
        }
      } else if (entry.isFile() && isVideoFile(entry.name)) {
        // Generate encoded ID for local video to avoid routing issues
        let videoId: string;
        try {
          videoId = Buffer.from(fullPath).toString('base64');
          logVerbose('[Preload] Found video at depth', currentDepth, ':', fullPath);
        } catch (error) {
          console.error('[Preload] Error encoding file path, using fallback ID:', error);
          videoId = `local_${Buffer.from(fullPath).toString('hex').substring(0, 16)}`;
        }
        
        videos.push({
          id: videoId,
          type: 'local',
          title: path.basename(entry.name, path.extname(entry.name)),
          thumbnail: '',
          duration: 0,
          url: fullPath, // Keep original path for internal use
          video: fullPath,
          audio: undefined,
          depth: currentDepth, // Track the depth where this video was found
          relativePath: path.relative(folderPath, fullPath) // Track relative path for debugging
        });
      }
    }
  } catch (error) {
    console.error('[Preload] Error scanning folder:', folderPath, error);
  }
  
  return videos;
}

// Function to scan deeper content when flattening at maxDepth
async function scanFolderDeeper(folderPath: string, currentDepth: number): Promise<any[]> {
  let videos: any[] = [];
  
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      
      if (entry.isDirectory()) {
        // Continue scanning deeper recursively
        const deeperVideos = await scanFolderDeeper(fullPath, currentDepth + 1);
        videos = videos.concat(deeperVideos);
      } else if (entry.isFile() && isVideoFile(entry.name)) {
        // Generate encoded ID for local video to avoid routing issues
        let videoId: string;
        try {
          videoId = Buffer.from(fullPath).toString('base64');
          logVerbose('[Preload] Found video at depth', currentDepth, 'flattened to maxDepth');
        } catch (error) {
          console.error('[Preload] Error encoding file path, using fallback ID:', error);
          videoId = `local_${Buffer.from(fullPath).toString('hex').substring(0, 16)}`;
        }
        
        videos.push({
          id: videoId,
          type: 'local',
          title: path.basename(entry.name, path.extname(entry.name)),
          thumbnail: '',
          duration: 0,
          url: fullPath, // Keep original path for internal use
          video: fullPath,
          audio: undefined,
          depth: currentDepth - 1, // Mark as being at the previous depth (flattened)
          relativePath: path.relative(folderPath, fullPath), // Track relative path for debugging
          flattened: true // Mark as flattened content
        });
      }
    }
  } catch (error) {
    console.error('[Preload] Error scanning deeper folder for flattening:', folderPath, error);
  }
  
  return videos;
}

function isVideoFile(filename: string): boolean {
  return /\.(mp4|mkv|webm|mov|avi)$/i.test(filename);
}

export async function loadAllVideosFromSources(configPath = 'config/videoSources.json', apiKey?: string | null) {
  const debug: string[] = [];
  let sources: VideoSource[] = [];
  logVerbose(`[Loader] Starting loadAllVideosFromSources with configPath: ${configPath}`);
  try {
    debug.push(`[Loader] Loading video sources from: ${configPath}`);
    sources = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    debug.push(`[Loader] Loaded ${sources.length} sources.`);
    logVerbose(`[Loader] Loaded ${sources.length} sources from config.`);
  } catch (err) {
    debug.push(`[Loader] ERROR loading videoSources.json: ${err}`);
    logVerbose(`[Loader] ERROR loading videoSources.json: ${err}`);
    return { videosBySource: [], debug };
  }

  const videosBySource: any[] = [];
  const paginationService = PaginationService.getInstance();

  for (const source of sources) {
    if (!source || typeof source !== 'object' || !('type' in source) || !('id' in source)) {
      debug.push(`[Loader] WARNING: Skipping invalid source entry: ${JSON.stringify(source)}`);
      logVerbose(`[Loader] WARNING: Skipping invalid source entry: ${JSON.stringify(source)}`);
      continue;
    }
    debug.push(`[Loader] Processing source: ${(source as any).id} (${(source as any).type})`);
    logVerbose(`[Loader] Processing source: ${(source as any).id} (${(source as any).type})`);
    
    if ((source as any).type === 'youtube_channel' || (source as any).type === 'youtube_playlist') {
      const typedSource = source as VideoSource;
      try {
        // Check if API key is available
        if (!apiKey) {
          debug.push(`[Loader] WARNING: YouTube API key not available, skipping YouTube source ${typedSource.id}`);
          videosBySource.push({
            id: typedSource.id,
            type: (typedSource as any).type,
            title: typedSource.title,
            thumbnail: '',
            videoCount: 0,
            videos: [],
            paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 } // Will be updated with actual config
          });
          continue;
        }
        
        // Import and set the API key in the YouTubeAPI class
        const { YouTubeAPI } = await import('./youtube');
        YouTubeAPI.setApiKey(apiKey);
        
        const cache: YouTubeSourceCache = await CachedYouTubeSources.loadSourceVideos(typedSource);
        let sourceTitle = typedSource.title;
        let sourceThumbnail = (typedSource as any).thumbnail;
        if (!sourceTitle || !sourceThumbnail) {
          if (cache && cache.videos.length > 0) {
            if (!sourceTitle) {
              if (typedSource.type === 'youtube_channel') {
                sourceTitle = cache.videos[0].channelTitle || '';
              } else if (typedSource.type === 'youtube_playlist') {
                sourceTitle = cache.videos[0].playlistTitle || '';
              }
            }
            if (!sourceThumbnail) {
              if (typedSource.type === 'youtube_channel') {
                sourceThumbnail = cache.videos[0].thumbnail || '';
              } else if (typedSource.type === 'youtube_playlist') {
                sourceThumbnail = cache.videos[0].thumbnail || '';
              }
            }
          }
        }
        debug.push(`[Loader] YouTube source ${(typedSource as any).id}: ${cache.videos.length} videos loaded. Title: ${sourceTitle || typedSource.title}, Thumbnail: ${sourceThumbnail ? '[set]' : '[blank]'}`);
        logVerbose(`[Loader] YouTube source ${(typedSource as any).id}: ${cache.videos.length} videos loaded. Title: ${sourceTitle || typedSource.title}, Thumbnail: ${sourceThumbnail ? '[set]' : '[blank]'}`);
        
        const videos = cache.videos.map(v => ({
          id: v.id,
          type: 'youtube' as const,
          title: v.title,
          thumbnail: v.thumbnail || '',
          duration: v.duration || 0,
          url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
          preferredLanguages: v.preferredLanguages || ['en'],
          sourceId: typedSource.id,
          sourceTitle: sourceTitle || typedSource.title,
          sourceThumbnail: sourceThumbnail || '',
        }));

        // Merge with watched data to populate resumeAt
        const { mergeWatchedData } = await import('./watchedDataUtils');
        const videosWithWatchedData = await mergeWatchedData(videos);

        const paginationState = paginationService.getPaginationState(typedSource.id, cache.totalVideos || videosWithWatchedData.length);
        
        videosBySource.push({
          id: typedSource.id,
          type: (typedSource as any).type,
          title: sourceTitle || typedSource.title,
          thumbnail: sourceThumbnail || '',
          videoCount: cache.totalVideos || videosWithWatchedData.length, // Use total count from cache
          videos: videosWithWatchedData,
          paginationState: paginationState,
          usingCachedData: cache.usingCachedData || false, // Pass through the cached data flag
          lastFetched: cache.lastFetched // Pass through when data was last fetched
        });
      } catch (err) {
        debug.push(`[Loader] ERROR loading YouTube source ${(typedSource as any).id}: ${err}`);
        logVerbose(`[Loader] ERROR loading YouTube source ${(typedSource as any).id}: ${err}`);
        // Add empty source to maintain structure
        videosBySource.push({
          id: typedSource.id,
          type: (typedSource as any).type,
          title: typedSource.title,
          thumbnail: '',
          videoCount: 0,
          videos: [],
          paginationState: { currentPage: 1, totalPages: 1, totalVideos: 0, pageSize: 50 } // Will be updated with actual config
        });
      }
    } else if ((source as any).type === 'local') {
      const typedSource = source as VideoSource;
      try {
        // For local sources, don't scan videos upfront - let the LocalFolderNavigator handle it dynamically
        // This allows proper folder structure navigation instead of flattening
        debug.push(`[Loader] Local source ${(typedSource as any).id}: Using folder navigation (not scanning videos upfront).`);
        logVerbose(`[Loader] Local source ${(typedSource as any).id}: Using folder navigation (not scanning videos upfront).`);
        
        const paginationState = paginationService.getPaginationState(typedSource.id, 0);
        
        videosBySource.push({
          id: (typedSource as any).id,
          type: (typedSource as any).type,
          title: (typedSource as any).title,
          thumbnail: '',
          videoCount: 0, // Will be calculated dynamically by LocalFolderNavigator
          videos: [], // Empty - LocalFolderNavigator will load videos dynamically
          paginationState: paginationState,
          maxDepth: (typedSource as any).maxDepth, // Pass through maxDepth for navigation
          path: (typedSource as any).path // Pass through path for navigation
        });
      } catch (err) {
        debug.push(`[Loader] ERROR scanning local source ${(typedSource as any).id}: ${err}`);
        logVerbose(`[Loader] ERROR scanning local source ${(typedSource as any).id}: ${err}`);
      }
    } else {
      debug.push(`[Loader] WARNING: Unsupported source type: ${(source as any).type} (id: ${(source as any).id}) - skipping.`);
      logVerbose(`[Loader] WARNING: Unsupported source type: ${(source as any).type} (id: ${(source as any).id}) - skipping.`);
    }
  }
  
  debug.push(`[Loader] Total sources processed: ${videosBySource.length}`);
  logVerbose(`[Loader] Total sources processed: ${videosBySource.length}`);
  return { videosBySource, debug };
} 