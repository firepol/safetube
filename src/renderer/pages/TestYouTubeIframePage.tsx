import React from 'react';
import { useNavigate } from 'react-router-dom';

const YOUTUBE_VIDEO_ID = 'FaLI0X1_Ljk';

export const TestYouTubeIframePage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gray-100">
      <button
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={() => navigate('/')}
      >
        ← Back to Home
      </button>
      <h1 className="text-2xl font-bold mb-4">YouTube IFrame Test Page</h1>
      <div className="w-full max-w-2xl aspect-video bg-black">
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&modestbranding=1&rel=0&controls=1&showinfo=1&fs=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        ></iframe>
      </div>
    </div>
  );
}; 