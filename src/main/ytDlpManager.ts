import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { AppPaths } from './appPaths';
import { logVerbose } from '../shared/logging';

const execAsync = promisify(exec);

export class YtDlpManager {
  private static ytDlpPath: string | null = null;
  private static isAvailable: boolean | null = null;

  /**
   * Get the path to yt-dlp executable
   */
  static getYtDlpPath(): string {
    if (this.ytDlpPath) {
      return this.ytDlpPath;
    }

    const platform = process.platform;
    let executableName: string;

    switch (platform) {
      case 'win32':
        executableName = 'yt-dlp.exe';
        break;
      case 'darwin':
      case 'linux':
        executableName = 'yt-dlp';
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // Look for yt-dlp in the project root
    const projectRoot = process.cwd();
    const ytDlpPath = path.join(projectRoot, executableName);

    this.ytDlpPath = ytDlpPath;
    return ytDlpPath;
  }

  /**
   * Check if yt-dlp is available in system PATH
   */
  static async isSystemYtDlpAvailable(): Promise<boolean> {
    try {
      // Try to run yt-dlp --version to check if it's available in PATH
      const { stdout } = await execAsync('yt-dlp --version');
      logVerbose(`[YtDlpManager] System yt-dlp found, version: ${stdout.trim()}`);
      return true;
    } catch (error) {
      logVerbose(`[YtDlpManager] System yt-dlp not found in PATH: ${error}`);
      return false;
    }
  }

  /**
   * Check if yt-dlp is available (system first, then local)
   */
  static async isYtDlpAvailable(): Promise<boolean> {
    if (this.isAvailable !== null) {
      return this.isAvailable;
    }

    // First check if yt-dlp is available in system PATH
    const systemAvailable = await this.isSystemYtDlpAvailable();
    if (systemAvailable) {
      this.ytDlpPath = 'yt-dlp'; // Use system command
      this.isAvailable = true;
      return true;
    }

    // If not in system PATH, check local project directory
    try {
      const ytDlpPath = this.getYtDlpPath();
      await fs.promises.access(ytDlpPath, fs.constants.F_OK);

      // Also check if it's executable
      const stats = await fs.promises.stat(ytDlpPath);
      this.isAvailable = stats.mode & parseInt('111', 8) ? true : false;

      logVerbose(`[YtDlpManager] Local yt-dlp found at: ${ytDlpPath}`);
      return this.isAvailable;
    } catch (error) {
      logVerbose(`[YtDlpManager] Local yt-dlp not found: ${error}`);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Ensure yt-dlp is available, download if needed
   */
  static async ensureYtDlpAvailable(): Promise<void> {
    const isAvailable = await this.isYtDlpAvailable();

    if (isAvailable) {
      if (this.ytDlpPath === 'yt-dlp') {
        logVerbose('[YtDlpManager] Using system yt-dlp from PATH');
      } else {
        logVerbose('[YtDlpManager] Using local yt-dlp');
      }
      return;
    }

    logVerbose('[YtDlpManager] yt-dlp not available, downloading...');
    await this.downloadYtDlp();
  }

  /**
   * Download yt-dlp executable
   */
  private static async downloadYtDlp(): Promise<void> {
    const platform = process.platform;
    const ytDlpPath = this.getYtDlpPath();

    try {
      let downloadUrl: string;

      switch (platform) {
        case 'win32':
          downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
          break;
        case 'darwin':
        case 'linux':
          downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      logVerbose(`[YtDlpManager] Downloading yt-dlp from: ${downloadUrl}`);

      // Use curl to download (available on most systems)
      const curlCommand = `curl -L -o "${ytDlpPath}" "${downloadUrl}"`;
      await execAsync(curlCommand);

      // Make executable on Unix systems
      if (platform !== 'win32') {
        await execAsync(`chmod +x "${ytDlpPath}"`);
      }

      // Verify download
      await fs.promises.access(ytDlpPath, fs.constants.F_OK);

      this.isAvailable = true;
      logVerbose('[YtDlpManager] yt-dlp downloaded successfully');

    } catch (error) {
      logVerbose(`[YtDlpManager] Failed to download yt-dlp: ${error}`);
      throw new Error(`Failed to download yt-dlp: ${error}`);
    }
  }

  /**
   * Get yt-dlp command with proper path
   */
  static getYtDlpCommand(): string {
    // If we're using system yt-dlp, just return the command name
    if (this.ytDlpPath === 'yt-dlp') {
      return 'yt-dlp';
    }

    const ytDlpPath = this.getYtDlpPath();

    // On Windows, we might need to use the full path
    if (process.platform === 'win32') {
      return `"${ytDlpPath}"`;
    }

    return ytDlpPath;
  }

  /**
   * Get yt-dlp version
   */
  static async getVersion(): Promise<string> {
    try {
      await this.ensureYtDlpAvailable();
      const command = `${this.getYtDlpCommand()} --version`;
      const { stdout } = await execAsync(command);
      return stdout.trim();
    } catch (error) {
      logVerbose(`[YtDlpManager] Failed to get yt-dlp version: ${error}`);
      return 'unknown';
    }
  }
}
