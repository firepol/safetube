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
 * Parent Access Page HTML - React Admin App Entry Point
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
            margin: 0;
            padding: 0;
        }

        #root {
            min-height: 100vh;
            width: 100%;
        }

        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            color: white;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">Loading Admin Interface...</div>
    </div>

    <script type="module">
        // Import React and ReactDOM from CDN for HTTP mode
        import React from 'https://esm.sh/react@18.2.0';
        import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';

        // Patch window object to make it compatible with AdminDataAccess
        // In HTTP mode, we don't have window.electron - the HTTPAdminDataAccess will be used
        if (!window.electron) {
            // HTTPAdminDataAccess will be used automatically
        }

        // Dynamically import and render the AdminApp
        const renderApp = async () => {
            try {
                // Import the AdminApp component (assumes it's available globally or via module)
                // For now, we'll create a minimal React app inline
                const root = ReactDOM.createRoot(document.getElementById('root'));

                // Create a simple authentication and time management UI for HTTP mode
                const AdminApp = () => {
                    const [isAuth, setIsAuth] = React.useState(false);
                    const [password, setPassword] = React.useState('');
                    const [stats, setStats] = React.useState(null);
                    const [extraTime, setExtraTime] = React.useState('');
                    const [message, setMessage] = React.useState('');

                    const authenticate = async () => {
                        try {
                            const res = await fetch('/api/auth/login', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ password })
                            });
                            if (res.ok) {
                                setIsAuth(true);
                                setPassword('');
                                loadStats();
                                showMessage('Authenticated!', false);
                            } else {
                                showMessage('Invalid password', true);
                            }
                        } catch (e) {
                            showMessage(\`Error: \${e.message}\`, true);
                        }
                    };

                    const loadStats = async () => {
                        try {
                            const res = await fetch('/api/usage-stats');
                            if (res.ok) {
                                const data = await res.json();
                                setStats(data);
                            }
                        } catch (e) {
                            showMessage(\`Error loading stats: \${e.message}\`, true);
                        }
                    };

                    const handleAddExtraTime = async () => {
                        if (!extraTime) return;
                        try {
                            const res = await fetch('/api/extra-time', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ minutes: parseInt(extraTime) })
                            });
                            if (res.ok) {
                                setExtraTime('');
                                loadStats();
                                showMessage(\`Added \${extraTime} minutes!\`, false);
                            }
                        } catch (e) {
                            showMessage(\`Error: \${e.message}\`, true);
                        }
                    };

                    const showMessage = (msg, isError) => {
                        setMessage(msg);
                        setTimeout(() => setMessage(''), 5000);
                    };

                    if (!isAuth) {
                        return React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' } },
                            React.createElement('div', { style: { background: 'white', borderRadius: '12px', padding: '40px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' } },
                                React.createElement('h1', { style: { marginBottom: '20px', textAlign: 'center' } }, '🔐 Parent Access'),
                                message && React.createElement('div', { style: { padding: '10px', marginBottom: '20px', borderRadius: '6px', background: message.includes('Invalid') || message.includes('Error') ? '#fee' : '#efe', color: message.includes('Invalid') || message.includes('Error') ? '#c33' : '#3c3' } }, message),
                                React.createElement('input', { type: 'password', placeholder: 'Password', value: password, onChange: (e) => setPassword(e.target.value), onKeyPress: (e) => e.key === 'Enter' && authenticate(), style: { width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' } }),
                                React.createElement('button', { onClick: authenticate, style: { width: '100%', padding: '10px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' } }, 'Login')
                            )
                        );
                    }

                    return React.createElement('div', { style: { background: 'linear-gradient(135deg, #667eea, #764ba2)', minHeight: '100vh', padding: '20px' } },
                        React.createElement('div', { style: { maxWidth: '1200px', margin: '0 auto' } },
                            React.createElement('h1', { style: { color: 'white', marginBottom: '30px', textAlign: 'center' } }, '🔐 SafeTube - Parent Access'),
                            message && React.createElement('div', { style: { padding: '15px', marginBottom: '20px', borderRadius: '6px', background: message.includes('Error') ? '#fee' : '#efe', color: message.includes('Error') ? '#c33' : '#3c3', maxWidth: '600px', margin: '0 auto 20px' } }, message),
                            React.createElement('div', { style: { background: 'white', borderRadius: '12px', padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' } },
                                React.createElement('h2', { style: { marginBottom: '20px' } }, 'Time Management'),
                                stats && React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' } },
                                    React.createElement('div', { style: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center' } },
                                        React.createElement('div', { style: { fontSize: '12px', opacity: 0.8 } }, 'Time Used'),
                                        React.createElement('div', { style: { fontSize: '32px', fontWeight: 'bold' } }, Math.round(stats.totalTime / 60)),
                                        React.createElement('div', { style: { fontSize: '12px' } }, 'minutes')
                                    ),
                                    React.createElement('div', { style: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center' } },
                                        React.createElement('div', { style: { fontSize: '12px', opacity: 0.8 } }, 'Daily Limit'),
                                        React.createElement('div', { style: { fontSize: '32px', fontWeight: 'bold' } }, stats.timeLimit),
                                        React.createElement('div', { style: { fontSize: '12px' } }, 'minutes')
                                    ),
                                    React.createElement('div', { style: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center' } },
                                        React.createElement('div', { style: { fontSize: '12px', opacity: 0.8 } }, 'Time Remaining'),
                                        React.createElement('div', { style: { fontSize: '32px', fontWeight: 'bold' } }, Math.max(0, (stats.timeRemaining / 60).toFixed(0))),
                                        React.createElement('div', { style: { fontSize: '12px' } }, 'minutes')
                                    )
                                ),
                                React.createElement('div', { style: { background: '#f8f9fa', padding: '20px', borderRadius: '8px' } },
                                    React.createElement('h3', { style: { marginBottom: '15px' } }, 'Add Extra Time'),
                                    React.createElement('div', { style: { marginBottom: '10px' } },
                                        React.createElement('input', { type: 'number', placeholder: '15', value: extraTime, onChange: (e) => setExtraTime(e.target.value), min: '1', max: '480', style: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' } })
                                    ),
                                    React.createElement('button', { onClick: handleAddExtraTime, style: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' } }, 'Add Extra Time'),
                                    React.createElement('button', { onClick: loadStats, style: { marginLeft: '10px', background: '#666', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' } }, 'Refresh')
                                ),
                                React.createElement('p', { style: { marginTop: '20px', textAlign: 'center', color: '#999', fontSize: '12px' } }, 'Limited admin interface - Some features are only available in the desktop application')
                            )
                        )
                    );
                };

                root.render(React.createElement(AdminApp));
            } catch (e) {
                console.error('Failed to load admin app:', e);
                document.getElementById('root').innerHTML = '<div class="loading" style="color: red;">Failed to load admin interface. Please refresh the page.</div>';
            }
        };

        // Load the app when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', renderApp);
        } else {
            renderApp();
        }
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
