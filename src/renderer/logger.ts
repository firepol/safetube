// Simple console-based logger for renderer process
// Respects ELECTRON_LOG_VERBOSE environment variable

/**
 * Determines if verbose logging should be enabled based on the current environment
 */
function shouldLogVerbose(): boolean {
  // Check if we're in a test environment
  const isTestEnvironment =
    typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ||
    typeof jest !== 'undefined' ||
    typeof (globalThis as any).vitest !== 'undefined' ||
    (typeof process !== 'undefined' && process.env.VITEST !== undefined);

  if (isTestEnvironment) {
    return typeof process !== 'undefined' && process.env.TEST_LOG_VERBOSE === 'true';
  }

  // In Electron app environment
  return typeof process !== 'undefined' && process.env.ELECTRON_LOG_VERBOSE === 'true';
}

const log = {
  verbose: (message: string, ...args: any[]) => {
    if (shouldLogVerbose()) {
      console.log(`[Renderer] [verbose] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    console.log(`[Renderer] [info] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[Renderer] [warn] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[Renderer] [error] ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    console.log(`[Renderer] [debug] ${message}`, ...args);
  }
};

export default log; 