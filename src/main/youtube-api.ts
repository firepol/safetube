import https from 'https';
import { URL } from 'url';
import { classifyVideoError, VideoErrorLogger } from '../shared/videoErrorHandling';

// YouTube Data API v3 client
export class YouTubeAPI {
  private apiKey: string;
  private baseUrl = 'https://www.googleapis.com/youtube/v3';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  // Fetch videos from a YouTube channel
  async getChannelVideos(channelId: string, maxResults: number = 50): Promise<any[]> {
    try {
      // First get the channel's uploads playlist
      const channelResponse = await this.makeRequest(
        `${this.baseUrl}/channels?part=contentDetails&id=${channelId}&key=${this.apiKey}`
      );
      
      if (!channelResponse.items || channelResponse.items.length === 0) {
        throw new Error(`Channel not found: ${channelId}`);
      }
      
      const uploadsPlaylistId = channelResponse.items[0].contentDetails.relatedPlaylists.uploads;
      
      // Then get videos from the uploads playlist
      return await this.getPlaylistVideos(uploadsPlaylistId, maxResults);
      
    } catch (error) {
      console.error('[YouTubeAPI] Error fetching channel videos:', error);
      throw error;
    }
  }
  
  // Fetch videos from a YouTube playlist
  async getPlaylistVideos(playlistId: string, maxResults: number = 50): Promise<any[]> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&key=${this.apiKey}`
      );
      
      if (!response.items) {
        return [];
      }
      
      // Extract video information
      const videos = response.items.map((item: any) => ({
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        publishedAt: item.snippet.publishedAt,
        channelTitle: item.snippet.channelTitle,
        type: 'youtube'
      }));
      
      return videos;
      
    } catch (error) {
      console.error('[YouTubeAPI] Error fetching playlist videos:', error);
      throw error;
    }
  }
  
  // Get channel details (title, description, thumbnail, videoCount)
  async getChannelDetails(channelId: string): Promise<any> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/channels?part=snippet,statistics&id=${channelId}&key=${this.apiKey}`
      );

      if (!response.items || response.items.length === 0) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const channel = response.items[0];
      return {
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnail: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url,
        videoCount: channel.statistics?.videoCount ? parseInt(channel.statistics.videoCount) : 0
      };

    } catch (error) {
      console.error('[YouTubeAPI] Error fetching channel details:', error);
      throw error;
    }
  }

  // Search for channel by username
  async searchChannelByUsername(username: string): Promise<any> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/search?part=snippet&q=${username}&type=channel&maxResults=1&key=${this.apiKey}`
      );
      
      if (!response.items || response.items.length === 0) {
        throw new Error(`No channel found for username: ${username}`);
      }
      
      const channel = response.items[0];
      return {
        channelId: channel.id.channelId,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnail: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url
      };
      
    } catch (error) {
      console.error('[YouTubeAPI] Error searching channel by username:', error);
      throw error;
    }
  }
  
  // Get playlist details (title, description, thumbnail, videoCount)
  async getPlaylistDetails(playlistId: string): Promise<any> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/playlists?part=snippet,contentDetails&id=${playlistId}&key=${this.apiKey}`
      );

      if (!response.items || response.items.length === 0) {
        throw new Error(`Playlist not found: ${playlistId}`);
      }

      const playlist = response.items[0];
      return {
        title: playlist.snippet.title,
        description: playlist.snippet.description,
        thumbnail: playlist.snippet.thumbnails?.high?.url || playlist.snippet.thumbnails?.medium?.url || playlist.snippet.thumbnails?.default?.url,
        videoCount: playlist.contentDetails?.itemCount || 0
      };

    } catch (error) {
      console.error('[YouTubeAPI] Error fetching playlist details:', error);
      throw error;
    }
  }

  // Get video details (title, description, thumbnail, duration, etc.)
  async getVideoDetails(videoId: string): Promise<any | null> {
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/videos?part=snippet,contentDetails,status&id=${videoId}&key=${this.apiKey}`
      );
      
      if (!response.items || response.items.length === 0) {
        // Classify and log the "not found" error
        const errorInfo = classifyVideoError(new Error(`Video not found: ${videoId}`), videoId);
        VideoErrorLogger.logVideoError(videoId, errorInfo);
        return null;
      }
      
      const video = response.items[0];
      return {
        id: video.id,
        snippet: video.snippet,
        contentDetails: video.contentDetails,
        status: video.status
      };
      
    } catch (error) {
      // Enhanced error logging with classification
      const errorInfo = classifyVideoError(error, videoId);
      VideoErrorLogger.logVideoError(videoId, errorInfo);
      
      // Return null instead of throwing to allow graceful failure
      return null;
    }
  }
  
  // Helper method to make HTTP requests
  private makeRequest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'SafeTube/1.0'
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }

  // Helper to convert ISO 8601 duration to seconds
  static parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const [, hours, minutes, seconds] = match;
    return (
      (parseInt(hours || '0') * 3600) +
      (parseInt(minutes || '0') * 60) +
      parseInt(seconds || '0')
    );
  }
}
