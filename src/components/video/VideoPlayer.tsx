import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'video.js/dist/tech/hls.js';
import 'video.js/dist/tech/http-streaming.js';

interface VideoPlayerProps {
  url: string;
  type: 'youtube' | 'local' | 'dlna';
  title: string;
  resumeAt?: number;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, type, title, resumeAt }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Configure video.js player
    const options = {
      controls: true,
      fluid: true,
      html5: {
        nativeVideoTracks: true,
        nativeAudioTracks: true,
        nativeTextTracks: true,
        vhs: {
          overrideNative: true
        }
      },
      sources: [{
        src: url,
        type: url.endsWith('.mkv') ? 'video/x-matroska' : undefined
      }]
    };

    // Initialize player
    const player = videojs(videoRef.current, options);
    playerRef.current = player;

    // Set initial time if resumeAt is provided
    if (resumeAt) {
      player.currentTime(resumeAt);
    }

    // Cleanup
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
      }
    };
  }, [url, resumeAt]);

  return (
    <div data-vjs-player>
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered"
        playsInline
      />
    </div>
  );
};

export default VideoPlayer; 