import React from 'react';

interface VideoSource {
  id: string;
  title: string;
  type: string; // Changed from sourceType to type
  videos: any[];
  videoCount: number;
  thumbnail?: string;
}

interface SourceGridProps {
  sources: VideoSource[];
  onSourceClick: (source: VideoSource) => void;
}

export const SourceGrid: React.FC<SourceGridProps> = ({ sources, onSourceClick }) => {

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
      default:
        return 'Video Source';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sources.map((source) => (
        <div 
          key={source.id} 
          className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105"
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
            <p className="text-sm text-gray-400">{source.videoCount} videos</p>
          </div>
        </div>
      ))}
    </div>
  );
};
