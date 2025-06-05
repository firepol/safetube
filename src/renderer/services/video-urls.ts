interface Format {
  format_id: string;
  ext: string;
  vcodec: string;
  acodec: string;
  url: string;
  format_note?: string;
  tbr?: number;
  language?: string;
}

function getBestVideoFormat(formats: Format[]): Format | undefined {
  // First try to find 1080p50 MP4 format
  const format299 = formats.find(f => f.format_id === '299');
  if (format299) return format299;

  // Then try 1080p50 WebM format
  const format303 = formats.find(f => f.format_id === '303');
  if (format303) return format303;

  // Then try 720p MP4 format
  const format136 = formats.find(f => f.format_id === '136');
  if (format136) return format136;

  // Then try 720p WebM format
  const format247 = formats.find(f => f.format_id === '247');
  if (format247) return format247;

  // Then try 480p MP4 format
  const format135 = formats.find(f => f.format_id === '135');
  if (format135) return format135;

  // Then try 480p WebM format
  const format244 = formats.find(f => f.format_id === '244');
  if (format244) return format244;

  // Then try 360p MP4 format
  const format134 = formats.find(f => f.format_id === '134');
  if (format134) return format134;

  // Then try 360p WebM format
  const format243 = formats.find(f => f.format_id === '243');
  if (format243) return format243;

  // Finally try 240p MP4 format
  const format133 = formats.find(f => f.format_id === '133');
  if (format133) return format133;

  // Then try 240p WebM format
  const format242 = formats.find(f => f.format_id === '242');
  if (format242) return format242;

  // If no specific format is found, return the first format with video
  return formats.find(f => f.vcodec !== 'none');
}

function getBestAudioFormat(formats: Format[]): Format | undefined {
  // First try to find format 18 which has both video and audio
  const format18 = formats.find(f => f.format_id === '18');
  if (format18) return format18;

  // Then try to find any format with audio
  return formats.find(f => f.acodec !== 'none');
} 