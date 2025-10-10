import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format a date string to a short, readable format (e.g., "Jan 15, 2024")
 */
export function formatPublishedDate(dateString: string | undefined): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    // Use short month format for compact display
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return '';
  }
}

/**
 * Extract the immediate parent folder name from a local video path
 * Example: "local:/home/videos/cartoons/episode.mp4" -> "cartoons"
 */
export function extractSubfolderName(videoId: string): string {
  if (!videoId.startsWith('local:')) return '';

  const path = videoId.substring(6); // Remove 'local:' prefix
  const parts = path.split('/').filter(p => p.length > 0);

  // If there are at least 2 parts (folder + file), return the second-to-last part
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }

  return '';
} 