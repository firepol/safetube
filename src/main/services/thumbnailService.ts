import fs from 'fs';
import path from 'path';

import { logVerbose } from '../../shared/logging';
import log from '../logger';

// Background thumbnail generation queue
const thumbnailGenerationQueue = new Set<string>();
const thumbnailGenerationInProgress = new Set<string>();

// Helper function to get thumbnail URL for custom protocol
export function getThumbnailUrl(thumbnailPath: string): string {
  const filename = path.basename(thumbnailPath);
  // Encode filename to handle spaces, emojis, and special characters
  const encodedFilename = encodeURIComponent(filename);
  return `safetube-thumbnails://${encodedFilename}`;
}

// Notify renderer that thumbnail is ready
export function notifyThumbnailReady(videoId: string, thumbnailUrl: string): void {
  // Find all browser windows and send thumbnail update
  const { BrowserWindow } = require('electron');
  const windows = BrowserWindow.getAllWindows();

  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send('thumbnail-ready', { videoId, thumbnailUrl });
      logVerbose('[ThumbnailService] Sent thumbnail-ready event for:', videoId);
    }
  }
}

// Helper function to find thumbnail file for a video
export function findThumbnailForVideo(videoFilePath: string): string {
  const videoDir = path.dirname(videoFilePath);
  const baseName = path.basename(videoFilePath, path.extname(videoFilePath));
  const thumbnailExtensions = ['.webp', '.jpg', '.jpeg', '.png'];

  for (const ext of thumbnailExtensions) {
    const thumbnailPath = path.join(videoDir, baseName + ext);
    if (fs.existsSync(thumbnailPath)) {
      return `file://${thumbnailPath}`;
    }
  }

  return ''; // No thumbnail found
}

// Schedule thumbnail generation in background
export function scheduleBackgroundThumbnailGeneration(videoId: string, videoPath: string): void {
  const key = `${videoId}||${videoPath}`;

  // Don't queue if already queued or in progress
  if (thumbnailGenerationQueue.has(key) || thumbnailGenerationInProgress.has(key)) {
    return;
  }

  thumbnailGenerationQueue.add(key);
  // Logging reduction: Removed verbose scheduling logs

  // Process queue asynchronously
  setImmediate(() => processNextThumbnailInQueue());
}

// Process thumbnail generation queue
export async function processNextThumbnailInQueue(): Promise<void> {
  if (thumbnailGenerationQueue.size === 0 || thumbnailGenerationInProgress.size >= 2) {
    return; // Limit concurrent generation to 2
  }

  const next = thumbnailGenerationQueue.values().next().value;
  if (!next) return;

  thumbnailGenerationQueue.delete(next);
  thumbnailGenerationInProgress.add(next);

  const [videoId, videoPath] = next.split('||', 2);

  try {
    // Logging reduction: Removed verbose processing logs
    const { ThumbnailGenerator } = await import('../thumbnailGenerator');
    const generatedThumbnail = await ThumbnailGenerator.generateCachedThumbnail(videoId, videoPath);

    if (generatedThumbnail) {
      const thumbnailUrl = getThumbnailUrl(generatedThumbnail);
      logVerbose('[ThumbnailService] Background thumbnail generated:', videoId, '->', thumbnailUrl);

      // Notify renderer about thumbnail update
      notifyThumbnailReady(videoId, thumbnailUrl);
    }
  } catch (error) {
    log.error('[ThumbnailService] Background thumbnail generation failed for:', videoId, error);
  } finally {
    thumbnailGenerationInProgress.delete(next);
    // Process next item in queue
    setImmediate(() => processNextThumbnailInQueue());
  }
}

// Get current queue status for debugging
export function getThumbnailQueueStatus() {
  return {
    queueSize: thumbnailGenerationQueue.size,
    inProgress: thumbnailGenerationInProgress.size,
    queued: Array.from(thumbnailGenerationQueue),
    processing: Array.from(thumbnailGenerationInProgress)
  };
}