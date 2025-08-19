/**
 * Renderer-specific logging utility
 * Checks for verbose logging setting and only logs when enabled
 */

// Cache for verbose logging setting to avoid repeated IPC calls
let verboseLoggingCache: boolean | null = null;

// Initialize verbose logging setting once when module loads
const initializeVerboseLogging = async () => {
  try {
    // Check if we're in an Electron environment and can access the preload API
    if (typeof window !== 'undefined' && window.electron?.getVerboseLogging) {
      try {
        const result = await window.electron.getVerboseLogging();
        const verbose = result.verbose;
        console.log('[Renderer][Debug] ELECTRON_LOG_VERBOSE from main process:', verbose);
        verboseLoggingCache = verbose;
      } catch (error) {
        console.log('[Renderer][Debug] Error getting verbose setting from main process:', error);
        // Fallback to localStorage if IPC fails
        const localStorageVerbose = localStorage.getItem('ELECTRON_LOG_VERBOSE') === 'true';
        console.log('[Renderer][Debug] Using localStorage fallback, ELECTRON_LOG_VERBOSE:', localStorageVerbose);
        verboseLoggingCache = localStorageVerbose;
      }
    } else {
      // Fallback to localStorage if preload API is not available
      const localStorageVerbose = localStorage.getItem('ELECTRON_LOG_VERBOSE') === 'true';
      console.log('[Renderer][Debug] Using localStorage fallback, ELECTRON_LOG_VERBOSE:', localStorageVerbose);
      verboseLoggingCache = localStorageVerbose;
    }
  } catch (error) {
    // Fallback to false if neither is available
    console.log('[Renderer][Debug] Error checking verbose logging:', error);
    verboseLoggingCache = false;
  }
};

// Check if verbose logging is enabled (synchronous, uses cached value)
const isVerboseLoggingEnabled = (): boolean => {
  // If not initialized yet, return false
  if (verboseLoggingCache === null) {
    return false;
  }
  return verboseLoggingCache;
};

/**
 * Logs messages only when verbose logging is enabled
 * @param args - Arguments to pass to console.log
 */
export const logVerbose = (...args: any[]): void => {
  if (isVerboseLoggingEnabled()) {
    // Log to both console and main process via IPC
    console.log('[Renderer][Verbose]', ...args);
    
    // Also send to main process via IPC if available
    if (typeof window !== 'undefined' && window.electron?.log) {
      try {
        // Fire and forget - don't await to keep it synchronous
        window.electron.log('verbose', ...args).catch(() => {
          // Silently fail if IPC logging fails
        });
      } catch (error) {
        // Silently fail if IPC logging fails
      }
    }
  }
};

/**
 * Logs error messages (always logged, regardless of verbosity setting)
 * @param args - Arguments to pass to console.error
 */
export const logError = (...args: any[]): void => {
  console.error(...args);
};

/**
 * Logs warning messages (always logged, regardless of verbosity setting)
 * @param args - Arguments to pass to console.warn
 */
export const logWarning = (...args: any[]): void => {
  console.warn(...args);
};

// Initialize verbose logging when module loads
if (typeof window !== 'undefined') {
  initializeVerboseLogging();
}
