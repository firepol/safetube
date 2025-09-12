import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

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
 * Get a converted video path, creating conversion if needed
 */
export async function getCompatibleVideoPath(
  originalPath: string,
  cacheDir?: string
): Promise<string> {
  try {
    // Get codec info
    const codecInfo = await getVideoCodecInfo(originalPath);
    
    // If already compatible, return original path
    if (!codecInfo.needsConversion) {
      console.log(`Video ${originalPath} is already compatible (${codecInfo.videoCodec})`);
      return originalPath;
    }

    console.log(`Video ${originalPath} needs conversion from ${codecInfo.videoCodec}`);

    // Determine cache directory
    const cacheDirectory = cacheDir || path.join(path.dirname(originalPath), '.converted');
    
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(cacheDirectory)) {
      fs.mkdirSync(cacheDirectory, { recursive: true });
    }

    // Generate output filename
    const originalName = path.basename(originalPath, path.extname(originalPath));
    const outputPath = path.join(cacheDirectory, `${originalName}_converted.mp4`);

    // Check if converted file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`Using existing converted file: ${outputPath}`);
      return outputPath;
    }

    // Convert video
    console.log(`Converting video to compatible format...`);
    await convertVideoToCompatibleFormat(originalPath, outputPath, { quality: 'medium' });
    
    console.log(`Video converted successfully: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error getting compatible video path:', error);
    throw error;
  }
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
