/**
 * HTTP API Handler for Parent Access
 * Provides REST API endpoints for parent access functionality
 */

import http from 'http';
import log from '../logger';
import { readMainSettings, writeMainSettings } from '../fileUtils';
import { readTimeLimits } from '../fileUtils';
import DatabaseService from '../services/DatabaseService';

/**
 * Parent Access Page HTML - Embedded as a string to avoid path resolution issues
 */
const PARENT_ACCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parent Access - SafeTube</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 800px;
            width: 100%;
            padding: 40px;
        }

        h1 {
            color: #333;
            margin-bottom: 30px;
            text-align: center;
        }

        .login-section {
            margin-bottom: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .form-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            color: #555;
            font-weight: 500;
        }

        input[type="password"],
        input[type="number"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }

        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            margin-right: 10px;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }

        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .stats-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }

        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }

        .stat-label {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 10px;
        }

        .stat-value {
            font-size: 32px;
            font-weight: bold;
        }

        .message {
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            display: none;
        }

        .message.error {
            background: #fee;
            color: #c33;
            border: 1px solid #fcc;
            display: block;
        }

        .message.success {
            background: #efe;
            color: #3c3;
            border: 1px solid #cfc;
            display: block;
        }

        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Parent Access - SafeTube</h1>

        <div id="message" class="message"></div>

        <div id="loginSection" class="login-section">
            <h2 style="margin-bottom: 15px; font-size: 18px; color: #333;">Authentication Required</h2>
            <div class="form-group">
                <label for="password">Admin Password</label>
                <input type="password" id="password" placeholder="Enter admin password">
            </div>
            <button onclick="authenticate()">Login</button>
        </div>

        <div id="mainSection" class="hidden">
            <div class="stats-section">
                <div class="stat-card">
                    <div class="stat-label">Time Used Today</div>
                    <div class="stat-value" id="timeUsed">-</div>
                    <div style="font-size: 12px; margin-top: 5px;">minutes</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Daily Limit</div>
                    <div class="stat-value" id="timeLimit">-</div>
                    <div style="font-size: 12px; margin-top: 5px;">minutes</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Time Remaining</div>
                    <div class="stat-value" id="timeRemaining">-</div>
                    <div style="font-size: 12px; margin-top: 5px;">minutes</div>
                </div>
            </div>

            <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin-bottom: 15px; color: #333;">Quick Actions</h3>
                <div class="form-group">
                    <label for="extraTime">Add Extra Time (minutes)</label>
                    <input type="number" id="extraTime" placeholder="15" min="1" max="480">
                </div>
                <button onclick="addExtraTime()">Add Extra Time</button>
                <button onclick="refreshStats()">Refresh Stats</button>
            </div>
        </div>
    </div>

    <script>
        let authenticated = false;

        function showMessage(text, isError = false) {
            const msgEl = document.getElementById('message');
            msgEl.textContent = text;
            msgEl.className = \`message \${isError ? 'error' : 'success'}\`;
            setTimeout(() => {
                msgEl.className = 'message';
            }, 5000);
        }

        async function authenticate() {
            const password = document.getElementById('password').value;
            if (!password) {
                showMessage('Please enter password', true);
                return;
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                if (!response.ok) {
                    showMessage('Authentication failed', true);
                    return;
                }

                authenticated = true;
                document.getElementById('loginSection').classList.add('hidden');
                document.getElementById('mainSection').classList.remove('hidden');
                await refreshStats();
                showMessage('Authenticated successfully!');
            } catch (error) {
                showMessage(\`Error: \${error.message}\`, true);
            }
        }

        async function refreshStats() {
            if (!authenticated) return;

            try {
                const response = await fetch('/api/usage-stats');
                if (!response.ok) throw new Error('Failed to get stats');

                const data = await response.json();
                document.getElementById('timeUsed').textContent = Math.round(data.totalTime / 60);
                document.getElementById('timeLimit').textContent = data.timeLimit;
                document.getElementById('timeRemaining').textContent = Math.max(0, data.timeRemaining / 60).toFixed(0);
            } catch (error) {
                showMessage(\`Error loading stats: \${error.message}\`, true);
            }
        }

        async function addExtraTime() {
            if (!authenticated) return;

            const minutes = parseInt(document.getElementById('extraTime').value);
            if (!minutes || minutes < 1) {
                showMessage('Please enter a valid number of minutes', true);
                return;
            }

            try {
                const response = await fetch('/api/extra-time', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ minutes })
                });

                if (!response.ok) throw new Error('Failed to add extra time');

                document.getElementById('extraTime').value = '';
                await refreshStats();
                showMessage(\`Added \${minutes} minutes of extra time!\`);
            } catch (error) {
                showMessage(\`Error: \${error.message}\`, true);
            }
        }

        // Auto-refresh stats every 30 seconds
        setInterval(() => {
            if (authenticated) refreshStats();
        }, 30000);

        // Update page title and header with URL if accessed remotely
        window.addEventListener('load', () => {
            const currentUrl = window.location.origin;
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            // Always show the URL in the header (not just remotely)
            const h1 = document.querySelector('h1');
            if (h1) {
                h1.textContent = \`🔐 SafeTube - Parent Access - \${currentUrl}\`;
            }

            // Update the page title with the URL
            document.title = \`SafeTube - Parent Access - \${currentUrl}\`;
        });
    </script>
</body>
</html>`;


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
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PARENT_ACCESS_HTML);
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
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PARENT_ACCESS_HTML);
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

    return {
      status: 200,
      body: {
        totalTime: state.timeUsedToday,
        timeLimit,
        timeRemaining: state.timeRemaining,
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
