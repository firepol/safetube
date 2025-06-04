import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

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
    if (type === 'youtube') {
      // YouTube videos are handled by the iframe in the render
      return;
    }

    if (!videoRef.current) return;

    // Configure video.js player for local and DLNA videos
    const options = {
      controls: true,
      fluid: true,
      html5: {
        nativeVideoTracks: true,
        nativeAudioTracks: true,
        nativeTextTracks: true
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
  }, [url, resumeAt, type]);

  if (type === 'youtube') {
    // Extract video ID from YouTube URL
    const videoId = url.split('v=')[1]?.split('&')[0];
    if (!videoId) {
      return <div>Invalid YouTube URL</div>;
    }

    // Create embed URL with resume time if provided
    const embedUrl = `https://www.youtube.com/embed/${videoId}${resumeAt ? `?start=${resumeAt}` : ''}`;

    return (
      <div className="aspect-video w-full">
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

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