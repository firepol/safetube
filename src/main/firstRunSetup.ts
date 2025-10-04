import { promises as fs } from 'fs';
import * as path from 'path';
import { AppPaths } from './appPaths';
import { logVerbose } from '../shared/logging';

interface SetupResult {
  success: boolean;
  createdDirs: string[];
  copiedFiles: string[];
  errors: string[];
}

/**
 * First-run setup helper that creates necessary directories and copies default config files
 */
export class FirstRunSetup {
  /**
   * Run first-time setup if needed
   */
  static async setupIfNeeded(): Promise<SetupResult> {
    const result: SetupResult = {
      success: true,
      createdDirs: [],
      copiedFiles: [],
      errors: []
    };

    try {
      // Run setup in both development and production modes
      // In development, it will create config files in the project root
      // In production, it will create config files in user data directory

      // Create necessary directories
      await this.createDirectories(result);


    } catch (error) {
      logVerbose('[FirstRunSetup] Error during setup:', error);
      result.errors.push(`Setup failed: ${error}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Create necessary directories
   */
  private static async createDirectories(result: SetupResult): Promise<void> {
    try {
      const logsDir = AppPaths.getLogsDir();

      // Create logs directory
      if (!await this.ensureDirectoryExists(logsDir)) {
        result.createdDirs.push(logsDir);
      }

    } catch (error) {
      logVerbose('[FirstRunSetup] Error creating directories:', error);
      result.errors.push(`Directory creation failed: ${error}`);
    }
  }

  /**
   * Ensure a directory exists, return true if it already existed
   */
  private static async ensureDirectoryExists(dirPath: string): Promise<boolean> {
    try {
      await fs.access(dirPath);
      return true; // Directory already exists
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      return false; // Directory was created
    }
  }
}