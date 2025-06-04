import React from 'react';
import { VideoGrid } from '../components/layout/VideoGrid';
import videos from '../data/videos.json';

export const KidScreen: React.FC = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Kid-Friendly Videos</h1>
      <VideoGrid
        videos={videos.map((v) => ({
          id: v.id,
          title: v.title,
          thumbnail: v.thumbnail,
          duration: Number(v.duration),
          type: v.type as 'youtube' | 'dlna' | 'local'
        }))}
      />
    </div>
  );
}; 