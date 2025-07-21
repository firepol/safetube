export function logVerbose(...args: any[]) {
  if (process.env.ELECTRON_LOG_VERBOSE === 'true') {
    // eslint-disable-next-line no-console
    console.log('[Preload][Verbose]', ...args);
  }
} 