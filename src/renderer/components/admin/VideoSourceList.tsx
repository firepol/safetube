import React from 'react';
import { VideoSource } from '@/shared/types';

interface VideoSourceListProps {
  sources: VideoSource[];
  onEdit: (source: VideoSource) => void;
  onDelete: (sourceId: string) => void;
  onMove: (sourceId: string, direction: 'up' | 'down') => void;
}

export const VideoSourceList: React.FC<VideoSourceListProps> = ({
  sources,
  onEdit,
  onDelete,
  onMove
}) => {
  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'youtube_channel':
        return '📺';
      case 'youtube_playlist':
        return '📋';
      case 'local':
        return '📁';
      default:
        return '📹';
    }
  };

  const getSourceTypeLabel = (type: string) => {
    switch (type) {
      case 'youtube_channel':
        return 'YouTube Channel';
      case 'youtube_playlist':
        return 'YouTube Playlist';
      case 'local':
        return 'Local Folder';
      default:
        return 'Video Source';
    }
  };

  const getSourceDisplayValue = (source: VideoSource) => {
    if (source.type === 'local') {
      return 'path' in source ? source.path : '';
    } else {
      return 'url' in source ? source.url : '';
    }
  };

  if (sources.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <div className="text-6xl text-gray-300 mb-4">📺</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No video sources</h3>
        <p className="text-gray-500">Add your first video source to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source, index) => (
        <div
          key={source.id}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-center justify-between">
            {/* Source Info */}
            <div className="flex items-center space-x-4 flex-1">
              <div className="text-2xl">{getSourceIcon(source.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-lg font-medium text-gray-900 truncate">
                    {source.title}
                  </h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {getSourceTypeLabel(source.type)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {getSourceDisplayValue(source)}
                </p>
                {source.sortPreference && (
                  <p className="text-xs text-gray-400">
                    Sort: {source.sortPreference}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {/* Move Up/Down Buttons */}
              <div className="flex flex-col space-y-1">
                <button
                  onClick={() => onMove(source.id, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => onMove(source.id, 'down')}
                  disabled={index === sources.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Edit Button */}
              <button
                onClick={() => onEdit(source)}
                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                title="Edit source"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              {/* Delete Button */}
              <button
                onClick={() => onDelete(source.id)}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
                title="Delete source"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
