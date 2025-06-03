import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videos from '../data/videos.json';

export const PlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const video = videos.find((v) => v.id === id);

  if (!video) {
    return <div className="p-8 text-center text-red-600">Video not found</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <button
        className="mb-4 self-start rounded bg-muted px-4 py-2 text-sm hover:bg-muted-foreground/10"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>
      <h1 className="mb-2 text-2xl font-bold text-center">{video.title}</h1>
      <div className="mb-4 text-sm text-muted-foreground">Duration: {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</div>
      {video.streamUrl ? (
        <video
          className="w-full max-w-2xl aspect-video bg-black rounded-lg"
          src={video.streamUrl}
          controls
          autoPlay
        />
      ) : video.type === 'youtube' ? (
        <div className="w-full max-w-2xl aspect-video">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${video.url.split('v=')[1]}`}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="text-center text-muted-foreground">Video type not supported yet.</div>
      )}
    </div>
  );
}; 