// Stream selection functions from youtube.ts, converted to CommonJS

// Helper to check if URL is m3u8
function isM3U8(url) {
  return url.toLowerCase().includes('.m3u8');
}

function getBestStreamUrl(videoStreams, audioTracks) {
  // First try to find a combined format with high quality
  const combinedFormats = videoStreams
    .filter(s => s.mimeType.includes('mp4') && !isM3U8(s.url)) // Prefer mp4 and non-m3u8
    .sort((a, b) => {
      // Sort by resolution first
      const heightDiff = (b.height || 0) - (a.height || 0);
      if (heightDiff !== 0) return heightDiff;
      // Then by FPS
      return (b.fps || 0) - (a.fps || 0);
    });

  if (combinedFormats.length > 0) {
    return combinedFormats[0].url;
  }

  // If no combined format, get highest quality video and audio separately
  const videoFormats = videoStreams
    .filter(s => s.mimeType.includes('mp4') && !isM3U8(s.url)) // Prefer mp4 and non-m3u8
    .sort((a, b) => {
      // Sort by resolution first
      const heightDiff = (b.height || 0) - (a.height || 0);
      if (heightDiff !== 0) return heightDiff;
      // Then by FPS
      return (b.fps || 0) - (a.fps || 0);
    });
  
  const audioFormats = audioTracks
    .filter(a => a.mimeType.includes('mp4') && !isM3U8(a.url)) // Prefer mp4 and non-m3u8
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  if (videoFormats.length > 0 && audioFormats.length > 0) {
    // Return both URLs, player will need to handle them
    return `${videoFormats[0].url}|${audioFormats[0].url}`;
  }

  // Fallback to any non-m3u8 format
  const fallbackVideoFormats = videoStreams
    .filter(s => !isM3U8(s.url)) // Prefer non-m3u8
    .sort((a, b) => {
      const heightDiff = (b.height || 0) - (a.height || 0);
      if (heightDiff !== 0) return heightDiff;
      return (b.fps || 0) - (a.fps || 0);
    });
  
  const fallbackAudioFormats = audioTracks
    .filter(a => !isM3U8(a.url)) // Prefer non-m3u8
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  if (fallbackVideoFormats.length > 0 && fallbackAudioFormats.length > 0) {
    return `${fallbackVideoFormats[0].url}|${fallbackAudioFormats[0].url}`;
  }

  throw new Error('No suitable stream found');
}

function getBestAudioTrackByLanguage(audioTracks, preferredLanguages = ['en']) {
  if (!audioTracks.length) {
    throw new Error('No audio tracks available');
  }

  // If no preferredLanguages, default to English
  const langs = (preferredLanguages && preferredLanguages.length > 0) ? preferredLanguages : ['en'];

  // For each language, pick the highest-bitrate m4a/mp4, non-m3u8
  for (const lang of langs) {
    const candidates = audioTracks
      .filter(t =>
        t.language.toLowerCase() === lang.toLowerCase() &&
        !isM3U8(t.url) &&
        (t.mimeType === 'm4a' || t.mimeType === 'mp4')
      )
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    if (candidates.length > 0) return candidates[0];
  }

  // Fallback: any m4a/mp4, non-m3u8
  const nonM3U8M4aTrack = audioTracks
    .filter(t => !isM3U8(t.url) && (t.mimeType === 'm4a' || t.mimeType === 'mp4'))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  if (nonM3U8M4aTrack) return nonM3U8M4aTrack;

  // Fallback: any non-m3u8
  const anyNonM3U8Track = audioTracks
    .filter(t => !isM3U8(t.url))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  if (anyNonM3U8Track) return anyNonM3U8Track;

  // Last resort: any
  return audioTracks.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
}

function getHighestQualityStream(videoStreams, audioTracks, preferredLanguages = ['en']) {
  // First try to find a combined format with high quality
  const combinedFormats = videoStreams
    .filter(s => s.mimeType.includes('mp4') && !isM3U8(s.url)) // Prefer mp4 and non-m3u8
    .sort((a, b) => {
      // Sort by resolution first
      const heightDiff = (b.height || 0) - (a.height || 0);
      if (heightDiff !== 0) return heightDiff;
      // Then by FPS
      return (b.fps || 0) - (a.fps || 0);
    });

  if (combinedFormats.length > 0) {
    const best = combinedFormats[0];
    return {
      videoUrl: best.url,
      quality: best.quality,
      resolution: `${best.width}x${best.height}`,
      fps: best.fps
    };
  }

  // If no combined format, get highest quality video and audio separately
  const videoFormats = videoStreams
    .filter(s => s.mimeType.includes('mp4') && !isM3U8(s.url)) // Prefer mp4 and non-m3u8
    .sort((a, b) => {
      // Sort by resolution first
      const heightDiff = (b.height || 0) - (a.height || 0);
      if (heightDiff !== 0) return heightDiff;
      // Then by FPS
      return (b.fps || 0) - (a.fps || 0);
    });
  
  if (videoFormats.length > 0) {
    const bestVideo = videoFormats[0];
    const bestAudio = getBestAudioTrackByLanguage(audioTracks, preferredLanguages);
    
    return {
      videoUrl: bestVideo.url,
      audioUrl: bestAudio.url,
      quality: bestVideo.quality,
      resolution: `${bestVideo.width}x${bestVideo.height}`,
      fps: bestVideo.fps,
      audioLanguage: bestAudio.language
    };
  }

  // Fallback to any non-m3u8 format
  const fallbackVideoFormats = videoStreams
    .filter(s => !isM3U8(s.url)) // Prefer non-m3u8
    .sort((a, b) => {
      const heightDiff = (b.height || 0) - (a.height || 0);
      if (heightDiff !== 0) return heightDiff;
      return (b.fps || 0) - (a.fps || 0);
    });
  
  if (fallbackVideoFormats.length > 0) {
    const bestVideo = fallbackVideoFormats[0];
    const bestAudio = getBestAudioTrackByLanguage(audioTracks, preferredLanguages);
    
    return {
      videoUrl: bestVideo.url,
      audioUrl: bestAudio.url,
      quality: bestVideo.quality,
      resolution: `${bestVideo.width}x${bestVideo.height}`,
      fps: bestVideo.fps,
      audioLanguage: bestAudio.language
    };
  }

  throw new Error('No suitable stream found');
}

module.exports = {
  getBestStreamUrl,
  getHighestQualityStream,
  getBestAudioTrackByLanguage
}; 