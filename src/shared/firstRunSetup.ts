import { promises as fs } from 'fs';
import * as path from 'path';
import { AppPaths } from './appPaths';

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
    'pagination.json'
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
      console.log('[FirstRunSetup] Checking setup...');

      // Create necessary directories
      await this.createDirectories(result);

    // Copy default config files if they don't exist
    console.log('[FirstRunSetup] About to call copyDefaultConfigs...');
    await this.copyDefaultConfigs(result);
    console.log('[FirstRunSetup] copyDefaultConfigs completed');

      // Copy .env.example to .env if .env doesn't exist
      await this.setupEnvironmentFile(result);

      console.log('[FirstRunSetup] Setup completed successfully');
      return result;

    } catch (error) {
      const errorMsg = `Setup failed: ${error}`;
      console.error('[FirstRunSetup]', errorMsg);
      result.success = false;
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Create necessary directories
   */
  private static async createDirectories(result: SetupResult): Promise<void> {
    const dirs = [
      AppPaths.getConfigDir(),
      AppPaths.getCacheDir(),
      AppPaths.getLogsDir()
    ];

    for (const dir of dirs) {
      try {
        // Check if directory already exists
        if (await this.directoryExists(dir)) {
          continue;
        }
        
        await fs.mkdir(dir, { recursive: true });
        result.createdDirs.push(dir);
        console.log('[FirstRunSetup] Created directory:', dir);
      } catch (error) {
        const errorMsg = `Failed to create directory ${dir}: ${error}`;
        console.error('[FirstRunSetup]', errorMsg);
        result.errors.push(errorMsg);
        result.success = false;
      }
    }
  }

  /**
   * Copy default config files from development config folder or create minimal ones
   */
  private static async copyDefaultConfigs(result: SetupResult): Promise<void> {
    const prodConfigDir = AppPaths.getConfigDir();
    
    // For packaged apps, we need to look in the app.asar or use bundled configs
    // For development, look in the source config.example directory
    let devConfigDir: string | null = null;
    
    // Try multiple possible locations for config files
    const possibleConfigDirs = [
      path.join(process.cwd(), 'config'),                   // Development fallback
      path.join(__dirname, '../../../config'),              // Packaged app fallback
      path.join(process.resourcesPath, 'config')            // Packaged app resources fallback
    ];

    for (const configDir of possibleConfigDirs) {
      if (await this.directoryExists(configDir)) {
        devConfigDir = configDir;
        break;
      }
    }

    // If no config directory found, create minimal configs (they will check if files exist)
    if (!devConfigDir) {
      console.log('[FirstRunSetup] No config directory found, creating minimal config files');
      await this.createMinimalConfigs(result, prodConfigDir);
      return;
    }

    console.log('[FirstRunSetup] Using config directory:', devConfigDir);

    for (const filename of this.REQUIRED_CONFIG_FILES) {
      const devPath = path.join(devConfigDir, filename);
      const prodPath = path.join(prodConfigDir, filename);

      try {
        const devExists = await this.fileExists(devPath);
        const prodExists = await this.fileExists(prodPath);
        
        console.log(`[FirstRunSetup] ${filename}: dev=${devExists}, prod=${prodExists}`);
        console.log(`[FirstRunSetup] ${filename}: devPath=${devPath}, prodPath=${prodPath}`);
        
        // Only copy if source exists and destination doesn't exist
        if (devExists && !prodExists) {
          await fs.copyFile(devPath, prodPath);
          result.copiedFiles.push(filename);
          console.log('[FirstRunSetup] Copied config file:', filename);
        } else if (prodExists) {
          console.log('[FirstRunSetup] Config file already exists, skipping:', filename);
        } else if (devExists) {
          // Source exists but destination doesn't - this shouldn't happen in normal operation
          console.log('[FirstRunSetup] Source exists but destination missing, copying:', filename);
          await fs.copyFile(devPath, prodPath);
          result.copiedFiles.push(filename);
        } else {
          console.log('[FirstRunSetup] Source config file not found, creating minimal:', filename);
          await this.createMinimalConfigFile(filename, prodPath, result);
        }
      } catch (error) {
        const errorMsg = `Failed to copy ${filename}: ${error}`;
        console.error('[FirstRunSetup]', errorMsg);
        result.errors.push(errorMsg);
        result.success = false;
      }
    }
  }

  /**
   * Setup environment file from .env.example or create with default values
   */
  private static async setupEnvironmentFile(result: SetupResult): Promise<void> {
    const envPath = path.join(AppPaths.getUserDataDir(), '.env');

    // Check if .env already exists
    if (await this.fileExists(envPath)) {
      console.log('[FirstRunSetup] .env file already exists, skipping');
      return;
    }

    // Create .env file with default values
    const defaultEnvContent = `VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
ADMIN_PASSWORD=paren234`;
    
    try {
      await fs.writeFile(envPath, defaultEnvContent, 'utf8');
      result.copiedFiles.push('.env');
      console.log('[FirstRunSetup] Created .env file with default values');
      
      console.log('[FirstRunSetup] IMPORTANT: Please update the .env file with your actual API keys and settings');

    } catch (error) {
      const errorMsg = `Failed to setup environment file: ${error}`;
      console.error('[FirstRunSetup]', errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }
  }

  /**
   * Check if a directory exists
   */
  private static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if a file exists
   */
  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      console.log(`[FirstRunSetup] fileExists: ${filePath} -> true`);
      return true;
    } catch (error) {
      console.log(`[FirstRunSetup] fileExists: ${filePath} -> false (${error})`);
      return false;
    }
  }

  /**
   * Create minimal config files when source configs are not available
   */
  private static async createMinimalConfigs(result: SetupResult, configDir: string): Promise<void> {
    for (const filename of this.REQUIRED_CONFIG_FILES) {
      const filePath = path.join(configDir, filename);
      await this.createMinimalConfigFile(filename, filePath, result);
    }
  }

  /**
   * Create a minimal config file
   */
  private static async createMinimalConfigFile(filename: string, filePath: string, result: SetupResult): Promise<void> {
    console.log(`[FirstRunSetup] createMinimalConfigFile called for: ${filename} at ${filePath}`);
    
    // Check if file already exists
    if (await this.fileExists(filePath)) {
      console.log(`[FirstRunSetup] File already exists, skipping: ${filename}`);
      return;
    }
    
    try {
      let content: string;

      switch (filename) {
        case 'videoSources.json':
          content = JSON.stringify([
            {
              "id": "local1",
              "type": "local",
              "path": "C:\\Users\\Public\\Videos",
              "title": "Local Videos",
              "sortOrder": "alphabetical",
              "maxDepth": 2
            }
          ], null, 2);
          break;

        case 'timeLimits.json':
          content = JSON.stringify({
            "Monday": 60,
            "Tuesday": 60,
            "Wednesday": 60,
            "Thursday": 60,
            "Friday": 60,
            "Saturday": 120,
            "Sunday": 120,
            "timeUpMessage": "Time's up for today!"
          }, null, 2);
          break;

        case 'usageLog.json':
          content = JSON.stringify({}, null, 2);
          break;

        case 'youtubePlayer.json':
          content = JSON.stringify({
            "youtubePlayerType": "iframe",
            "youtubePlayerConfig": {
              "iframe": {
                "showRelatedVideos": false,
                "customEndScreen": true,
                "qualityControls": true,
                "autoplay": true,
                "controls": true
              },
              "mediasource": {
                "maxQuality": "1080p",
                "preferredLanguages": ["en"],
                "fallbackToLowerQuality": true
              }
            }
          }, null, 2);
          break;

        case 'watched.json':
          content = JSON.stringify([], null, 2);
          break;

        case 'timeExtra.json':
          content = JSON.stringify({}, null, 2);
          break;

        case 'pagination.json':
          content = JSON.stringify({
            "pageSize": 50,
            "cacheDurationMinutes": 30
          }, null, 2);
          break;

        default:
          content = JSON.stringify({}, null, 2);
      }

      await fs.writeFile(filePath, content, 'utf8');
      result.copiedFiles.push(filename);
      console.log(`[FirstRunSetup] Created minimal config file: ${filename}`);
    } catch (error) {
      const errorMsg = `Failed to create minimal config file ${filename}: ${error}`;
      console.error('[FirstRunSetup]', errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }
  }

  /**
   * Get setup status for debugging
   */
  static async getSetupStatus(): Promise<{
    isDev: boolean;
    configDir: string;
    configFiles: { [key: string]: boolean };
    envFile: boolean;
  }> {
    const configDir = AppPaths.getConfigDir();
    const configFiles: { [key: string]: boolean } = {};
    const envFile = await this.fileExists(path.join(AppPaths.getUserDataDir(), '.env'));

    for (const filename of this.REQUIRED_CONFIG_FILES) {
      configFiles[filename] = await this.fileExists(path.join(configDir, filename));
    }

    return {
      isDev: AppPaths.isDev(),
      configDir,
      configFiles,
      envFile
    };
  }
}
