import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { AppPaths } from './appPaths';
import { logVerbose } from './logging';

const execAsync = promisify(exec);

export class YtDlpManager {
  private static readonly YT_DLP_FILENAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  private static readonly YT_DLP_DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';

  /**
   * Get the path where yt-dlp should be located
   */
  static getYtDlpPath(): string {
    if (AppPaths.isDev()) {
      // In development, look in project root
      return path.join(process.cwd(), this.YT_DLP_FILENAME);
    } else {
      // In production, look in user data directory
      return path.join(AppPaths.getUserDataDir(), this.YT_DLP_FILENAME);
    }
  }

  /**
   * Check if yt-dlp is available and working
   */
  static async isYtDlpAvailable(): Promise<boolean> {
    try {
      const ytDlpPath = this.getYtDlpPath();
      
      // Check if file exists
      if (!fs.existsSync(ytDlpPath)) {
        logVerbose(`yt-dlp not found at ${ytDlpPath}`);
        return false;
      }

      // Check if it's executable by running --version
      const { stdout } = await execAsync(`"${ytDlpPath}" --version`);
      logVerbose(`yt-dlp version: ${stdout.trim()}`);
      return true;
    } catch (error) {
      logVerbose(`yt-dlp check failed: ${error}`);
      return false;
    }
  }

  /**
   * Download yt-dlp.exe (Windows only)
   */
  static async downloadYtDlp(): Promise<boolean> {
    if (process.platform !== 'win32') {
      throw new Error('Auto-download is only supported on Windows');
    }

    try {
      const ytDlpPath = this.getYtDlpPath();
      const ytDlpDir = path.dirname(ytDlpPath);

      // Ensure directory exists
      if (!fs.existsSync(ytDlpDir)) {
        fs.mkdirSync(ytDlpDir, { recursive: true });
      }

      logVerbose(`Downloading yt-dlp.exe to ${ytDlpPath}...`);

      // Use PowerShell to download the file
      const downloadCommand = `
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri "${this.YT_DLP_DOWNLOAD_URL}" -OutFile "${ytDlpPath}"
      `;

      await execAsync(`powershell -Command "${downloadCommand}"`);

      // Verify the download
      if (fs.existsSync(ytDlpPath)) {
        logVerbose(`yt-dlp.exe downloaded successfully to ${ytDlpPath}`);
        return true;
      } else {
        logVerbose('yt-dlp.exe download failed - file not found after download');
        return false;
      }
    } catch (error) {
      logVerbose(`Failed to download yt-dlp.exe: ${error}`);
      return false;
    }
  }

  /**
   * Ensure yt-dlp is available, downloading it if necessary (Windows only)
   */
  static async ensureYtDlpAvailable(): Promise<boolean> {
    // Check if already available
    if (await this.isYtDlpAvailable()) {
      return true;
    }

    // On Windows, try to download it
    if (process.platform === 'win32') {
      logVerbose('yt-dlp not found, attempting to download...');
      return await this.downloadYtDlp();
    }

    // On other platforms, throw an error
    throw new Error(
      `yt-dlp is required but not found at ${this.getYtDlpPath()}. ` +
      `Please install yt-dlp manually: https://github.com/yt-dlp/yt-dlp#installation`
    );
  }

  /**
   * Get the command to run yt-dlp
   */
  static getYtDlpCommand(): string {
    return `"${this.getYtDlpPath()}"`;
  }
}
