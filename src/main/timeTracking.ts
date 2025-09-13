import { 
  readTimeLimits, 
  readUsageLog, 
  writeUsageLog, 
  readWatchedVideos, 
  writeWatchedVideos, 
  readTimeExtra, 
  writeTimeExtra,
  readVideoSources
} from './fileUtils';
import { TimeLimits, UsageLog, WatchedVideo, TimeExtra } from '../shared/types';
import { logVerbose } from '../shared/logging';

/**
 * Record video watching time
 */
export async function recordVideoWatching(
  videoId: string, 
  position: number, 
  timeWatched: number, 
  duration?: number
): Promise<void> {
  try {
    const watchedVideos = await readWatchedVideos();
    const existingIndex = watchedVideos.findIndex(v => v.videoId === videoId);
    
    const watchedEntry: WatchedVideo = {
      videoId,
      position,
      lastWatched: new Date().toISOString(),
      timeWatched,
      duration,
      watched: duration ? position >= duration * 0.9 : false // Consider watched if 90% complete
    };
    
    if (existingIndex >= 0) {
      watchedVideos[existingIndex] = watchedEntry;
    } else {
      watchedVideos.push(watchedEntry);
    }
    
    await writeWatchedVideos(watchedVideos);
    
    // Also record in usage log
    await recordUsageTime(timeWatched);
    
    logVerbose(`[TimeTracking] Recorded watching: ${videoId}, position: ${position}, time: ${timeWatched}s`);
  } catch (error) {
    logVerbose(`[TimeTracking] Error recording video watching: ${error}`);
    throw error;
  }
}

/**
 * Record usage time in the daily log
 */
async function recordUsageTime(timeWatchedSeconds: number): Promise<void> {
  try {
    const usageLog = await readUsageLog();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (!usageLog[today]) {
      usageLog[today] = 0;
    }
    
    usageLog[today] += timeWatchedSeconds;
    
    await writeUsageLog(usageLog);
    
    logVerbose(`[TimeTracking] Recorded ${timeWatchedSeconds}s usage for ${today}`);
  } catch (error) {
    logVerbose(`[TimeTracking] Error recording usage time: ${error}`);
    throw error;
  }
}

/**
 * Get time tracking state
 */
export async function getTimeTrackingState(): Promise<{
  currentDate: string;
  timeUsedToday: number;
  timeLimitToday: number;
  timeRemaining: number;
  isLimitReached: boolean;
  extraTimeToday?: number;
}> {
  try {
    const [timeLimits, usageLog, timeExtra] = await Promise.all([
      readTimeLimits(),
      readUsageLog(),
      readTimeExtra()
    ]);
    
    const currentDate = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    const timeLimitMinutes = (timeLimits[dayOfWeek as keyof TimeLimits] as number) || 0;
    const timeLimitSeconds = timeLimitMinutes * 60;
    const timeUsedToday = usageLog[currentDate] || 0;
    const timeRemaining = Math.max(0, timeLimitSeconds - timeUsedToday);
    const isLimitReached = timeUsedToday >= timeLimitSeconds;
    const extraTimeToday = timeExtra[currentDate];
    
    return {
      currentDate,
      timeUsedToday,
      timeLimitToday: timeLimitSeconds,
      timeRemaining,
      isLimitReached,
      extraTimeToday
    };
  } catch (error) {
    logVerbose(`[TimeTracking] Error getting time tracking state: ${error}`);
    throw error;
  }
}

/**
 * Add extra time for today
 */
export async function addExtraTime(minutes: number): Promise<void> {
  try {
    const timeExtra = await readTimeExtra();
    const today = new Date().toISOString().split('T')[0];
    
    if (!timeExtra[today]) {
      timeExtra[today] = 0;
    }
    
    timeExtra[today] += minutes;
    
    await writeTimeExtra(timeExtra);
    
    logVerbose(`[TimeTracking] Added ${minutes} minutes extra time for ${today}`);
  } catch (error) {
    logVerbose(`[TimeTracking] Error adding extra time: ${error}`);
    throw error;
  }
}

/**
 * Get watched videos with source information
 */
export async function getWatchedVideosWithSource(): Promise<Array<{
  video: WatchedVideo;
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
}>> {
  try {
    const [watchedVideos, videoSources] = await Promise.all([
      readWatchedVideos(),
      readVideoSources()
    ]);
    
    const watchedWithSource = watchedVideos.map(video => {
      // Try to find the source for this video
      // For YouTube videos, we might need to match by video ID pattern
      // For local videos, we might need to match by file path
      
      let sourceId = 'unknown';
      let sourceTitle = 'Unknown Source';
      let sourceType = 'unknown';
      
      // This is a simplified implementation - in practice, you might need more sophisticated matching
      if (video.videoId.startsWith('yt_')) {
        // YouTube video - try to find matching source
        const youtubeSource = videoSources.find(source => 
          source.type === 'youtube_channel' || source.type === 'youtube_playlist'
        );
        if (youtubeSource) {
          sourceId = youtubeSource.id;
          sourceTitle = youtubeSource.title;
          sourceType = youtubeSource.type;
        }
      } else {
        // Local video - try to find matching source
        const localSource = videoSources.find(source => source.type === 'local');
        if (localSource) {
          sourceId = localSource.id;
          sourceTitle = localSource.title;
          sourceType = localSource.type;
        }
      }
      
      return {
        video,
        sourceId,
        sourceTitle,
        sourceType
      };
    });
    
    // Sort by last watched date (most recent first)
    const sorted = watchedWithSource.sort((a, b) =>
      new Date(b.video.lastWatched).getTime() - new Date(a.video.lastWatched).getTime()
    );
    
    return sorted;
  } catch (error) {
    logVerbose(`[TimeTracking] Error getting watched videos with source: ${error}`);
    throw error;
  }
}
