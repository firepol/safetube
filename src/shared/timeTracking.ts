import { TimeLimits, UsageLog, WatchedVideo, TimeTrackingState } from './types';
import { readTimeLimits, readUsageLog, writeUsageLog, readWatchedVideos, writeWatchedVideos } from './fileUtils';

/**
 * Gets the current date in ISO format (YYYY-MM-DD)
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Gets the day of the week from a date string
 */
export function getDayOfWeek(dateString: string): keyof TimeLimits {
  const date = new Date(dateString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()] as keyof TimeLimits;
}

/**
 * Gets the time limit for today
 */
export async function getTimeLimitForToday(): Promise<number> {
  const timeLimits = await readTimeLimits();
  const today = getCurrentDate();
  const dayOfWeek = getDayOfWeek(today);
  return timeLimits[dayOfWeek] || 0;
}

/**
 * Gets the time used today
 */
export async function getTimeUsedToday(): Promise<number> {
  const usageLog = await readUsageLog();
  const today = getCurrentDate();
  return usageLog[today] || 0;
}

/**
 * Adds time to today's usage
 */
export async function addTimeUsedToday(minutes: number): Promise<void> {
  const usageLog = await readUsageLog();
  const today = getCurrentDate();
  
  usageLog[today] = (usageLog[today] || 0) + minutes;
  
  await writeUsageLog(usageLog);
}

/**
 * Gets the current time tracking state
 */
export async function getTimeTrackingState(): Promise<TimeTrackingState> {
  const currentDate = getCurrentDate();
  const timeUsedToday = await getTimeUsedToday();
  const timeLimitToday = await getTimeLimitForToday();
  const timeRemaining = Math.max(0, timeLimitToday - timeUsedToday);
  const isLimitReached = timeRemaining <= 0;
  
  return {
    currentDate,
    timeUsedToday,
    timeLimitToday,
    timeRemaining,
    isLimitReached
  };
}

/**
 * Formats time remaining in a human-readable format
 */
export function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) {
    return 'No time remaining';
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m remaining`;
  }
  
  return `${remainingMinutes}m remaining`;
}

/**
 * Formats time used in a human-readable format
 */
export function formatTimeUsed(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m used`;
  }
  
  return `${remainingMinutes}m used`;
}

/**
 * Records video watching time
 * @param videoId - The video identifier
 * @param position - Current position in seconds
 * @param timeWatched - Time watched in seconds (since last call)
 */
export async function recordVideoWatching(
  videoId: string, 
  position: number, 
  timeWatched: number
): Promise<void> {
  // Convert seconds to minutes for daily tracking
  const minutesWatched = timeWatched / 60;
  
  // Add to daily usage
  await addTimeUsedToday(minutesWatched);
  
  // Update watched video history
  const watchedVideos = await readWatchedVideos();
  const now = new Date().toISOString();
  
  const existingIndex = watchedVideos.findIndex(v => v.videoId === videoId);
  
  if (existingIndex >= 0) {
    // Update existing entry
    watchedVideos[existingIndex] = {
      ...watchedVideos[existingIndex],
      position,
      lastWatched: now,
      timeWatched: watchedVideos[existingIndex].timeWatched + timeWatched
    };
  } else {
    // Add new entry
    watchedVideos.push({
      videoId,
      position,
      lastWatched: now,
      timeWatched
    });
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
    
    history.push({
      date: dateString,
      minutes: usageLog[dateString] || 0
    });
  }
  
  return history.reverse();
}

/**
 * Validates time limits configuration
 */
export function validateTimeLimits(timeLimits: TimeLimits): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const days: (keyof TimeLimits)[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  for (const day of days) {
    const limit = timeLimits[day];
    
    if (typeof limit !== 'number') {
      errors.push(`${day}: must be a number`);
    } else if (limit < 0) {
      errors.push(`${day}: cannot be negative`);
    } else if (limit > 1440) {
      errors.push(`${day}: cannot exceed 24 hours (1440 minutes)`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
} 