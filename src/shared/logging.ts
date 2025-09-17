/**
 * Logging utility for controlling verbosity across different environments
 */

export function logVerbose(...args: any[]) {
  if (process.env.ELECTRON_LOG_VERBOSE === 'true') {
    // eslint-disable-next-line no-console
    console.log('[Main][Verbose]', ...args);
  }
}

export const logVerboseRenderer = (...args: any[]) => {
  let isVerbose = false;
  if (typeof window !== 'undefined' && window.electron?.env?.ELECTRON_LOG_VERBOSE === 'true') {
    isVerbose = true;
  } else if (typeof process !== 'undefined' && process.env.ELECTRON_LOG_VERBOSE === 'true') {
    isVerbose = true;
  }
  if (isVerbose) {
    // eslint-disable-next-line no-console
    console.log('[Renderer][Verbose]', ...args);
  }
};

/**
 * Logs an error message (always logged, regardless of verbosity setting)
 * @param args - Arguments to pass to console.error
 */
export function logError(...args: any[]): void {
  console.error(...args);
}

/**
 * Logs a warning message (always logged, regardless of verbosity setting)
 * @param args - Arguments to pass to console.warn
 */
export function logWarning(...args: any[]): void {
  console.warn(...args);
} 