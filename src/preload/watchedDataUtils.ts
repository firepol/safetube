import { ipcRenderer } from 'electron';

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
    const watchedVideos = await ipcRenderer.invoke('get-watched-videos');
    
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
  } catch (error) {
    console.warn('[WatchedDataUtils] Error merging watched data:', error);
    return videos;
  }
}