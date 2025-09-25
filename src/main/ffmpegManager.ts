import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logVerbose } from '../shared/logging';

const execAsync = promisify(exec);

export class FFmpegManager {
  private static ffmpegPath: string | null = null;
  private static ffprobePath: string | null = null;
  private static isAvailable: boolean | null = null;

  /**
   * Get the path to ffmpeg executable
   */
  static getFFmpegPath(): string {
    if (this.ffmpegPath) {
      return this.ffmpegPath;
    }

    const platform = process.platform;
    let executableName: string;

    switch (platform) {
      case 'win32':
        executableName = 'ffmpeg.exe';
        break;
      case 'darwin':
      case 'linux':
        executableName = 'ffmpeg';
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // Look for ffmpeg in the project root
    const projectRoot = process.cwd();
    const ffmpegPath = path.join(projectRoot, executableName);

    this.ffmpegPath = ffmpegPath;
    return ffmpegPath;
  }

  /**
   * Get the path to ffprobe executable
   */
  static getFFprobePath(): string {
    if (this.ffprobePath) {
      return this.ffprobePath;
    }

    const platform = process.platform;
    let executableName: string;

    switch (platform) {
      case 'win32':
        executableName = 'ffprobe.exe';
        break;
      case 'darwin':
      case 'linux':
        executableName = 'ffprobe';
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // Look for ffprobe in the project root
    const projectRoot = process.cwd();
    const ffprobePath = path.join(projectRoot, executableName);

    this.ffprobePath = ffprobePath;
    return ffprobePath;
  }

  /**
   * Check if ffmpeg is available in system PATH
   */
  static async isSystemFFmpegAvailable(): Promise<boolean> {
    try {
      // Try to run ffmpeg -version to check if it's available in PATH
      const { stdout } = await execAsync('ffmpeg -version');
      logVerbose(`[FFmpegManager] System ffmpeg found, version info: ${stdout.split('\n')[0]}`);
      return true;
    } catch (error) {
      logVerbose(`[FFmpegManager] System ffmpeg not found in PATH: ${error}`);
      return false;
    }
  }

  /**
   * Check if ffprobe is available in system PATH
   */
  static async isSystemFFprobeAvailable(): Promise<boolean> {
    try {
      // Try to run ffprobe -version to check if it's available in PATH
      const { stdout } = await execAsync('ffprobe -version');
      logVerbose(`[FFmpegManager] System ffprobe found, version info: ${stdout.split('\n')[0]}`);
      return true;
    } catch (error) {
      logVerbose(`[FFmpegManager] System ffprobe not found in PATH: ${error}`);
      return false;
    }
  }

  /**
   * Check if both ffmpeg and ffprobe are available (system first, then local)
   */
  static async isFFmpegAvailable(): Promise<boolean> {
    if (this.isAvailable !== null) {
      return this.isAvailable;
    }

    // First check if ffmpeg and ffprobe are available in system PATH
    const systemFFmpegAvailable = await this.isSystemFFmpegAvailable();
    const systemFFprobeAvailable = await this.isSystemFFprobeAvailable();

    if (systemFFmpegAvailable && systemFFprobeAvailable) {
      this.ffmpegPath = 'ffmpeg'; // Use system command
      this.ffprobePath = 'ffprobe'; // Use system command
      this.isAvailable = true;
      return true;
    }

    // If not in system PATH, check local project directory
    try {
      const ffmpegPath = this.getFFmpegPath();
      const ffprobePath = this.getFFprobePath();

      await fs.promises.access(ffmpegPath, fs.constants.F_OK);
      await fs.promises.access(ffprobePath, fs.constants.F_OK);

      // Also check if they're executable on Unix systems
      if (process.platform !== 'win32') {
        const ffmpegStats = await fs.promises.stat(ffmpegPath);
        const ffprobeStats = await fs.promises.stat(ffprobePath);

        const ffmpegExecutable = ffmpegStats.mode & parseInt('111', 8);
        const ffprobeExecutable = ffprobeStats.mode & parseInt('111', 8);

        this.isAvailable = ffmpegExecutable && ffprobeExecutable ? true : false;
      } else {
        this.isAvailable = true;
      }

      logVerbose(`[FFmpegManager] Local ffmpeg found at: ${ffmpegPath}`);
      logVerbose(`[FFmpegManager] Local ffprobe found at: ${ffprobePath}`);
      return this.isAvailable;
    } catch (error) {
      logVerbose(`[FFmpegManager] Local ffmpeg/ffprobe not found: ${error}`);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Ensure ffmpeg and ffprobe are available, download if needed (Windows only)
   */
  static async ensureFFmpegAvailable(): Promise<void> {
    const isAvailable = await this.isFFmpegAvailable();

    if (isAvailable) {
      if (this.ffmpegPath === 'ffmpeg') {
        logVerbose('[FFmpegManager] Using system ffmpeg from PATH');
      } else {
        logVerbose('[FFmpegManager] Using local ffmpeg');
      }
      return;
    }

    // Only auto-download on Windows
    if (process.platform !== 'win32') {
      throw new Error('FFmpeg not found. Please install ffmpeg and ffprobe manually on this platform.');
    }

    logVerbose('[FFmpegManager] FFmpeg not available, downloading...');
    await this.downloadFFmpeg();
  }

  /**
   * Download ffmpeg and ffprobe executables (Windows only)
   */
  private static async downloadFFmpeg(): Promise<void> {
    if (process.platform !== 'win32') {
      throw new Error('Automatic FFmpeg download is only supported on Windows');
    }

    const ffmpegPath = this.getFFmpegPath();
    const ffprobePath = this.getFFprobePath();

    try {
      // Use GitHub releases from BtbN/FFmpeg-Builds (Windows static builds)
      const baseUrl = 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download';
      const zipUrl = `${baseUrl}/ffmpeg-master-latest-win64-gpl.zip`;

      logVerbose(`[FFmpegManager] Downloading ffmpeg from: ${zipUrl}`);

      // Download and extract ffmpeg zip file
      const tempDir = path.join(process.cwd(), 'temp-ffmpeg');
      const zipPath = path.join(tempDir, 'ffmpeg.zip');

      // Create temp directory
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Download zip file
      const curlCommand = `curl -L -o "${zipPath}" "${zipUrl}"`;
      await execAsync(curlCommand);

      // Extract zip file (Windows has built-in powershell expand-archive)
      const extractCommand = `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`;
      await execAsync(extractCommand);

      // Find the extracted bin directory (it will be in a subdirectory)
      const extractedDir = await fs.promises.readdir(tempDir);
      const ffmpegDir = extractedDir.find(dir => dir.startsWith('ffmpeg-') && dir !== 'ffmpeg.zip');

      if (!ffmpegDir) {
        throw new Error('Could not find extracted ffmpeg directory');
      }

      const binPath = path.join(tempDir, ffmpegDir, 'bin');
      const extractedFFmpegPath = path.join(binPath, 'ffmpeg.exe');
      const extractedFFprobePath = path.join(binPath, 'ffprobe.exe');

      // Copy executables to project root
      await fs.promises.copyFile(extractedFFmpegPath, ffmpegPath);
      await fs.promises.copyFile(extractedFFprobePath, ffprobePath);

      // Cleanup temp directory
      await fs.promises.rm(tempDir, { recursive: true, force: true });

      // Verify downloads
      await fs.promises.access(ffmpegPath, fs.constants.F_OK);
      await fs.promises.access(ffprobePath, fs.constants.F_OK);

      this.isAvailable = true;
      logVerbose('[FFmpegManager] FFmpeg and FFprobe downloaded successfully');

    } catch (error) {
      logVerbose(`[FFmpegManager] Failed to download ffmpeg: ${error}`);
      throw new Error(`Failed to download ffmpeg: ${error}`);
    }
  }

  /**
   * Get ffmpeg command with proper path
   */
  static getFFmpegCommand(): string {
    // If we're using system ffmpeg, just return the command name
    if (this.ffmpegPath === 'ffmpeg') {
      return 'ffmpeg';
    }

    const ffmpegPath = this.getFFmpegPath();

    // On Windows, we might need to use the full path with quotes
    if (process.platform === 'win32') {
      return `"${ffmpegPath}"`;
    }

    return ffmpegPath;
  }

  /**
   * Get ffprobe command with proper path
   */
  static getFFprobeCommand(): string {
    // If we're using system ffprobe, just return the command name
    if (this.ffprobePath === 'ffprobe') {
      return 'ffprobe';
    }

    const ffprobePath = this.getFFprobePath();

    // On Windows, we might need to use the full path with quotes
    if (process.platform === 'win32') {
      return `"${ffprobePath}"`;
    }

    return ffprobePath;
  }

  /**
   * Get ffmpeg version
   */
  static async getFFmpegVersion(): Promise<string> {
    try {
      await this.ensureFFmpegAvailable();
      const command = `${this.getFFmpegCommand()} -version`;
      const { stdout } = await execAsync(command);
      // Extract version from first line (format: "ffmpeg version X.X.X ...")
      const versionLine = stdout.split('\n')[0];
      const versionMatch = versionLine.match(/ffmpeg version (\S+)/);
      return versionMatch ? versionMatch[1] : 'unknown';
    } catch (error) {
      logVerbose(`[FFmpegManager] Failed to get ffmpeg version: ${error}`);
      return 'unknown';
    }
  }

  /**
   * Get ffprobe version
   */
  static async getFFprobeVersion(): Promise<string> {
    try {
      await this.ensureFFmpegAvailable();
      const command = `${this.getFFprobeCommand()} -version`;
      const { stdout } = await execAsync(command);
      // Extract version from first line (format: "ffprobe version X.X.X ...")
      const versionLine = stdout.split('\n')[0];
      const versionMatch = versionLine.match(/ffprobe version (\S+)/);
      return versionMatch ? versionMatch[1] : 'unknown';
    } catch (error) {
      logVerbose(`[FFmpegManager] Failed to get ffprobe version: ${error}`);
      return 'unknown';
    }
  }
}