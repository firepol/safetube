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
  
  usageLog[today] = (usageLog[today] || 0) + seconds;
  
  await writeUsageLog(usageLog);
}

/**
 * Gets the current time tracking state
 */
export async function getTimeTrackingState(): Promise<TimeTrackingState> {
  const currentDate = getCurrentDate();
  const timeUsedTodaySeconds = await getTimeUsedToday();
  const timeLimitTodayMinutes = await getTimeLimitForToday();
  
  // Convert time limit from minutes to seconds for comparison
  const timeLimitTodaySeconds = timeLimitTodayMinutes * 60;
  const timeRemainingSeconds = Math.max(0, timeLimitTodaySeconds - timeUsedTodaySeconds);
  const isLimitReached = timeRemainingSeconds <= 0;
  
  return {
    currentDate,
    timeUsedToday: timeUsedTodaySeconds,
    timeLimitToday: timeLimitTodaySeconds,
    timeRemaining: timeRemainingSeconds,
    isLimitReached
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
 */
export async function recordVideoWatching(
  videoId: string, 
  position: number, 
  timeWatched: number
): Promise<void> {
  console.log('[TimeTracking] recordVideoWatching:', { videoId, position, timeWatched });
  // Add to daily usage in seconds (for precision)
  await addTimeUsedToday(timeWatched);
  
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
  
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  for (const day of days) {
    const limit = timeLimits[day as keyof TimeLimits];
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