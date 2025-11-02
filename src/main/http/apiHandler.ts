/**
 * HTTP API Handler for Parent Access
 * Provides REST API endpoints for parent access functionality
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import log from '../logger';
import { readMainSettings, writeMainSettings } from '../fileUtils';
import { readTimeLimits } from '../fileUtils';
import DatabaseService from '../services/DatabaseService';
import { YouTubeAPI } from '../youtube-api';
import { extractChannelId, extractPlaylistId } from '../../shared/videoSourceUtils';

/**
 * Get Parent Access HTML Bundle
 * Loads the built React admin app bundle
 */
function getParentAccessHTML(): string {
  try {
    // Try to load the built admin bundle first
    const distPath = path.join(__dirname, '../../../renderer/admin-http.html');
    if (fs.existsSync(distPath)) {
      let html = fs.readFileSync(distPath, 'utf-8');
      // Rewrite relative asset paths to absolute paths so they work from /admin and /parent-access routes
      html = html.replace(/src="\.\/assets\//g, 'src="/assets/');
      html = html.replace(/href="\.\/assets\//g, 'href="/assets/');
      return html;
    }
  } catch (e) {
    log.warn('[API] Failed to load built admin bundle, falling back to main page:', e);
  }

  // Fallback to main page HTML if admin bundle doesn't exist yet
  try {
    const mainPath = path.join(__dirname, '../../../renderer/index.html');
    if (fs.existsSync(mainPath)) {
      let html = fs.readFileSync(mainPath, 'utf-8');
      // Rewrite relative asset paths to absolute paths
      html = html.replace(/src="\.\/assets\//g, 'src="/assets/');
      html = html.replace(/href="\.\/assets\//g, 'href="/assets/');
      return html;
    }
  } catch (e) {
    log.error('[API] Failed to load main page:', e);
  }

  // Final fallback: serve a minimal loading page
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parent Access - SafeTube</title>
</head>
<body style="display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: system-ui, sans-serif; color: white;">
    <div style="text-align: center;">
        <h1>SafeTube Parent Access</h1>
        <p>Loading admin interface...</p>
        <p style="font-size: 12px; opacity: 0.7; margin-top: 20px;">If this page doesn't load, please try refreshing.</p>
    </div>
</body>
</html>`;
}


interface ApiRequest {
  method: string;
  path: string;
  query: Record<string, any>;
  body: any;
  headers: Record<string, string>;
}

interface ApiResponse {
  status: number;
  body: any;
}

/**
 * Parse request body
 */
async function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handle API requests
 */
export async function handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const path = req.url || '/';

  // Handle admin/parent access page (remote access - public route)
  if (path === '/admin' || path === '/admin/') {
    try {
      const html = getParentAccessHTML();
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return true;
    } catch (error) {
      log.error('[API] Error serving admin page:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load page' }));
      return true;
    }
  }

  // Handle parent access page (internal electron route)
  if (path === '/parent-access' || path === '/parent-access/') {
    try {
      const html = getParentAccessHTML();
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return true;
    } catch (error) {
      log.error('[API] Error serving parent access page:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load page' }));
      return true;
    }
  }

  // Only handle /api routes
  if (!path.startsWith('/api/')) {
    return false;
  }

  try {
    const method = req.method || 'GET';
    const body = method !== 'GET' ? await parseBody(req) : undefined;

    let response: ApiResponse = { status: 404, body: { error: 'Not found' } };

    // Route API requests
    if (path === '/api/auth/login' && method === 'POST') {
      response = await handleAuthLogin(body);
    } else if (path === '/api/time-limits' && method === 'GET') {
      response = await handleGetTimeLimits();
    } else if (path === '/api/time-limits' && method === 'POST') {
      response = await handleSetTimeLimits(body);
    } else if (path === '/api/usage-stats' && method === 'GET') {
      response = await handleGetUsageStats();
    } else if (path === '/api/extra-time' && method === 'GET') {
      response = await handleGetExtraTime();
    } else if (path === '/api/extra-time' && method === 'POST') {
      response = await handleAddExtraTime(body);
    } else if (path === '/api/video-sources' && method === 'GET') {
      response = await handleGetVideoSources();
    } else if (path === '/api/video-sources' && method === 'POST') {
      response = await handleSaveVideoSources(body);
    } else if (path === '/api/settings' && method === 'GET') {
      response = await handleGetSettings();
    } else if (path === '/api/settings' && method === 'POST') {
      response = await handleSaveSettings(body);
    } else if (path === '/api/admin/hash-password' && method === 'POST') {
      response = await handleHashPassword(body);
    } else if (path === '/api/features' && method === 'GET') {
      response = await handleGetFeatures();
    } else if (path === '/api/validate/youtube-url' && method === 'POST') {
      response = await handleValidateYouTubeUrl(body);
    } else if (path === '/api/validate/local-path' && method === 'POST') {
      response = await handleValidateLocalPath(body);
    } else if (path.startsWith('/api/search-history') && method === 'GET') {
      const limitMatch = path.match(/limit=(\d+)/);
      const limit = limitMatch ? parseInt(limitMatch[1]) : 100;
      response = await handleGetSearchHistory(limit);
    } else if (path === '/api/search-results' && method === 'POST') {
      response = await handleGetSearchResults(body);
    } else {
      response = { status: 404, body: { error: 'API endpoint not found' } };
    }

    // Send response
    res.writeHead(response.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response.body));
    return true;
  } catch (error) {
    log.error('[API] Error handling request:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
    return true;
  }
}

/**
 * Handle admin login
 */
async function handleAuthLogin(body: any): Promise<ApiResponse> {
  try {
    const { password } = body;
    if (!password) {
      return { status: 400, body: { error: 'Password required' } };
    }

    const mainSettings = await readMainSettings();
    const passwordHash = mainSettings.adminPassword;

    if (!passwordHash) {
      log.error('[API] Admin password not configured');
      return { status: 500, body: { error: 'Admin password not configured' } };
    }

    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!isValid) {
      log.warn('[API] Authentication failed');
      return { status: 401, body: { error: 'Invalid password' } };
    }

    // In a real implementation, you'd create a session token here
    // For now, we'll return a simple success response
    log.info('[API] Authentication successful');
    return { status: 200, body: { success: true, token: 'temp-token' } };
  } catch (error) {
    log.error('[API] Error during authentication:', error);
    return { status: 500, body: { error: 'Authentication error' } };
  }
}

/**
 * Get time limits
 */
async function handleGetTimeLimits(): Promise<ApiResponse> {
  try {
    const dbService = (DatabaseService as any).getInstance();
    const result = await dbService.get(`
      SELECT monday, tuesday, wednesday, thursday, friday, saturday, sunday
      FROM time_limits
      WHERE id = 1
    `) as any;

    if (!result) {
      return {
        status: 200,
        body: {
          Monday: 30, Tuesday: 30, Wednesday: 30, Thursday: 30,
          Friday: 30, Saturday: 60, Sunday: 60
        }
      };
    }

    return {
      status: 200,
      body: {
        Monday: result.monday,
        Tuesday: result.tuesday,
        Wednesday: result.wednesday,
        Thursday: result.thursday,
        Friday: result.friday,
        Saturday: result.saturday,
        Sunday: result.sunday
      }
    };
  } catch (error) {
    log.error('[API] Error getting time limits:', error);
    return { status: 500, body: { error: 'Failed to get time limits' } };
  }
}

/**
 * Set time limits
 */
async function handleSetTimeLimits(body: any): Promise<ApiResponse> {
  try {
    const dbService = (DatabaseService as any).getInstance();
    const timeLimits = body;

    await dbService.run(`
      INSERT OR REPLACE INTO time_limits (
        id, monday, tuesday, wednesday, thursday, friday, saturday, sunday
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `, [
      timeLimits.Monday || 0,
      timeLimits.Tuesday || 0,
      timeLimits.Wednesday || 0,
      timeLimits.Thursday || 0,
      timeLimits.Friday || 0,
      timeLimits.Saturday || 0,
      timeLimits.Sunday || 0
    ]);

    log.info('[API] Time limits updated');
    return { status: 200, body: { success: true } };
  } catch (error) {
    log.error('[API] Error setting time limits:', error);
    return { status: 500, body: { error: 'Failed to set time limits' } };
  }
}

/**
 * Get usage statistics for today
 */
async function handleGetUsageStats(): Promise<ApiResponse> {
  try {
    // Get time limit for today's weekday
    const weekday = new Date().getDay();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeLimits = await handleGetTimeLimits();
    const dayName = days[weekday];
    const timeLimit = (timeLimits.body as any)[dayName] || 30;

    // Get time tracking state
    const { getTimeTrackingState } = await import('../timeTracking');
    const state = await getTimeTrackingState();

    // Get extra time for today
    const dbService = (DatabaseService as any).getInstance();
    let extraTime = 0;
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await dbService.get(`
        SELECT SUM(minutes_added) as total
        FROM usage_extras
        WHERE date = ?
      `, [today]) as any;
      extraTime = result?.total || 0;
    } catch (e) {
      // Extra time table might not exist, use 0
      extraTime = 0;
    }

    return {
      status: 200,
      body: {
        totalTime: state.timeUsedToday,
        timeLimit,
        timeRemaining: state.timeRemaining,
        extraTime,
        isTimeLimit: state.isLimitReached
      }
    };
  } catch (error) {
    log.error('[API] Error getting usage stats:', error);
    return { status: 500, body: { error: 'Failed to get usage stats' } };
  }
}

/**
 * Get extra time for today
 */
async function handleGetExtraTime(): Promise<ApiResponse> {
  try {
    const mainSettings = await readMainSettings();
    // Read from usageLog.json as a simple implementation
    // In a full implementation, this would read from the database
    const extraTime = 0; // Placeholder

    return { status: 200, body: { extraTime } };
  } catch (error) {
    log.error('[API] Error getting extra time:', error);
    return { status: 500, body: { error: 'Failed to get extra time' } };
  }
}

/**
 * Add extra time for today
 */
async function handleAddExtraTime(body: any): Promise<ApiResponse> {
  try {
    const { minutes } = body;
    if (!minutes) {
      return { status: 400, body: { error: 'Minutes required' } };
    }

    const dbService = (DatabaseService as any).getInstance();
    const today = new Date().toISOString().split('T')[0];

    await dbService.run(`
      INSERT INTO usage_extras (date, minutes_added, reason, added_by)
      VALUES (?, ?, ?, ?)
    `, [today, minutes, 'Manual addition from parent access', 'parent']);

    log.info('[API] Extra time added:', minutes);
    return { status: 200, body: { success: true } };
  } catch (error) {
    log.error('[API] Error adding extra time:', error);
    return { status: 500, body: { error: 'Failed to add extra time' } };
  }
}

/**
 * Get video sources
 */
async function handleGetVideoSources(): Promise<ApiResponse> {
  try {
    const dbService = (DatabaseService as any).getInstance();
    const status = await dbService.getHealthStatus();

    if (dbService && status.initialized) {
      const rows = await (dbService as any).all(`
        SELECT id, type, title, url, path, channel_id, sort_preference, max_depth, position
        FROM sources
        ORDER BY position ASC, title ASC
      `) as any;

      // Transform database rows to VideoSource objects
      const sources = (rows || []).map((row: any) => {
        const base = {
          id: row.id,
          type: row.type,
          title: row.title,
        };

        if (row.type === 'youtube_channel') {
          return {
            ...base,
            url: row.url,
            channelId: row.channel_id,
            sortPreference: row.sort_preference || 'newestFirst',
          };
        } else if (row.type === 'youtube_playlist') {
          return {
            ...base,
            url: row.url,
            sortPreference: row.sort_preference || 'playlistOrder',
          };
        } else if (row.type === 'local') {
          return {
            ...base,
            path: row.path,
            sortPreference: row.sort_preference || 'alphabetical',
            maxDepth: row.max_depth || 2,
          };
        }
        return base;
      });

      return { status: 200, body: sources };
    }

    return { status: 200, body: [] };
  } catch (error) {
    log.error('[API] Error getting video sources:', error);
    return { status: 500, body: { error: 'Failed to get video sources' } };
  }
}

/**
 * Save all video sources
 */
async function handleSaveVideoSources(body: any): Promise<ApiResponse> {
  try {
    if (!Array.isArray(body)) {
      return { status: 400, body: { error: 'Sources must be an array' } };
    }

    const dbService = (DatabaseService as any).getInstance();
    const status = await dbService.getHealthStatus();

    if (!dbService || !status.initialized) {
      return { status: 500, body: { error: 'Database not initialized' } };
    }

    // Delete all existing sources first
    await (dbService as any).run('DELETE FROM sources');

    // Insert new sources with position
    for (let i = 0; i < body.length; i++) {
      const source = body[i];
      const position = i + 1;

      if (source.type === 'youtube_channel') {
        await (dbService as any).run(`
          INSERT INTO sources (id, type, title, url, channel_id, sort_preference, position)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [source.id, source.type, source.title, source.url, source.channelId || null,
            source.sortPreference || 'newestFirst', position]);
      } else if (source.type === 'youtube_playlist') {
        await (dbService as any).run(`
          INSERT INTO sources (id, type, title, url, sort_preference, position)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [source.id, source.type, source.title, source.url,
            source.sortPreference || 'playlistOrder', position]);
      } else if (source.type === 'local') {
        await (dbService as any).run(`
          INSERT INTO sources (id, type, title, path, sort_preference, max_depth, position)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [source.id, source.type, source.title, source.path,
            source.sortPreference || 'alphabetical', source.maxDepth || 2, position]);
      }
    }

    log.info('[API] Video sources saved successfully');
    return { status: 200, body: { success: true, message: 'Sources saved' } };
  } catch (error) {
    log.error('[API] Error saving video sources:', error);
    return { status: 500, body: { error: 'Failed to save video sources' } };
  }
}

/**
 * Get main settings (limited to non-sensitive fields)
 */
async function handleGetSettings(): Promise<ApiResponse> {
  try {
    const mainSettings = await readMainSettings();

    // Return all non-sensitive settings
    const safeSettings = {
      youtubeApiKey: (mainSettings as any).youtubeApiKey || '',
      enableVerboseLogging: (mainSettings as any).enableVerboseLogging || false,
      allowYouTubeClicksToOtherVideos: (mainSettings as any).allowYouTubeClicksToOtherVideos || false,
      remoteAccessEnabled: (mainSettings as any).remoteAccessEnabled || false,
      downloadPath: (mainSettings as any).downloadPath || '',
      adminPassword: '' // Never return the actual password, leave blank for editing
    };

    return { status: 200, body: safeSettings };
  } catch (error) {
    log.error('[API] Error getting settings:', error);
    return { status: 500, body: { error: 'Failed to get settings' } };
  }
}

/**
 * Save main settings
 */
async function handleSaveSettings(body: any): Promise<ApiResponse> {
  try {
    const settings = {
      youtubeApiKey: body.youtubeApiKey || '',
      adminPassword: body.adminPassword || '',
      enableVerboseLogging: body.enableVerboseLogging || false,
      allowYouTubeClicksToOtherVideos: body.allowYouTubeClicksToOtherVideos || false,
      remoteAccessEnabled: body.remoteAccessEnabled || false
    };

    // Hash password if provided
    if (settings.adminPassword && settings.adminPassword.trim()) {
      const bcrypt = require('bcrypt');
      settings.adminPassword = await bcrypt.hash(settings.adminPassword, 10);
    } else {
      // Keep existing password if not provided
      const mainSettings = await readMainSettings();
      settings.adminPassword = (mainSettings as any).adminPassword || '';
    }

    await writeMainSettings(settings as any);
    log.info('[API] Settings saved');
    return { status: 200, body: { success: true } };
  } catch (error) {
    log.error('[API] Error saving settings:', error);
    return { status: 500, body: { error: 'Failed to save settings' } };
  }
}

/**
 * Hash password
 */
async function handleHashPassword(body: any): Promise<ApiResponse> {
  try {
    const { password } = body;
    if (!password) {
      return { status: 400, body: { error: 'Password required' } };
    }

    const bcrypt = require('bcrypt');
    const hashed = await bcrypt.hash(password, 10);

    return { status: 200, body: { hashed } };
  } catch (error) {
    log.error('[API] Error hashing password:', error);
    return { status: 500, body: { error: 'Failed to hash password' } };
  }
}

/**
 * Get feature flags for HTTP mode
 */
async function handleGetFeatures(): Promise<ApiResponse> {
  try {
    return {
      status: 200,
      body: {
        // Feature flags for what this access mode supports
        hasDatabase: true,           // Can access database features (video sources, etc.)
        hasFileSystem: false,        // Cannot access file system over HTTP
        hasAppRestart: false,        // Cannot restart app over HTTP
        canManageVideoSources: true, // Can manage video sources (database available)
        canViewSearchHistory: true,  // Can view search history (database available)
        canModerateWishlist: true    // Can moderate wishlist (database available)
      }
    };
  } catch (error) {
    log.error('[API] Error getting features:', error);
    return { status: 500, body: { error: 'Failed to get features' } };
  }
}

/**
 * Validate a YouTube URL and fetch metadata
 */
async function handleValidateYouTubeUrl(body: any): Promise<ApiResponse> {
  try {
    const { url, type } = body;

    if (!url || !type) {
      return { status: 400, body: { error: 'URL and type are required' } };
    }

    if (type !== 'youtube_channel' && type !== 'youtube_playlist') {
      return { status: 400, body: { error: 'Invalid type' } };
    }

    if (type === 'youtube_channel') {
      // Validate YouTube channel URL format
      const channelMatch = url.match(/(?:youtube\.com\/(?:c\/|channel\/|user\/|@))([\w-]+)/);
      if (!channelMatch) {
        return { status: 200, body: { isValid: false, errors: ['Invalid YouTube channel URL format'] } };
      }

      // Try to fetch channel details with API if available
      try {
        const settings = await readMainSettings();
        const apiKey = settings.youtubeApiKey;

        if (apiKey) {
          try {
            const channelId = extractChannelId(url);
            if (channelId) {
              const youtubeApi = new YouTubeAPI(apiKey);
              const channelDetails = await youtubeApi.getChannelDetails(channelId);
              return {
                status: 200,
                body: {
                  isValid: true,
                  title: channelDetails.title,
                  channelId: channelId
                }
              };
            } else {
              // If we can't extract channel ID, try searching by username for @ URLs
              const usernameMatch = url.match(/@([^/]+)/);
              if (usernameMatch) {
                const youtubeApi = new YouTubeAPI(apiKey);
                const searchResult = await youtubeApi.searchChannelByUsername(usernameMatch[1]);
                return {
                  status: 200,
                  body: {
                    isValid: true,
                    title: searchResult.title,
                    channelId: searchResult.channelId
                  }
                };
              }
            }
          } catch (apiError) {
            log.warn('[API] YouTube API error for channel, falling back to format validation:', apiError);
            // Fall back to format validation if API fails
          }
        }
      } catch (settingsError) {
        log.warn('[API] Error reading settings for API key:', settingsError);
      }

      // Fallback: just validate format without fetching title
      return { status: 200, body: { isValid: true } };

    } else if (type === 'youtube_playlist') {
      // Validate YouTube playlist URL format
      const playlistMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
      if (!playlistMatch) {
        return { status: 200, body: { isValid: false, errors: ['Invalid YouTube playlist URL format'] } };
      }

      // Check if it's a watch URL that should be cleaned to a proper playlist URL
      const isWatchUrl = url.includes('/watch?') && url.includes('list=');
      let cleanedUrl: string | undefined;

      if (isWatchUrl) {
        const listId = playlistMatch[1];
        cleanedUrl = `https://www.youtube.com/playlist?list=${listId}`;
      }

      // Try to fetch playlist details with API if available
      try {
        const settings = await readMainSettings();
        const apiKey = settings.youtubeApiKey;

        if (apiKey) {
          try {
            const playlistId = extractPlaylistId(url);
            if (playlistId) {
              const youtubeApi = new YouTubeAPI(apiKey);
              const playlistDetails = await youtubeApi.getPlaylistDetails(playlistId);
              return {
                status: 200,
                body: {
                  isValid: true,
                  title: playlistDetails.title,
                  cleanedUrl
                }
              };
            }
          } catch (apiError) {
            log.warn('[API] YouTube API error for playlist, falling back to format validation:', apiError);
            // Fall back to format validation if API fails
          }
        }
      } catch (settingsError) {
        log.warn('[API] Error reading settings for API key:', settingsError);
      }

      // Fallback: just validate format without fetching title
      return { status: 200, body: { isValid: true, cleanedUrl } };
    }

    return { status: 400, body: { error: 'Invalid type' } };
  } catch (error) {
    log.error('[API] Error validating YouTube URL:', error);
    return { status: 500, body: { error: 'Failed to validate YouTube URL' } };
  }
}

/**
 * Validate a local folder path
 */
async function handleValidateLocalPath(body: any): Promise<ApiResponse> {
  try {
    const { path } = body;

    if (!path) {
      return { status: 400, body: { error: 'Path is required' } };
    }

    // For HTTP mode, we can't validate local paths (no file system access)
    // Return a basic validation result
    return {
      status: 200,
      body: {
        isValid: true,
        errors: []
      }
    };
  } catch (error) {
    log.error('[API] Error validating local path:', error);
    return { status: 500, body: { error: 'Failed to validate local path' } };
  }
}

/**
 * Get search history
 */
async function handleGetSearchHistory(limit: number): Promise<ApiResponse> {
  try {
    const dbService = (DatabaseService as any).getInstance();
    log.debug(`[API] Getting search history with limit: ${limit}`);

    const searches = await dbService.all(`
      SELECT id, query, search_type, result_count, timestamp, created_at
      FROM searches
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]) as any[];

    log.debug(`[API] Found ${searches ? searches.length : 0} searches`);

    if (!searches) {
      return { status: 200, body: [] };
    }

    return { status: 200, body: searches };
  } catch (error) {
    log.error('[API] Error getting search history:', error);
    return { status: 500, body: { error: 'Failed to get search history' } };
  }
}

/**
 * Get cached search results for a specific search
 */
async function handleGetSearchResults(body: any): Promise<ApiResponse> {
  try {
    const { query, searchType } = body;

    if (!query || !searchType) {
      return { status: 400, body: { error: 'Query and searchType are required' } };
    }

    log.debug(`[API] Getting cached results for query="${query}" type="${searchType}"`);

    const dbService = (DatabaseService as any).getInstance();
    const results = await dbService.all(`
      SELECT id, video_data, position
      FROM search_results_cache
      WHERE search_query = ? AND search_type = ?
      ORDER BY position ASC
      LIMIT 100
    `, [query, searchType]) as any[];

    log.debug(`[API] Found ${results ? results.length : 0} cached results for query="${query}"`);

    if (!results || results.length === 0) {
      return { status: 200, body: [] };
    }

    // Parse video_data JSON for each result
    const parsedResults = results.map((result: any) => {
      try {
        const videoData = typeof result.video_data === 'string' ? JSON.parse(result.video_data) : result.video_data;
        return {
          ...videoData,
          id: videoData.id || `result-${result.id}`,
          type: 'youtube' as const, // Search cache results are always youtube videos
          isApprovedSource: false, // Mark as not from approved source for admin review
        };
      } catch (e) {
        log.warn('[API] Failed to parse video_data for search result:', e);
        return null;
      }
    }).filter(Boolean);

    log.debug(`[API] Parsed ${parsedResults.length} results for query="${query}"`);

    return { status: 200, body: parsedResults };
  } catch (error) {
    log.error('[API] Error getting search results:', error);
    return { status: 500, body: { error: 'Failed to get search results' } };
  }
}
