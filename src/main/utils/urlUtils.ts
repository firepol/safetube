import { YouTubeAPI } from '../youtube-api';
import { logVerbose } from '../../shared/logging';
import log from '../logger';

// Extract YouTube channel ID from URL
export function extractChannelId(url: string): string | null {
  try {
    if (url.includes('/@')) {
      const match = url.match(/\/@([^\/\?]+)/);
      return match ? `@${match[1]}` : null; // Return with @ prefix for usernames
    } else if (url.includes('/channel/')) {
      const match = url.match(/\/channel\/([^\/\?]+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Extract YouTube playlist ID from URL
export function extractPlaylistId(url: string): string | null {
  try {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Resolve YouTube username to channel ID
export async function resolveUsernameToChannelId(username: string, apiKey: string): Promise<string | null> {
  try {
    logVerbose('[URLUtils] Resolving username to channel ID:', username);
    const youtubeAPI = new YouTubeAPI(apiKey);
    const channelDetails = await youtubeAPI.searchChannelByUsername(username);
    logVerbose('[URLUtils] Resolved username to channel ID:', channelDetails.channelId);
    return channelDetails.channelId;
  } catch (error) {
    log.warn('[URLUtils] Could not resolve username to channel ID:', username, error);
    return null;
  }
}