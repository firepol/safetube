/**
 * VideoSourcesTab Component
 *
 * Tab for managing video sources (YouTube channels, playlists, local folders).
 * Provides unified interface for both Electron and HTTP modes.
 */

import React from 'react';
import { VideoSourcesManager } from './VideoSourcesManager';

export const VideoSourcesTab: React.FC = () => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <VideoSourcesManager />
    </div>
  );
};
