import { TimeLimits, UsageLog, WatchedVideo, TimeTrackingState, DayOfWeek, TimeExtra } from './types';
import { readTimeLimits, readUsageLog, writeUsageLog, readWatchedVideos, writeWatchedVideos, readTimeExtra, writeTimeExtra } from './fileUtils';
import { logVerbose } from './logging';
import { updateWatchedVideoWithDuration } from './videoDurationUtils';

/**
 * Gets the current date in ISO format (YYYY-MM-DD)
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Gets the day of the week from a date string
 */
export function getDayOfWeek(dateString: string): DayOfWeek {
  const date = new Date(dateString);
  const days: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Gets the time limit for today (including any extra time added by parents)
 */
export async function getTimeLimitForToday(): Promise<number> {
  const timeLimits = await readTimeLimits();
  const timeExtra = await readTimeExtra();
  const today = getCurrentDate();
  const dayOfWeek = getDayOfWeek(today);
  
  // Base limit from timeLimits.json
  const baseLimitMinutes = timeLimits[dayOfWeek] || 0;
  
  // Extra time added today (if any)
  const extraTimeMinutes = timeExtra[today] || 0;
  
  // Total limit is base + extra
  const totalLimitMinutes = baseLimitMinutes + extraTimeMinutes;
  
  // logVerbose('[TimeTracking] getTimeLimitForToday:', { 
  //   today, 
  //   dayOfWeek, 
  //   baseLimitMinutes, 
  //   extraTimeMinutes, 
  //   totalLimitMinutes 
  // });
  
  return totalLimitMinutes;
}

/**
 * Gets the time used today in seconds
 */
export async function getTimeUsedToday(): Promise<number> {
  const usageLog = await readUsageLog();
  const today = getCurrentDate();
  return usageLog[today] || 0;
}

/**
 * Adds time to today's usage in seconds
 */
export async function addTimeUsedToday(seconds: number): Promise<void> {
  const usageLog = await readUsageLog();
  const today = getCurrentDate();
  
  // Round to whole seconds to avoid decimal precision issues
  const roundedSeconds = Math.round(seconds);
  usageLog[today] = (usageLog[today] || 0) + roundedSeconds;
  
  await writeUsageLog(usageLog);
}

/**
 * Gets the current time tracking state
 */
export async function getTimeTrackingState(): Promise<TimeTrackingState> {
  const currentDate = getCurrentDate();
  const timeUsedTodaySeconds = await getTimeUsedToday();
  const timeLimitTodayMinutes = await getTimeLimitForToday();
  const timeExtra = await readTimeExtra();
  
  // Convert time limit from minutes to seconds for comparison
  const timeLimitTodaySeconds = timeLimitTodayMinutes * 60;
  const timeRemainingSeconds = Math.max(0, timeLimitTodaySeconds - timeUsedTodaySeconds);
  const isLimitReached = timeRemainingSeconds <= 0;
  
  // Get extra time added today for display
  const extraTimeToday = timeExtra[currentDate] || 0;
  
  return {
    currentDate,
    timeUsedToday: timeUsedTodaySeconds,
    timeLimitToday: timeLimitTodaySeconds,
    timeRemaining: timeRemainingSeconds,
    isLimitReached,
    extraTimeToday
  };
}

/**
 * Formats time remaining in a human-readable format
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) {
    return 'No time remaining';
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s remaining`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s remaining`;
  }
  
  return `${remainingSeconds}s remaining`;
}

/**
 * Formats time used in a human-readable format
 */
export function formatTimeUsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s used`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s used`;
  }
  
  return `${remainingSeconds}s used`;
}

/**
 * Records video watching time
 * @param videoId - The video identifier
 * @param position - Current position in seconds
 * @param timeWatched - Time watched in seconds (since last call)
 * @param duration - Video duration in seconds (optional)
 */
export async function recordVideoWatching(
  videoId: string, 
  position: number, 
  timeWatched: number,
  duration?: number
): Promise<void> {
  // Round timeWatched to whole seconds for consistency
  const roundedTimeWatched = Math.round(timeWatched);
  // logVerbose('[TimeTracking] recordVideoWatching:', { videoId, position, timeWatched: roundedTimeWatched });
  
  // Add to daily usage in seconds (for precision)
  await addTimeUsedToday(roundedTimeWatched);
  
  // Update watched video history
  const watchedVideos = await readWatchedVideos();
  const now = new Date().toISOString();
  
  const existingIndex = watchedVideos.findIndex(v => v.videoId === videoId);
  
  const baseData = {
    videoId,
    position,
    lastWatched: now,
    timeWatched: existingIndex >= 0 
      ? watchedVideos[existingIndex].timeWatched + roundedTimeWatched
      : roundedTimeWatched
  };
  
  // Update with duration and watched status if duration is provided
  const updatedData = duration 
    ? updateWatchedVideoWithDuration(baseData, duration)
    : baseData;
  
  if (existingIndex >= 0) {
    // Update existing entry
    watchedVideos[existingIndex] = updatedData;
  } else {
    // Add new entry
    watchedVideos.push(updatedData);
  }
  
  await writeWatchedVideos(watchedVideos);
}

/**
 * Gets the last watched video for resume functionality
 */
export async function getLastWatchedVideo(): Promise<WatchedVideo | null> {
  const watchedVideos = await readWatchedVideos();
  
  if (watchedVideos.length === 0) {
    return null;
  }
  
  // Sort by last watched time and return the most recent
  const sorted = watchedVideos.sort((a, b) => 
    new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime()
  );
  
  return sorted[0];
}

/**
 * Gets the last watched video with source information for smart navigation
 */
export async function getLastWatchedVideoWithSource(): Promise<{
  video: WatchedVideo;
  sourceId: string;
  sourceTitle: string;
} | null> {
  const lastVideo = await getLastWatchedVideo();
  if (!lastVideo) return null;

  try {
    // Import here to avoid circular dependencies
    const { readVideoSources } = await import('./fileUtils');
    const videoSources = await readVideoSources();
    
    console.log('[TimeTracking] getLastWatchedVideoWithSource: Last video:', lastVideo);
    console.log('[TimeTracking] getLastWatchedVideoWithSource: Available sources:', videoSources);
    
    // Try to find which source contains this video
    // Check if it's a YouTube video (YouTube IDs are typically 11 characters)
    if (lastVideo.videoId.length === 11 && !lastVideo.videoId.includes('/')) {
      console.log('[TimeTracking] getLastWatchedVideoWithSource: Detected YouTube video ID');
      // Look for YouTube sources
      const youtubeSource = videoSources.find(source => 
        source.type === 'youtube_channel' || source.type === 'youtube_playlist'
      );
      
      if (youtubeSource) {
        console.log('[TimeTracking] getLastWatchedVideoWithSource: Found YouTube source:', youtubeSource);
        return {
          video: lastVideo,
          sourceId: youtubeSource.id,
          sourceTitle: youtubeSource.title
        };
      }
    }
    
    // Check if it's a local file path (contains file:// or /)
    if (lastVideo.videoId.includes('file://') || lastVideo.videoId.includes('/')) {
      console.log('[TimeTracking] getLastWatchedVideoWithSource: Detected local file path');
      // Look for local folder sources
      const localSource = videoSources.find(source => source.type === 'local');
      
      if (localSource) {
        console.log('[TimeTracking] getLastWatchedVideoWithSource: Found local source:', localSource);
        return {
          video: lastVideo,
          sourceId: localSource.id,
          sourceTitle: localSource.title
        };
      }
    }
    
    // If we can't determine the source type, try to return the first available source
    // This is a fallback to ensure the user can at least get back to a video source
    if (videoSources.length > 0) {
      console.log('[TimeTracking] getLastWatchedVideoWithSource: Using fallback source:', videoSources[0]);
      return {
        video: lastVideo,
        sourceId: videoSources[0].id,
        sourceTitle: videoSources[0].title
      };
    }
    
    console.log('[TimeTracking] getLastWatchedVideoWithSource: No sources found');
    return null;
  } catch (error) {
    console.error('Error getting video source information:', error);
    return null;
  }
}

/**
 * Resets daily usage (useful for testing or manual reset)
 */
export async function resetDailyUsage(): Promise<void> {
  const usageLog = await readUsageLog();
  const today = getCurrentDate();
  
  delete usageLog[today];
  
  await writeUsageLog(usageLog);
}

/**
 * Gets usage history for the last N days
 */
export async function getUsageHistory(days: number = 7): Promise<Array<{ date: string; minutes: number }>> {
  const usageLog = await readUsageLog();
  const today = new Date();
  
  const history: Array<{ date: string; minutes: number }> = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    const seconds = usageLog[dateString] || 0;
    const minutes = Math.floor(seconds / 60);
    history.push({ date: dateString, minutes });
  }
  
  return history;
}

/**
 * Validates time limits configuration
 */
export function validateTimeLimits(timeLimits: TimeLimits): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  for (const day of days) {
    const limit = timeLimits[day];
    if (limit === undefined) {
      errors.push(`Missing time limit for ${day}`);
    } else if (limit < 0) {
      errors.push(`Invalid time limit for ${day}: ${limit} (must be >= 0)`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
} 

/**
 * Adds extra time for today (admin function)
 * Supports negative numbers to remove extra time or reduce daily limits
 */
export async function addExtraTimeToday(minutes: number): Promise<void> {
  const timeExtra = await readTimeExtra();
  const today = getCurrentDate();
  
  // Add to existing extra time for today (negative numbers will subtract)
  timeExtra[today] = (timeExtra[today] || 0) + minutes;
  
  // Ensure we don't go below -1440 minutes (24 hours) to prevent extreme negative values
  timeExtra[today] = Math.max(-1440, timeExtra[today]);
  
  await writeTimeExtra(timeExtra);
  
  logVerbose('[TimeTracking] addExtraTimeToday:', { 
    today, 
    minutes, 
    totalExtra: timeExtra[today],
    operation: minutes >= 0 ? 'added' : 'removed'
  });
}

/**
 * Gets extra time added today
 */
export async function getExtraTimeToday(): Promise<number> {
  const timeExtra = await readTimeExtra();
  const today = getCurrentDate();
  return timeExtra[today] || 0;
} 