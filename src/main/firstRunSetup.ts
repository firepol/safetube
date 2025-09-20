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
  private static readonly REQUIRED_CONFIG_FILES = [
    'timeLimits.json',
    'usageLog.json',
    'videoSources.json',
    'youtubePlayer.json',
    'watched.json',
    'timeExtra.json',
    'pagination.json',
    'mainSettings.json'
  ];

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

    // Copy default config files if they don't exist
    await this.copyDefaultConfigs(result);

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
      const configDir = AppPaths.getConfigDir();
      const cacheDir = AppPaths.getCacheDir();
      const logsDir = AppPaths.getLogsDir();

      // Create config directory
      if (!await this.ensureDirectoryExists(configDir)) {
        result.createdDirs.push(configDir);
      }

      // Create cache directory
      if (!await this.ensureDirectoryExists(cacheDir)) {
        result.createdDirs.push(cacheDir);
      }

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

  /**
   * Copy default config files if they don't exist
   */
  private static async copyDefaultConfigs(result: SetupResult): Promise<void> {
    try {
      const configDir = AppPaths.getConfigDir();
      const exampleConfigDir = path.join(process.cwd(), 'config.example');

      for (const filename of this.REQUIRED_CONFIG_FILES) {
        const targetPath = path.join(configDir, filename);
        const examplePath = path.join(exampleConfigDir, filename);

        try {
          // Check if target file already exists
          await fs.access(targetPath);
          continue; // File already exists, skip
        } catch {
          // Target file doesn't exist, try to copy from example
          try {
            await fs.access(examplePath);
            await fs.copyFile(examplePath, targetPath);
            result.copiedFiles.push(filename);
          } catch {
            // Example file doesn't exist either, create a minimal default
            await this.createDefaultConfigFile(targetPath, filename);
            result.copiedFiles.push(filename);
          }
        }
      }
    } catch (error) {
      logVerbose('[FirstRunSetup] Error copying config files:', error);
      result.errors.push(`Config file setup failed: ${error}`);
    }
  }

  /**
   * Create a minimal default config file
   */
  private static async createDefaultConfigFile(filePath: string, filename: string): Promise<void> {
    let defaultContent: any = {};

    switch (filename) {
      case 'timeLimits.json':
        defaultContent = {
          Monday: 30,
          Tuesday: 30,
          Wednesday: 30,
          Thursday: 30,
          Friday: 45,
          Saturday: 90,
          Sunday: 90,
          warningThresholdMinutes: 3,
          countdownWarningSeconds: 60,
          audioWarningSeconds: 10,
          timeUpMessage: "Time's up for today! Here's your schedule:",
          useSystemBeep: false,
          customBeepSound: ""
        };
        break;
      case 'usageLog.json':
        defaultContent = {};
        break;
      case 'videoSources.json':
        defaultContent = [];
        break;
      case 'youtubePlayer.json':
        defaultContent = {
          autoplay: false,
          volume: 0.8,
          quality: 'auto'
        };
        break;
      case 'watched.json':
        defaultContent = [];
        break;
      case 'timeExtra.json':
        defaultContent = {};
        break;
      case 'pagination.json':
        defaultContent = {
          pageSize: 50,
          maxPages: 10
        };
        break;
      case 'mainSettings.json':
        defaultContent = {
          downloadPath: "",
          youtubeApiKey: "",
          adminPassword: "$2b$10$CD78JZagbb56sj/6SIJfyetZN5hYjICzbPovBm5/1mol2K53bWIWy",
          enableVerboseLogging: false
        };
        break;
    }

    await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
  }

  /**
   * Get setup status
   */
  static async getSetupStatus(): Promise<{ isSetup: boolean; missingFiles: string[] }> {
    const configDir = AppPaths.getConfigDir();
    const missingFiles: string[] = [];

    for (const filename of this.REQUIRED_CONFIG_FILES) {
      const filePath = path.join(configDir, filename);
      try {
        await fs.access(filePath);
      } catch {
        missingFiles.push(filename);
      }
    }

    return {
      isSetup: missingFiles.length === 0,
      missingFiles
    };
  }
}