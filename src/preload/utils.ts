// Local logging function that follows the same pattern as logVerbose
function logVerbose(...args: any[]) {
    if (process.env.ELECTRON_LOG_VERBOSE === 'true') {
      console.log('[Preload][Verbose]', ...args);
    }
  }

export { logVerbose };