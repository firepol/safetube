import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { AppPaths } from './appPaths';

// Initialize logger with proper directory creation
function initializeLogger() {
  try {
    // Ensure logs directory exists before configuring logger
    const logsDir = AppPaths.getLogsDir();
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log(`[Logger] Created logs directory: ${logsDir}`);
    }

    // Configure log file location using AppPaths
    const logFilePath = AppPaths.getLogPath('main.log');
    log.transports.file.resolvePathFn = () => logFilePath;

    // Configure log levels
    log.transports.file.level = process.env.NODE_ENV === 'test' ? 'error' : 'info';
    log.transports.console.level = process.env.NODE_ENV === 'test' ? 'error' : 'debug';

    // Configure log format
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    log.transports.console.format = '[{level}] {text}';

    console.log(`[Logger] Configured to write to: ${logFilePath}`);
  } catch (error) {
    console.error('[Logger] Failed to initialize logger:', error);
  }
}

// Initialize logger on module load
initializeLogger();

// Export configured logger
export default log; 