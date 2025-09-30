import React, { useEffect, useState } from 'react';
import { logVerbose } from '../../lib/logging';

interface VideoSource {
  id: string;
  title: string;
  type: string; // Changed from sourceType to type
  videos: any[];
  videoCount: number;
  thumbnail?: string;
  path?: string; // For local sources
  maxDepth?: number; // For local sources
}

interface SourceGridProps {
  sources: VideoSource[];
  onSourceClick: (source: VideoSource) => void;
}

export const SourceGrid: React.FC<SourceGridProps> = ({ sources, onSourceClick }) => {
  const [videoCounts, setVideoCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState<Record<string, boolean>>({});

  // Load video counts for local sources lazily
  useEffect(() => {
    const loadVideoCounts = async () => {
      for (const source of sources) {
        if (source.type === 'local' && source.path && source.maxDepth && !videoCounts[source.id] && !loadingCounts[source.id]) {
          setLoadingCounts(prev => ({ ...prev, [source.id]: true }));
          
          try {
            if (window.electron && window.electron.getLocalSourceVideoCount) {
              const count = await window.electron.getLocalSourceVideoCount(source.path, source.maxDepth);
              setVideoCounts(prev => ({ ...prev, [source.id]: count }));
            }
          } catch (error) {
            console.error('Error loading video count for source:', source.id, error);
            setVideoCounts(prev => ({ ...prev, [source.id]: 0 }));
          } finally {
            setLoadingCounts(prev => ({ ...prev, [source.id]: false }));
          }
        }
      }
    };

    loadVideoCounts();
  }, [sources, videoCounts, loadingCounts]);

  const handleSourceClick = (source: VideoSource) => {
    if (onSourceClick) {
      onSourceClick(source);
    }
  };

  const getSourceThumbnail = (source: VideoSource) => {
    // For YouTube sources, use the source thumbnail (which comes from first video)
    if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
      if (source.thumbnail) {
        return (
          <img
            src={source.thumbnail}
            alt={source.title}
            className="w-full h-full object-cover"
          />
        );
      }
    }

    // For local sources, show folder icon
    if (source.type === 'local') {
      return (
        <div className="w-full h-full bg-blue-100 flex items-center justify-center">
          <div className="text-6xl text-blue-500">📁</div>
        </div>
      );
    }

    // For history source, show special purple background
    if (source.type === 'history') {
      return (
        <div className="w-full h-full bg-purple-100 flex items-center justify-center">
          <div className="text-6xl text-purple-500">📚</div>
        </div>
      );
    }

    // For favorites source, show special star background
    if (source.type === 'favorites') {
      return (
        <div className="w-full h-full bg-yellow-100 flex items-center justify-center">
          <div className="text-6xl text-yellow-500">⭐</div>
        </div>
      );
    }

    // Default fallback
    return (
      <div className="w-full h-full bg-gray-300 flex items-center justify-center">
        <div className="text-4xl text-gray-500">{getSourceIcon(source.type)}</div>
      </div>
    );
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'youtube_channel':
        return '📺';
      case 'youtube_playlist':
        return '📋';
      case 'local':
        return '📁';
      case 'dlna':
        return '🌐';
      case 'history':
        return '📚';
      case 'favorites':
        return '⭐';
      default:
        return '📹';
    }
  };

  const getSourceTypeLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'youtube_channel':
        return 'YouTube Channel';
      case 'youtube_playlist':
        return 'YouTube Playlist';
      case 'local':
        return 'Local Folder';
      case 'dlna':
        return 'DLNA Server';
      case 'history':
        return 'Video History';
      case 'favorites':
        return 'Favorites';
      default:
        return 'Video Source';
    }
  };

  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {sources.map((source) => (
        <div
          key={source.id}
          className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105 w-full"
          onClick={() => handleSourceClick(source)}
        >
          {/* Source Thumbnail */}
          <div className="aspect-video bg-gray-200 overflow-hidden">
            {getSourceThumbnail(source)}
          </div>
          
          {/* Source Info */}
          <div className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <div className="text-2xl">{getSourceIcon(source.type)}</div>
              <div className="text-sm text-gray-500">{getSourceTypeLabel(source.type)}</div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{source.title}</h3>
            <p className="text-sm text-gray-400">
              {source.type === 'history'
                ? 'All your watched videos'
                : source.type === 'local' && loadingCounts[source.id]
                ? 'Counting videos...'
                : `${videoCounts[source.id] ?? source.videoCount} videos`
              }
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
