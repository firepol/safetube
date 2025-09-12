import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

// Conversion status tracking
interface ConversionStatus {
  status: 'idle' | 'converting' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  startTime?: number;
}

const conversionStatuses = new Map<string, ConversionStatus>();

// List of codecs that are NOT supported by modern browsers/Electron
const UNSUPPORTED_CODECS = [
  'mpeg4', // XVID, DivX, etc.
  'msmpeg4v1',
  'msmpeg4v2', 
  'msmpeg4v3',
  'wmv1',
  'wmv2',
  'wmv3',
  'flv1',
  'h263',
  'h263p',
  'theora',
  'rv10',
  'rv20',
  'rv30',
  'rv40'
];

// List of codecs that ARE supported by modern browsers/Electron
const SUPPORTED_CODECS = [
  'h264',
  'h265', 
  'hevc',
  'vp8',
  'vp9',
  'av1',
  'avc1'
];

export interface VideoCodecInfo {
  videoCodec: string;
  audioCodec: string;
  isSupported: boolean;
  needsConversion: boolean;
  duration: number;
  width: number;
  height: number;
  bitrate: number;
}

/**
 * Extract video codec information using ffprobe
 */
export async function getVideoCodecInfo(filePath: string): Promise<VideoCodecInfo> {
  try {
    const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    const { stdout } = await execAsync(command);
    const data = JSON.parse(stdout);

    let videoCodec = '';
    let audioCodec = '';
    let duration = 0;
    let width = 0;
    let height = 0;
    let bitrate = 0;

    // Extract video stream info
    const videoStream = data.streams.find((stream: any) => stream.codec_type === 'video');
    if (videoStream) {
      videoCodec = videoStream.codec_name || '';
      width = videoStream.width || 0;
      height = videoStream.height || 0;
    }

    // Extract audio stream info
    const audioStream = data.streams.find((stream: any) => stream.codec_type === 'audio');
    if (audioStream) {
      audioCodec = audioStream.codec_name || '';
    }

    // Extract duration and bitrate from format
    if (data.format) {
      duration = parseFloat(data.format.duration) || 0;
      bitrate = parseInt(data.format.bit_rate) || 0;
    }

    const isSupported = SUPPORTED_CODECS.includes(videoCodec.toLowerCase());
    const needsConversion = UNSUPPORTED_CODECS.includes(videoCodec.toLowerCase()) || !isSupported;

    return {
      videoCodec,
      audioCodec,
      isSupported,
      needsConversion,
      duration,
      width,
      height,
      bitrate
    };
  } catch (error) {
    console.error('Error getting video codec info:', error);
    throw new Error(`Failed to analyze video codec: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert video to a browser-compatible format using ffmpeg
 */
export async function convertVideoToCompatibleFormat(
  inputPath: string, 
  outputPath: string,
  options: {
    quality?: 'low' | 'medium' | 'high';
    preserveAudio?: boolean;
  } = {}
): Promise<string> {
  try {
    const { quality = 'medium', preserveAudio = true } = options;
    
    // Quality settings
    const qualitySettings = {
      low: { crf: 28, preset: 'fast' },
      medium: { crf: 23, preset: 'medium' },
      high: { crf: 18, preset: 'slow' }
    };

    const settings = qualitySettings[quality];
    
    // Build ffmpeg command
    let command = `ffmpeg -i "${inputPath}" -c:v libx264 -crf ${settings.crf} -preset ${settings.preset}`;
    
    if (preserveAudio) {
      command += ' -c:a aac -b:a 128k';
    } else {
      command += ' -an'; // No audio
    }
    
    command += ` "${outputPath}" -y`; // -y to overwrite output file

    console.log('Converting video with command:', command);
    
    const { stdout, stderr } = await execAsync(command);
    console.log('FFmpeg output:', stdout);
    if (stderr) console.log('FFmpeg stderr:', stderr);

    // Verify output file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('Conversion failed - output file was not created');
    }

    return outputPath;
  } catch (error) {
    console.error('Error converting video:', error);
    throw new Error(`Video conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the expected path for a converted video (without actually converting)
 */
export function getConvertedVideoPath(
  originalPath: string,
  cacheDir?: string
): string {
  const cacheDirectory = cacheDir || path.join(path.dirname(originalPath), '.converted');
  const originalExt = path.extname(originalPath);
  const originalName = path.basename(originalPath);
  const outputPath = path.join(cacheDirectory, `${originalName}.mp4`);
  return outputPath;
}

/**
 * Check if a converted video already exists
 */
export async function hasConvertedVideo(
  originalPath: string,
  cacheDir?: string
): Promise<boolean> {
  const convertedPath = getConvertedVideoPath(originalPath, cacheDir);
  return fs.existsSync(convertedPath);
}

/**
 * Get a converted video path if it exists, or return null if not
 */
export async function getExistingConvertedVideoPath(
  originalPath: string,
  cacheDir?: string
): Promise<string | null> {
  const convertedPath = getConvertedVideoPath(originalPath, cacheDir);
  if (fs.existsSync(convertedPath)) {
    return convertedPath;
  }
  return null;
}

/**
 * Check if a video file needs conversion
 */
export async function needsVideoConversion(filePath: string): Promise<boolean> {
  try {
    const codecInfo = await getVideoCodecInfo(filePath);
    return codecInfo.needsConversion;
  } catch (error) {
    console.error('Error checking if video needs conversion:', error);
    return false; // Assume it doesn't need conversion if we can't determine
  }
}

/**
 * Get conversion status for a video
 */
export function getConversionStatus(filePath: string): ConversionStatus {
  return conversionStatuses.get(filePath) || { status: 'idle' };
}

/**
 * Set conversion status for a video
 */
function setConversionStatus(filePath: string, status: ConversionStatus): void {
  conversionStatuses.set(filePath, status);
}

/**
 * Start video conversion in background
 */
export async function startVideoConversion(
  originalPath: string,
  options: {
    quality?: 'low' | 'medium' | 'high';
    preserveAudio?: boolean;
    cacheDir?: string;
  } = {}
): Promise<void> {
  const { quality = 'medium', preserveAudio = true, cacheDir } = options;
  
  // Check if already converting
  const currentStatus = getConversionStatus(originalPath);
  if (currentStatus.status === 'converting') {
    throw new Error('Video is already being converted');
  }
  
  // Check if already converted
  const convertedPath = getConvertedVideoPath(originalPath, cacheDir);
  if (fs.existsSync(convertedPath)) {
    setConversionStatus(originalPath, { status: 'completed' });
    return;
  }
  
  // Determine cache directory
  const cacheDirectory = cacheDir || path.join(path.dirname(originalPath), '.converted');
  
  // Create cache directory if it doesn't exist
  if (!fs.existsSync(cacheDirectory)) {
    fs.mkdirSync(cacheDirectory, { recursive: true });
  }
  
  // Set status to converting
  setConversionStatus(originalPath, {
    status: 'converting',
    progress: 0,
    startTime: Date.now()
  });
  
  try {
    // Quality settings
    const qualitySettings = {
      low: { crf: 28, preset: 'fast' },
      medium: { crf: 23, preset: 'medium' },
      high: { crf: 18, preset: 'slow' }
    };

    const settings = qualitySettings[quality];
    
    // Build ffmpeg command with progress reporting
    let command = `ffmpeg -i "${originalPath}" -c:v libx264 -crf ${settings.crf} -preset ${settings.preset}`;
    
    if (preserveAudio) {
      command += ' -c:a aac -b:a 128k';
    } else {
      command += ' -an';
    }
    
    command += ` "${convertedPath}" -y`;
    
    console.log('Starting background conversion with command:', command);
    
    // Use spawn for real-time progress tracking
    const ffmpeg = spawn('ffmpeg', [
      '-i', originalPath,
      '-c:v', 'libx264',
      '-crf', settings.crf.toString(),
      '-preset', settings.preset,
      ...(preserveAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
      convertedPath,
      '-y'
    ]);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      
      // Parse progress from ffmpeg output
      const progressMatch = stderr.match(/time=(\d+:\d+:\d+\.\d+)/);
      if (progressMatch) {
        // This is a simplified progress calculation
        // In a real implementation, you'd parse the duration and calculate percentage
        const currentTime = progressMatch[1];
        // For now, just update progress periodically
        const currentStatus = getConversionStatus(originalPath);
        if (currentStatus.status === 'converting') {
          setConversionStatus(originalPath, {
            ...currentStatus,
            progress: Math.min((currentStatus.progress || 0) + 5, 95)
          });
        }
      }
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`Video converted successfully: ${convertedPath}`);
        setConversionStatus(originalPath, { status: 'completed' });
      } else {
        console.error('FFmpeg conversion failed with code:', code);
        setConversionStatus(originalPath, {
          status: 'failed',
          error: `Conversion failed with exit code ${code}`
        });
      }
    });
    
    ffmpeg.on('error', (error) => {
      console.error('FFmpeg process error:', error);
      setConversionStatus(originalPath, {
        status: 'failed',
        error: error.message
      });
    });
    
  } catch (error) {
    console.error('Error starting video conversion:', error);
    setConversionStatus(originalPath, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
