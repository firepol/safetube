import React from 'react';
import { VideoGrid } from '@/components/layout/VideoGrid';
import { sampleVideos } from '@/data/sample-videos';

export const KidScreen: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-8 text-3xl font-bold">My Videos</h1>
      <VideoGrid videos={sampleVideos} />
    </div>
  );
}; 