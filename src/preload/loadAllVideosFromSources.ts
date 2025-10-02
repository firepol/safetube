import { CachedYouTubeSources } from './cached-youtube-sources';
import { VideoSource, YouTubeSourceCache } from './types';
import { PaginationService } from './paginationService';
import fs from 'fs';
import path from 'path';
import { logVerbose } from './utils';
import { createLocalVideoId } from '../shared/fileUtils';

// Import IPC constants
const IPC = {
  VIDEO_SOURCES: {
    GET_ALL: 'video-sources:get-all',
  },
} as const;

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
        // Generate URI-style ID for local video
        const videoId = createLocalVideoId(fullPath);
        logVerbose('[Preload] Found video at depth', currentDepth, ':', fullPath);
        
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
        // Generate URI-style ID for local video
        const videoId = createLocalVideoId(fullPath);
        logVerbose('[Preload] Found video at depth', currentDepth, 'flattened to maxDepth');
        
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
  logVerbose(`[Loader] Starting loadAllVideosFromSources (database mode)`);

  try {
    // Load sources from database via IPC
    debug.push(`[Loader] Loading video sources from database`);
    if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
      const dbSources = await (window as any).electron.invoke(IPC.VIDEO_SOURCES.GET_ALL);

      if (dbSources && Array.isArray(dbSources)) {
        // Convert database format to VideoSource format
        sources = dbSources.map(source => ({
          id: source.id,
          type: source.type,
          title: source.title,
          url: source.url,
          channelId: source.channel_id,
          path: source.path,
          maxDepth: source.max_depth,
          sortPreference: source.sort_preference
        }));
        debug.push(`[Loader] Loaded ${sources.length} sources from database.`);
        logVerbose(`[Loader] Loaded ${sources.length} sources from database.`);
      } else {
        throw new Error('No sources found in database');
      }
    } else {
      throw new Error('IPC not available - cannot load sources from database');
    }
  } catch (err) {
    debug.push(`[Loader] ERROR loading sources from database: ${err}`);
    logVerbose(`[Loader] ERROR loading sources from database: ${err}`);
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
        
        const cache: YouTubeSourceCache = await CachedYouTubeSources.loadSourceBasicInfo(typedSource);
        let sourceTitle = cache.title || typedSource.title;
        let sourceThumbnail = cache.thumbnail || '';
        debug.push(`[Loader] YouTube source ${(typedSource as any).id}: Basic info loaded. Title: ${sourceTitle || typedSource.title}, Thumbnail: ${sourceThumbnail ? '[set]' : '[blank]'}, Total: ${cache.totalVideos || 0}`);
        logVerbose(`[Loader] YouTube source ${(typedSource as any).id}: Basic info loaded. Title: ${sourceTitle || typedSource.title}, Thumbnail: ${sourceThumbnail ? '[set]' : '[blank]'}, Total: ${cache.totalVideos || 0}`);

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