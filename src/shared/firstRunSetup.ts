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
      // Only run setup in production mode
      if (AppPaths.isDev()) {
        console.log('[FirstRunSetup] Development mode - skipping setup');
        return result;
      }

      console.log('[FirstRunSetup] Production mode - checking setup...');

      // Create necessary directories
      await this.createDirectories(result);

      // Copy default config files if they don't exist
      await this.copyDefaultConfigs(result);

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
   * Copy default config files from development config folder
   */
  private static async copyDefaultConfigs(result: SetupResult): Promise<void> {
    // Try config.example directory first (for packaged apps)
    let devConfigDir = path.join(process.cwd(), 'config.example');
    
    // Fallback to config directory (for development builds)
    if (!await this.directoryExists(devConfigDir)) {
      devConfigDir = path.join(process.cwd(), 'config');
    }
    
    const prodConfigDir = AppPaths.getConfigDir();

    // Check if either config directory exists
    if (!await this.directoryExists(devConfigDir)) {
      console.log('[FirstRunSetup] No config directory found, skipping config copy');
      return;
    }

    console.log('[FirstRunSetup] Using config directory:', devConfigDir);

    for (const filename of this.REQUIRED_CONFIG_FILES) {
      const devPath = path.join(devConfigDir, filename);
      const prodPath = path.join(prodConfigDir, filename);

      try {
        // Only copy if source exists and destination doesn't exist
        if (await this.fileExists(devPath) && !(await this.fileExists(prodPath))) {
          await fs.copyFile(devPath, prodPath);
          result.copiedFiles.push(filename);
          console.log('[FirstRunSetup] Copied config file:', filename);
        } else if (await this.fileExists(prodPath)) {
          console.log('[FirstRunSetup] Config file already exists:', filename);
        } else {
          console.log('[FirstRunSetup] Source config file not found:', filename);
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
   * Setup environment file from .env.example
   */
  private static async setupEnvironmentFile(result: SetupResult): Promise<void> {
    // Try multiple possible locations for .env.example
    const possibleEnvExamplePaths = [
      path.join(process.cwd(), '.env.example'),
      path.join(process.cwd(), 'config.example', '.env.example'),
      path.join(process.cwd(), 'config', '.env.example')
    ];

    let envExamplePath: string | null = null;
    for (const path of possibleEnvExamplePaths) {
      if (await this.fileExists(path)) {
        envExamplePath = path;
        break;
      }
    }

    const envPath = path.join(AppPaths.getUserDataDir(), '.env');

    try {
      // Check if .env.example exists anywhere
      if (!envExamplePath) {
        console.log('[FirstRunSetup] .env.example not found, creating minimal .env file');
        
        // Create a minimal .env file with placeholders
        const minimalEnvContent = `# SafeTube Environment Configuration
# Generated automatically - please update with your actual values

# YouTube API Configuration
# Get your API key from: https://console.cloud.google.com/apis/credentials
VITE_YOUTUBE_API_KEY=your_youtube_api_key_here

# Admin Access
# Password for accessing admin features
ADMIN_PASSWORD=your_admin_password_here

# Logging Configuration
# Set to 'true' for verbose logging, 'false' for normal logging
ELECTRON_LOG_VERBOSE=false

# Development Mode
# Set to 'development' for dev mode, any other value for production
NODE_ENV=production
`;
        
        await fs.writeFile(envPath, minimalEnvContent, 'utf8');
        result.copiedFiles.push('.env (generated)');
        console.log('[FirstRunSetup] Created minimal .env file');
        console.log('[FirstRunSetup] IMPORTANT: Please update the .env file with your actual API keys and settings');
        return;
      }

      // Check if .env already exists in production location
      if (await this.fileExists(envPath)) {
        console.log('[FirstRunSetup] .env file already exists in production location');
        return;
      }

      // Copy .env.example to .env in production location
      await fs.copyFile(envExamplePath, envPath);
      result.copiedFiles.push('.env');
      console.log('[FirstRunSetup] Copied .env.example to production location');
      console.log('[FirstRunSetup] Please update the .env file with your actual API keys and settings');

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
      return true;
    } catch {
      return false;
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
