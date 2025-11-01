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

/**
 * Get Parent Access HTML Bundle
 * Loads the built React admin app bundle
 */
function getParentAccessHTML(): string {
  try {
    // Try to load the built admin bundle first
    const distPath = path.join(__dirname, '../../dist/renderer/admin-http.html');
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
    const mainPath = path.join(__dirname, '../../dist/renderer/index.html');
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
    } else if (path === '/api/settings' && method === 'GET') {
      response = await handleGetSettings();
    } else if (path === '/api/settings' && method === 'POST') {
      response = await handleSaveSettings(body);
    } else if (path === '/api/admin/hash-password' && method === 'POST') {
      response = await handleHashPassword(body);
    } else if (path === '/api/features' && method === 'GET') {
      response = await handleGetFeatures();
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
      const sources = await (dbService as any).all(`
        SELECT id, type, title
        FROM sources
        ORDER BY position ASC, title ASC
      `) as any;
      return { status: 200, body: sources || [] };
    }

    return { status: 200, body: [] };
  } catch (error) {
    log.error('[API] Error getting video sources:', error);
    return { status: 500, body: { error: 'Failed to get video sources' } };
  }
}

/**
 * Get main settings (limited to non-sensitive fields)
 */
async function handleGetSettings(): Promise<ApiResponse> {
  try {
    const mainSettings = await readMainSettings();

    // Return only non-sensitive settings
    const safeSettings = {
      remoteAccessEnabled: (mainSettings as any).remoteAccessEnabled || false,
      downloadPath: (mainSettings as any).downloadPath,
      verbose_logging: (mainSettings as any).verbose_logging || false
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
        hasFileSystem: false,
        hasDatabase: false,
        hasRestart: false,
        hasAppExit: false,
        hasNetworkInfo: false,
        canEditTimeLimits: true,
        canEditSettings: true,
        canAddExtraTime: true,
        canEditPassword: true
      }
    };
  } catch (error) {
    log.error('[API] Error getting features:', error);
    return { status: 500, body: { error: 'Failed to get features' } };
  }
}
