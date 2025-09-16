import React, { useState, useEffect } from 'react';

import { VideoSourceForm } from './VideoSourceForm';
import { VideoSourceList } from './VideoSourceList';

import { VideoSource, VideoSourceFormData, VideoSourceManagementState } from '@/shared/types';

export const VideoSourcesManager: React.FC = () => {
  const [state, setState] = useState<VideoSourceManagementState>({
    sources: [],
    isLoading: true,
    error: null,
    editingSource: null,
    isAdding: false
  });

  useEffect(() => {
    loadVideoSources();
  }, []);

  const loadVideoSources = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const sources = await window.electron.videoSourcesGetAll();
      setState(prev => ({ ...prev, sources, isLoading: false }));
    } catch (error) {
      console.error('Error loading video sources:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to load video sources' 
      }));
    }
  };

  const handleAddSource = () => {
    setState(prev => ({ 
      ...prev, 
      isAdding: true, 
      editingSource: {
        type: 'youtube_channel',
        title: '',
        url: '',
        sortOrder: 'newestFirst'
      }
    }));
  };

  const handleEditSource = (source: VideoSource) => {
    setState(prev => ({ 
      ...prev, 
      isAdding: false,
      editingSource: {
        id: source.id,
        type: source.type,
        title: source.title,
        url: 'url' in source ? source.url : '',
        path: 'path' in source ? source.path : '',
        sortOrder: source.sortOrder || 'newestFirst',
        maxDepth: 'maxDepth' in source ? source.maxDepth : undefined
      }
    }));
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this video source?')) {
      return;
    }

    try {
      const updatedSources = state.sources.filter(s => s.id !== sourceId);
      await window.electron.videoSourcesSaveAll(updatedSources);
      setState(prev => ({ ...prev, sources: updatedSources }));
    } catch (error) {
      console.error('Error deleting video source:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to delete video source' 
      }));
    }
  };

  const handleMoveSource = async (sourceId: string, direction: 'up' | 'down') => {
    const currentIndex = state.sources.findIndex(s => s.id === sourceId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= state.sources.length) return;

    try {
      const updatedSources = [...state.sources];
      [updatedSources[currentIndex], updatedSources[newIndex]] = [updatedSources[newIndex], updatedSources[currentIndex]];
      
      await window.electron.videoSourcesSaveAll(updatedSources);
      setState(prev => ({ ...prev, sources: updatedSources }));
    } catch (error) {
      console.error('Error moving video source:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to move video source' 
      }));
    }
  };

  const handleSaveSource = async (formData: VideoSourceFormData) => {
    try {
      let updatedSources: VideoSource[];
      
      if (state.isAdding) {
        // Add new source
        let newSource: VideoSource;
        
        if (formData.type === 'local') {
          newSource = {
            id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'local',
            title: formData.title,
            path: formData.path!,
            maxDepth: formData.maxDepth || 2,
            sortOrder: (formData.sortOrder as 'alphabetical' | 'dateAdded' | 'manual') || 'alphabetical'
          };
        } else if (formData.type === 'youtube_channel') {
          newSource = {
            id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'youtube_channel',
            title: formData.title,
            url: formData.url!,
            sortOrder: (formData.sortOrder as 'newestFirst' | 'oldestFirst') || 'newestFirst'
          };
        } else {
          newSource = {
            id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'youtube_playlist',
            title: formData.title,
            url: formData.url!,
            sortOrder: (formData.sortOrder as 'playlistOrder' | 'newestFirst' | 'oldestFirst') || 'playlistOrder'
          };
        }
        updatedSources = [...state.sources, newSource];
      } else {
        // Update existing source
        updatedSources = state.sources.map(s => {
          if (s.id === formData.id) {
            if (formData.type === 'local') {
              return {
                ...s,
                type: 'local' as const,
                title: formData.title,
                path: formData.path!,
                maxDepth: formData.maxDepth || 2,
                sortOrder: (formData.sortOrder as 'alphabetical' | 'dateAdded' | 'manual') || 'alphabetical'
              };
            } else if (formData.type === 'youtube_channel') {
              return {
                ...s,
                type: 'youtube_channel' as const,
                title: formData.title,
                url: formData.url!,
                sortOrder: (formData.sortOrder as 'newestFirst' | 'oldestFirst') || 'newestFirst'
              };
            } else {
              return {
                ...s,
                type: 'youtube_playlist' as const,
                title: formData.title,
                url: formData.url!,
                sortOrder: (formData.sortOrder as 'playlistOrder' | 'newestFirst' | 'oldestFirst') || 'playlistOrder'
              };
            }
          }
          return s;
        });
      }

      await window.electron.videoSourcesSaveAll(updatedSources);
      setState(prev => ({ 
        ...prev, 
        sources: updatedSources,
        editingSource: null,
        isAdding: false
      }));
    } catch (error) {
      console.error('Error saving video source:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to save video source' 
      }));
    }
  };

  const handleCancelEdit = () => {
    setState(prev => ({ 
      ...prev, 
      editingSource: null, 
      isAdding: false 
    }));
  };

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading video sources...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Video Sources</h2>
          <p className="text-gray-600 mt-1">
            Manage YouTube channels, playlists, and local folders
          </p>
        </div>
        <button
          onClick={handleAddSource}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Source
        </button>
      </div>

      {/* Error Message */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{state.error}</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {state.editingSource && (
        <VideoSourceForm
          source={state.editingSource}
          isAdding={state.isAdding}
          onSave={handleSaveSource}
          onCancel={handleCancelEdit}
        />
      )}

      {/* Sources List */}
      <VideoSourceList
        sources={state.sources}
        onEdit={handleEditSource}
        onDelete={handleDeleteSource}
        onMove={handleMoveSource}
      />
    </div>
  );
};
