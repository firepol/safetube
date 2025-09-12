import React, { useState, useEffect } from 'react';
import { VideoSourceFormData, VideoSourceType } from '@/shared/types';
import { validateVideoSource, getDefaultSortOrder } from '@/shared/videoSourceUtils';

interface VideoSourceFormProps {
  source: VideoSourceFormData;
  isAdding: boolean;
  onSave: (formData: VideoSourceFormData) => void;
  onCancel: () => void;
}

export const VideoSourceForm: React.FC<VideoSourceFormProps> = ({
  source,
  isAdding,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<VideoSourceFormData>(source);
  const [validation, setValidation] = useState<{ isValid: boolean; errors: string[]; warnings?: string[] }>({
    isValid: true,
    errors: []
  });
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    setFormData(source);
  }, [source]);

  const handleTypeChange = (type: VideoSourceType) => {
    const newFormData = {
      ...formData,
      type,
      url: type === 'local' ? undefined : formData.url,
      path: type === 'local' ? formData.path : undefined,
      sortOrder: getDefaultSortOrder(type)
    };
    setFormData(newFormData);
    setValidation({ isValid: true, errors: [] });
  };

  const handleInputChange = (field: keyof VideoSourceFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = async () => {
    setIsValidating(true);
    
    try {
      // Basic validation
      const basicValidation = validateVideoSource(
        formData.type,
        formData.url,
        formData.path,
        formData.title
      );

      if (!basicValidation.isValid) {
        setValidation(basicValidation);
        setIsValidating(false);
        return;
      }

      // Advanced validation based on type
      if (formData.type === 'youtube_channel' || formData.type === 'youtube_playlist') {
        if (formData.url) {
          const result = await window.electron.videoSourcesValidateYouTubeUrl(
            formData.url,
            formData.type
          );
          
          if (!result.isValid) {
            setValidation({
              isValid: false,
              errors: result.errors || ['Invalid YouTube URL']
            });
            setIsValidating(false);
            return;
          }

          // Update form data with cleaned URL if provided
          if (result.cleanedUrl && result.cleanedUrl !== formData.url) {
            setFormData(prev => ({ ...prev, url: result.cleanedUrl }));
          }
        }
      } else if (formData.type === 'local' && formData.path) {
        const result = await window.electron.videoSourcesValidateLocalPath(formData.path);
        
        if (!result.isValid) {
          setValidation({
            isValid: false,
            errors: result.errors || ['Invalid local path']
          });
          setIsValidating(false);
          return;
        }
      }

      setValidation({ isValid: true, errors: [] });
    } catch (error) {
      console.error('Validation error:', error);
      setValidation({
        isValid: false,
        errors: ['Validation failed: ' + (error instanceof Error ? error.message : String(error))]
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await validateForm();
    
    if (validation.isValid) {
      onSave(formData);
    }
  };

  const getSortOrderOptions = (type: VideoSourceType) => {
    switch (type) {
      case 'youtube_channel':
        return [
          { value: 'newestFirst', label: 'Newest First' },
          { value: 'oldestFirst', label: 'Oldest First' }
        ];
      case 'youtube_playlist':
        return [
          { value: 'playlistOrder', label: 'Playlist Order' },
          { value: 'newestFirst', label: 'Newest First' },
          { value: 'oldestFirst', label: 'Oldest First' }
        ];
      case 'local':
        return [
          { value: 'alphabetical', label: 'Alphabetical' },
          { value: 'dateAdded', label: 'Date Added' },
          { value: 'manual', label: 'Manual' }
        ];
      default:
        return [];
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {isAdding ? 'Add New Source' : 'Edit Source'}
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source Type */}
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
            Source Type
          </label>
          <select
            id="type"
            value={formData.type}
            onChange={(e) => handleTypeChange(e.target.value as VideoSourceType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="youtube_channel">YouTube Channel</option>
            <option value="youtube_playlist">YouTube Playlist</option>
            <option value="local">Local Folder</option>
          </select>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter a descriptive title"
            required
          />
        </div>

        {/* URL or Path */}
        {formData.type === 'local' ? (
          <div>
            <label htmlFor="path" className="block text-sm font-medium text-gray-700 mb-2">
              Folder Path *
            </label>
            <input
              type="text"
              id="path"
              value={formData.path || ''}
              onChange={(e) => handleInputChange('path', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="/path/to/video/folder"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the full path to your video folder
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              {formData.type === 'youtube_channel' ? 'Channel URL' : 'Playlist URL'} *
            </label>
            <input
              type="url"
              id="url"
              value={formData.url || ''}
              onChange={(e) => handleInputChange('url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={
                formData.type === 'youtube_channel' 
                  ? 'https://www.youtube.com/channel/UCxxxxx or https://www.youtube.com/@username'
                  : 'https://www.youtube.com/playlist?list=PLxxxxxx'
              }
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.type === 'youtube_channel' 
                ? 'Enter the YouTube channel URL'
                : 'Enter the YouTube playlist URL (watch URLs with playlist parameter are also supported)'
              }
            </p>
          </div>
        )}

        {/* Max Depth for Local Sources */}
        {formData.type === 'local' && (
          <div>
            <label htmlFor="maxDepth" className="block text-sm font-medium text-gray-700 mb-2">
              Max Folder Depth
            </label>
            <input
              type="number"
              id="maxDepth"
              value={formData.maxDepth || 2}
              onChange={(e) => handleInputChange('maxDepth', parseInt(e.target.value) || 2)}
              min="1"
              max="10"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              How many subfolder levels to scan for videos (1-10)
            </p>
          </div>
        )}

        {/* Sort Order */}
        <div>
          <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 mb-2">
            Sort Order
          </label>
          <select
            id="sortOrder"
            value={formData.sortOrder || getDefaultSortOrder(formData.type)}
            onChange={(e) => handleInputChange('sortOrder', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {getSortOrderOptions(formData.type).map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Validation Messages */}
        {validation.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="text-sm text-red-600">
              {validation.errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          </div>
        )}

        {validation.warnings && validation.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="text-sm text-yellow-600">
              {validation.warnings.map((warning, index) => (
                <div key={index}>{warning}</div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={validateForm}
            disabled={isValidating}
            className="px-4 py-2 text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors duration-200 disabled:opacity-50"
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </button>
          <button
            type="submit"
            disabled={!validation.isValid || isValidating}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? 'Add Source' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
