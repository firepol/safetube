// Check if verbose logging is enabled via environment variable
const isVerboseLoggingEnabled = (): boolean => {
  return process.env.ELECTRON_LOG_VERBOSE === 'true';
};

export function logVerbose(msg: string) { 
  if (isVerboseLoggingEnabled()) {
    console.log('[Preload]', msg);
  }
}

// Expose the verbose setting to the renderer process
export const getVerboseLoggingSetting = (): boolean => {
  return isVerboseLoggingEnabled();
}; 