import { exec } from 'child_process';
import { promisify } from 'util';
import { logVerbose } from './logging';

const execAsync = promisify(exec);

/**
 * Extracts video duration from a local video file using ffprobe
 * @param filePath Path to the video file
 * @returns Duration in seconds, or 0 if extraction fails
 */
export async function extractVideoDuration(filePath: string): Promise<number> {
  try {
    // Use ffprobe to get video duration
    const command = `ffprobe -v quiet -show_entries format=duration -of csv="p=0" "${filePath}"`;
    const { stdout } = await execAsync(command);
    const duration = parseFloat(stdout.trim());
    
    if (isNaN(duration) || duration <= 0) {
      logVerbose('[VideoDurationUtils] Invalid duration extracted:', duration);
      return 0;
    }
    
    logVerbose('[VideoDurationUtils] Extracted duration:', duration, 'seconds for:', filePath);
    return Math.round(duration);
  } catch (error) {
    logVerbose('[VideoDurationUtils] Failed to extract duration for:', filePath, error);
    return 0;
  }
}

/**
 * Determines if a video should be considered "watched" based on position and duration
 * @param position Current position in seconds
 * @param duration Total video duration in seconds
 * @returns true if video is considered watched
 */
export function isVideoWatched(position: number, duration: number): boolean {
  if (duration <= 0) return false;
  
  // Calculate the threshold based on video length
  let thresholdSeconds: number;
  
  if (duration <= 300) { // 5 minutes or less
    thresholdSeconds = 15; // Last 15 seconds
  } else if (duration <= 1800) { // 30 minutes or less
    thresholdSeconds = 30; // Last 30 seconds
  } else { // Longer videos
    thresholdSeconds = 60; // Last 60 seconds
  }
  
  const watchedThreshold = duration - thresholdSeconds;
  return position >= watchedThreshold;
}

/**
 * Updates watched video data with duration and watched status
 * @param watchedVideo Existing watched video data
 * @param duration Video duration in seconds
 * @returns Updated watched video data
 */
export function updateWatchedVideoWithDuration(
  watchedVideo: { videoId: string; position: number; lastWatched: string; timeWatched: number },
  duration: number
) {
  return {
    ...watchedVideo,
    duration,
    watched: isVideoWatched(watchedVideo.position, duration)
  };
}

/**
 * Parses ISO 8601 duration string (YouTube format) to seconds
 * @param duration ISO 8601 duration string (e.g., "PT1M30S")
 * @returns Duration in seconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return (
    (parseInt(hours || '0') * 3600) +
    (parseInt(minutes || '0') * 60) +
    parseInt(seconds || '0')
  );
}
