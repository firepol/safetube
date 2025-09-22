import { app } from 'electron';
import * as path from 'path';
import * as os from 'os';

export class AppPaths {
  /**
   * Get the appropriate config directory based on environment
   */
  static getConfigDir(): string {
    const isDev = this.isDev();
    const userDataPath = app.getPath('userData');

    if (isDev) {
      // In development, use project root config folder
      return path.join(process.cwd(), 'config');
    } else {
      // In production, use user data directory
      return path.join(userDataPath, 'config');
    }
  }

  /**
   * Get the appropriate cache directory
   * Windows uses .cache subdirectory to avoid conflicts with Electron's built-in Cache folder
   */
  static getCacheDir(): string {
    const isDev = this.isDev();
    const platform = os.platform();
    const userDataPath = app.getPath('userData');

    if (isDev) {
      // In development, use project root cache folder
      return path.join(process.cwd(), 'cache');
    } else {
      // In production, use user data directory
      const isWindows = platform === 'win32';

      if (isWindows) {
        // On Windows, use .cache to avoid conflicts with Electron's Cache folder
        return path.join(userDataPath, '.cache');
      } else {
        // On Linux/macOS, use cache as before
        return path.join(userDataPath, 'cache');
      }
    }
  }

  /**
   * Get the appropriate logs directory
   */
  static getLogsDir(): string {
    if (this.isDev()) {
      // In development, use project root logs folder
      return path.join(process.cwd(), 'logs');
    } else {
      // In production, use user data directory
      return path.join(app.getPath('userData'), 'logs');
    }
  }

  /**
   * Get the appropriate thumbnails directory
   */
  static getThumbnailsDir(): string {
    if (this.isDev()) {
      // In development, use project root thumbnails folder
      return path.join(process.cwd(), 'thumbnails');
    } else {
      // In production, use user data directory
      return path.join(app.getPath('userData'), 'thumbnails');
    }
  }

  /**
   * Get the user data directory (always Electron's user data path)
   */
  static getUserDataDir(): string {
    return app.getPath('userData');
  }

  /**
   * Check if running in development mode
   */
  static isDev(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Get the appropriate config file path
   */
  static getConfigPath(filename: string): string {
    return path.join(this.getConfigDir(), filename);
  }

  /**
   * Get the appropriate cache file path
   */
  static getCachePath(filename: string): string {
    return path.join(this.getCacheDir(), filename);
  }

  /**
   * Get the appropriate log file path
   */
  static getLogPath(filename: string): string {
    return path.join(this.getLogsDir(), filename);
  }

  /**
   * Get the appropriate thumbnail file path
   */
  static getThumbnailPath(filename: string): string {
    return path.join(this.getThumbnailsDir(), filename);
  }
}
