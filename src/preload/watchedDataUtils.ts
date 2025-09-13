// Note: This file runs in the preload context where ipcRenderer is available

export interface WatchedVideo {
  videoId: string;
  position: number; // seconds
  lastWatched: string; // ISO date string
  timeWatched: number; // seconds
}

/**
 * Merges watched video data with video objects to populate resumeAt property
 */
export async function mergeWatchedData<T extends { id: string; resumeAt?: number }>(videos: T[]): Promise<T[]> {
  try {
    // Use the window.electron API that's available in the preload context
    if (typeof window !== 'undefined' && (window as any).electron?.getWatchedVideos) {
      const watchedVideos = await (window as any).electron.getWatchedVideos();
      
      return videos.map(video => {
        const watchedEntry = watchedVideos.find((w: WatchedVideo) => w.videoId === video.id);
        if (watchedEntry) {
          return {
            ...video,
            resumeAt: watchedEntry.position
          };
        }
        return video;
      });
    } else {
      // Silently return videos without watched data if electron API is not available
      // This can happen during startup before the context bridge is fully initialized
      return videos;
    }
  } catch (error) {
    console.warn('[WatchedDataUtils] Error merging watched data:', error);
    return videos;
  }
}