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
   * Get the appropriate data directory (for database files)
   */
  static getDataDir(): string {
    if (this.isDev()) {
      // In development, use project root data folder
      return path.join(process.cwd(), 'data');
    } else {
      // In production, use user data directory
      return path.join(app.getPath('userData'), 'data');
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

  /**
   * Get the appropriate data file path
   */
  static getDataPath(filename: string): string {
    // Special handling for database file in development
    if (this.isDev() && filename === 'safetube.db') {
      // In development, place database in project root (same as README.md)
      return path.join(process.cwd(), filename);
    }
    return path.join(this.getDataDir(), filename);
  }
}
