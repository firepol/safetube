import { CachedYouTubeSources } from './cached-youtube-sources';
import { VideoSource, YouTubeSourceCache } from './types';
import { PaginationService } from './paginationService';
import fs from 'fs';
import path from 'path';

function logDebug(msg: string) {
  if (typeof window !== 'undefined' && (window as any).logVerbose) {
    (window as any).logVerbose(msg);
  }
  console.log(msg);
}

async function scanLocalFolder(folderPath: string, maxDepth: number, currentDepth = 1): Promise<any[]> {
  let videos: any[] = [];
  if (currentDepth > maxDepth) return videos;
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      if (currentDepth < maxDepth) {
        videos = videos.concat(await scanLocalFolder(fullPath, maxDepth, currentDepth + 1));
      }
    } else if (entry.isFile() && isVideoFile(entry.name)) {
      videos.push({
        id: fullPath,
        type: 'local',
        title: path.basename(entry.name, path.extname(entry.name)),
        thumbnail: '',
        duration: 0,
        url: fullPath
      });
    }
  }
  return videos;
}

function isVideoFile(filename: string): boolean {
  return /\.(mp4|mkv|webm|mov|avi)$/i.test(filename);
}

export async function loadAllVideosFromSources(configPath = 'config/videoSources.json') {
  const debug: string[] = [];
  let sources: VideoSource[] = [];
  logDebug(`[Loader] Starting loadAllVideosFromSources with configPath: ${configPath}`);
  try {
    debug.push(`[Loader] Loading video sources from: ${configPath}`);
    sources = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    debug.push(`[Loader] Loaded ${sources.length} sources.`);
    logDebug(`[Loader] Loaded ${sources.length} sources from config.`);
  } catch (err) {
    debug.push(`[Loader] ERROR loading videoSources.json: ${err}`);
    logDebug(`[Loader] ERROR loading videoSources.json: ${err}`);
    return { videosBySource: [], debug };
  }

  const videosBySource: any[] = [];
  const paginationService = PaginationService.getInstance();

  for (const source of sources) {
    if (!source || typeof source !== 'object' || !('type' in source) || !('id' in source)) {
      debug.push(`[Loader] WARNING: Skipping invalid source entry: ${JSON.stringify(source)}`);
      logDebug(`[Loader] WARNING: Skipping invalid source entry: ${JSON.stringify(source)}`);
      continue;
    }
    debug.push(`[Loader] Processing source: ${(source as any).id} (${(source as any).type})`);
    logDebug(`[Loader] Processing source: ${(source as any).id} (${(source as any).type})`);
    
    if ((source as any).type === 'youtube_channel' || (source as any).type === 'youtube_playlist') {
      const typedSource = source as VideoSource;
      try {
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
        logDebug(`[Loader] YouTube source ${(typedSource as any).id}: ${cache.videos.length} videos loaded. Title: ${sourceTitle || typedSource.title}, Thumbnail: ${sourceThumbnail ? '[set]' : '[blank]'}`);
        
        const videos = cache.videos.map(v => ({
          id: v.id,
          type: 'youtube' as const,
          title: v.title,
          thumbnail: v.thumbnail || '',
          duration: v.duration || 0,
          url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
          // For local videos with separate streams (not applicable for YouTube)
          video: undefined,
          audio: undefined,
          // For YouTube videos
          streamUrl: undefined,
          audioStreamUrl: undefined,
          resumeAt: undefined,
          server: undefined,
          port: undefined,
          path: undefined,
          preferredLanguages: v.preferredLanguages || ['en'],
          useJsonStreamUrls: false,
          // Additional properties for source management
          sourceId: typedSource.id,
          sourceTitle: sourceTitle || typedSource.title,
          sourceThumbnail: sourceThumbnail || '',
        }));

        const paginationState = paginationService.getPaginationState(typedSource.id, videos.length);
        
        videosBySource.push({
          id: typedSource.id,
          type: (typedSource as any).type,
          title: sourceTitle || typedSource.title,
          thumbnail: sourceThumbnail || '',
          videoCount: videos.length,
          videos: videos,
          paginationState: paginationState
        });
      } catch (err) {
        debug.push(`[Loader] ERROR loading YouTube source ${(typedSource as any).id}: ${err}`);
        logDebug(`[Loader] ERROR loading YouTube source ${(typedSource as any).id}: ${err}`);
      }
    } else if ((source as any).type === 'local') {
      const typedSource = source as VideoSource;
      try {
        const maxDepth = (typedSource as any).maxDepth || 2;
        const localVideos = await scanLocalFolder((typedSource as any).path, maxDepth);
        debug.push(`[Loader] Local source ${(typedSource as any).id}: ${localVideos.length} videos found.`);
        logDebug(`[Loader] Local source ${(typedSource as any).id}: ${localVideos.length} videos found.`);
        
        const videos = localVideos.map(v => ({
          id: v.id,
          type: 'local' as const,
          title: v.title,
          thumbnail: v.thumbnail || '',
          duration: v.duration || 0,
          url: v.url || v.id,
          // For local videos with separate streams
          video: v.video || undefined,
          audio: v.audio || undefined,
          // For YouTube videos (not applicable for local)
          streamUrl: undefined,
          audioStreamUrl: undefined,
          resumeAt: undefined,
          server: undefined,
          port: undefined,
          path: undefined,
          preferredLanguages: undefined,
          useJsonStreamUrls: undefined,
          // Additional properties for source management
          sourceId: (typedSource as any).id,
          sourceTitle: (typedSource as any).title,
          sourceThumbnail: '',
        }));

        const paginationState = paginationService.getPaginationState(typedSource.id, videos.length);
        
        videosBySource.push({
          id: (typedSource as any).id,
          type: (typedSource as any).type,
          title: (typedSource as any).title,
          thumbnail: '',
          videoCount: videos.length,
          videos: videos,
          paginationState: paginationState
        });
      } catch (err) {
        debug.push(`[Loader] ERROR scanning local source ${(typedSource as any).id}: ${err}`);
        logDebug(`[Loader] ERROR scanning local source ${(typedSource as any).id}: ${err}`);
      }
    } else {
      debug.push(`[Loader] WARNING: Unsupported source type: ${(source as any).type} (id: ${(source as any).id}) - skipping.`);
      logDebug(`[Loader] WARNING: Unsupported source type: ${(source as any).type} (id: ${(source as any).id}) - skipping.`);
    }
  }
  
  debug.push(`[Loader] Total sources processed: ${videosBySource.length}`);
  logDebug(`[Loader] Total sources processed: ${videosBySource.length}`);
  return { videosBySource, debug };
} 