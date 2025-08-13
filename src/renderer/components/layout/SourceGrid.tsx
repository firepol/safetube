import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface VideoSource {
  id: string;
  title: string;
  type: string;
  sourceType: string;
  videos: any[];
  videoCount: number;
  thumbnail?: string;
}

interface SourceGridProps {
  sources: VideoSource[];
}

export const SourceGrid: React.FC<SourceGridProps> = ({ sources }) => {
  const navigate = useNavigate();
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const handleSourceClick = (sourceId: string) => {
    if (expandedSource === sourceId) {
      setExpandedSource(null); // Collapse if already expanded
    } else {
      setExpandedSource(sourceId); // Expand this source
    }
  };

  const handleVideoClick = (video: any) => {
    if (video.type === 'youtube') {
      navigate(`/youtube-player/${video.id}`, { 
        state: { videoTitle: video.title } 
      });
    } else if (video.type === 'local') {
      navigate(`/player/${video.id}`);
    }
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'youtube_channel':
        return '📺';
      case 'youtube_playlist':
        return '📋';
      case 'local_folder':
        return '📁';
      case 'dlna_server':
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
      case 'local_folder':
        return 'Local Folder';
      case 'dlna_server':
        return 'DLNA Server';
      default:
        return 'Video Source';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sources.map((source) => (
        <div key={source.id} className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Source Header */}
          <div 
            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => handleSourceClick(source.id)}
          >
            <div className="flex items-center space-x-3">
              <div className="text-3xl">{getSourceIcon(source.sourceType)}</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{source.title}</h3>
                <p className="text-sm text-gray-500">{getSourceTypeLabel(source.sourceType)}</p>
                <p className="text-sm text-gray-400">{source.videoCount} videos</p>
              </div>
              <div className="text-gray-400">
                {expandedSource === source.id ? '▼' : '▶'}
              </div>
            </div>
          </div>

          {/* Videos List (when expanded) */}
          {expandedSource === source.id && (
            <div className="border-t border-gray-200 max-h-96 overflow-y-auto">
              {source.videos.length > 0 ? (
                <div className="p-4 space-y-2">
                  {source.videos.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleVideoClick(video)}
                    >
                      <div className="w-16 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                        {video.thumbnail ? (
                          <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 text-xs">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {video.title}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {video.type === 'youtube' ? 'YouTube' : 'Local Video'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No videos found in this source
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
