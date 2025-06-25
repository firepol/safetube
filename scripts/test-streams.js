#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { getBestStreamUrl, getHighestQualityStream, getBestAudioTrackByLanguage } = require('./youtube-streams');
const { logVerbose } = require('../src/shared/logging');

const execAsync = promisify(exec);

// Helper to get video streams using yt-dlp
async function getVideoStreams(videoId) {
  const { stdout } = await execAsync(`yt-dlp -j "${videoId}"`);
  const data = JSON.parse(stdout);

  const videoStreams = data.formats
    .filter(f => f.vcodec !== 'none' && f.acodec === 'none')
    .map(f => ({
      url: f.url,
      quality: f.format_note || f.quality,
      mimeType: f.ext,
      width: f.width,
      height: f.height,
      fps: f.fps,
      bitrate: f.tbr
    }));

  const audioTracks = data.formats
    .filter(f => f.vcodec === 'none' && f.acodec !== 'none')
    .map(f => ({
      url: f.url,
      language: f.language || 'en',
      mimeType: f.ext,
      bitrate: f.tbr
    }));

  return { videoStreams, audioTracks, rawData: data };
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('id', {
      alias: 'i',
      description: 'YouTube video ID',
      type: 'string',
      demandOption: true
    })
    .option('debug', {
      alias: 'd',
      description: 'Enable debug mode and save full data',
      type: 'boolean',
      default: false
    })
    .option('languages', {
      alias: 'l',
      description: 'Preferred audio languages (comma-separated)',
      type: 'string',
      default: 'en'
    })
    .help()
    .argv;

  try {
    const { videoStreams, audioTracks, rawData } = await getVideoStreams(argv.id);
    const preferredLanguages = argv.languages.split(',');

    // Get best stream URL
    const bestStreamUrl = getBestStreamUrl(videoStreams, audioTracks);
    logVerbose('\nBest Stream URL:', bestStreamUrl);

    // Get highest quality stream details
    const highestQuality = getHighestQualityStream(videoStreams, audioTracks, preferredLanguages);
    logVerbose('\nHighest Quality Stream:', highestQuality);

    // Get best audio track
    const bestAudio = getBestAudioTrackByLanguage(audioTracks, preferredLanguages);
    logVerbose('\nBest Audio Track:', bestAudio);

    // Debug mode: Save all data
    if (argv.debug) {
      const debugData = {
        videoId: argv.id,
        timestamp: new Date().toISOString(),
        videoStreams,
        audioTracks,
        bestStreamUrl,
        highestQuality,
        bestAudio,
        rawData
      };

      // Ensure logs directory exists
      await fs.mkdir('logs', { recursive: true });
      
      // Save debug data
      const debugFile = path.join('logs', `${argv.id}.json`);
      await fs.writeFile(debugFile, JSON.stringify(debugData, null, 2));
      logVerbose(`\nDebug data saved to: ${debugFile}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 