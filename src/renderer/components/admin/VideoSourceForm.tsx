import React, { useState, useEffect } from 'react';

import { VideoSourceFormData, VideoSourceType, VideoSourceFormType } from '@/shared/types';
import { validateVideoSource, getDefaultSortOrder, isValidYouTubeChannelUrl, isValidYouTubePlaylistUrl, detectYouTubeUrlType } from '@/shared/videoSourceUtils';
import { useAdminDataAccess } from '@/renderer/hooks/admin/useAdminDataAccess';

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
  const dataAccess = useAdminDataAccess();
  const [formData, setFormData] = useState<VideoSourceFormData>(source);
  const [validation, setValidation] = useState<{ isValid: boolean; errors: string[]; warnings?: string[] }>({
    isValid: true,
    errors: []
  });
  const [isValidating, setIsValidating] = useState(false);
  const [titlePending, setTitlePending] = useState(false);
  const [urlValidated, setUrlValidated] = useState(false);

  useEffect(() => {
    setFormData(source);
    setUrlValidated(false);
    // For editing existing sources, the title should be enabled
    if (!isAdding && source.title) {
      setUrlValidated(true);
    }
  }, [source, isAdding]);

  // Auto-validate URL when it changes
  useEffect(() => {
    if (formData.url && (formData.type === 'youtube_channel' || formData.type === 'youtube_playlist' || formData.type === 'youtube')) {
      const timeoutId = setTimeout(() => {
        autoValidateUrl();
      }, 500); // Debounce for 500ms

      return () => clearTimeout(timeoutId);
    }
  }, [formData.url, formData.type]);

  const handleTypeChange = (type: VideoSourceFormType) => {
    const newFormData = {
      ...formData,
      type,
      url: type === 'local' ? undefined : formData.url,
      path: type === 'local' ? formData.path : undefined,
      sortPreference: type === 'local' ? getDefaultSortOrder('local') : 'newestFirst' // Default for YouTube
    };
    setFormData(newFormData);
    setValidation({ isValid: true, errors: [] });
    setUrlValidated(false); // Reset validation when type changes
  };

  const handleInputChange = (field: keyof VideoSourceFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Reset validation state when URL changes
    if (field === 'url') {
      setValidation({ isValid: true, errors: [] });
      setUrlValidated(false);
      // Reset to generic 'youtube' type and clear title when URL changes for YouTube sources
      if (formData.type === 'youtube_channel' || formData.type === 'youtube_playlist' || formData.type === 'youtube') {
        setFormData(prev => ({
          ...prev,
          [field]: value as string,
          title: '',
          type: 'youtube' // Reset to generic type to trigger fresh auto-detection
        }));
        return; // Return early to avoid double setting
      }
    }
  };

  const autoValidateUrl = async () => {
    if (!formData.url || (formData.type !== 'youtube_channel' && formData.type !== 'youtube_playlist' && formData.type !== 'youtube')) {
      return;
    }

    setIsValidating(true);
    setTitlePending(true);

    try {
      // Always auto-detect YouTube URL type for YouTube sources
      let detectedType: VideoSourceType | null = null;
      if (formData.type === 'youtube' || formData.type === 'youtube_channel' || formData.type === 'youtube_playlist') {
        detectedType = detectYouTubeUrlType(formData.url);
        if (!detectedType) {
          setValidation({
            isValid: false,
            errors: ['Invalid YouTube URL. Please paste a valid YouTube channel or playlist URL.']
          });
          setIsValidating(false);
          setTitlePending(false);
          setUrlValidated(false);
          return;
        }
        // Always update the form data with the freshly detected type
        setFormData(prev => ({ ...prev, type: detectedType! }));
      } else {
        // Use the explicitly selected type (for local sources)
        detectedType = formData.type as VideoSourceType;
      }

      // Basic URL format validation only (without title requirement)
      let urlValidationErrors: string[] = [];

      if (detectedType === 'youtube_channel') {
        if (!formData.url || formData.url.trim().length === 0) {
          urlValidationErrors.push('YouTube channel URL is required');
        } else if (!isValidYouTubeChannelUrl(formData.url)) {
          urlValidationErrors.push('Invalid YouTube channel URL format');
        }
      } else if (detectedType === 'youtube_playlist') {
        if (!formData.url || formData.url.trim().length === 0) {
          urlValidationErrors.push('YouTube playlist URL is required');
        } else if (!isValidYouTubePlaylistUrl(formData.url)) {
          urlValidationErrors.push('Invalid YouTube playlist URL format');
        }
      }

      if (urlValidationErrors.length > 0) {
        setValidation({
          isValid: false,
          errors: urlValidationErrors
        });
        setIsValidating(false);
        setTitlePending(false);
        setUrlValidated(false);
        return;
      }

      // Advanced validation with YouTube API to fetch metadata
      const result = await dataAccess.validateYouTubeUrl(
        formData.url,
        detectedType as 'youtube_channel' | 'youtube_playlist'
      );

      if (!result.isValid) {
        setValidation({
          isValid: false,
          errors: result.errors || ['Invalid YouTube URL']
        });
        setUrlValidated(false);
      } else {
        setValidation({ isValid: true, errors: [] });
        setUrlValidated(true);

        // Auto-populate title and channelId from fetched metadata
        if (result.title) {
          setFormData(prev => ({ ...prev, title: result.title! }));
        }

        if (result.channelId && detectedType === 'youtube_channel') {
          setFormData(prev => ({ ...prev, channelId: result.channelId! }));
        }

        // Update URL if it was cleaned
        if (result.cleanedUrl && result.cleanedUrl !== formData.url) {
          setFormData(prev => ({ ...prev, url: result.cleanedUrl! }));
        }
      }
    } catch (error) {
      console.error('Auto-validation error:', error);
      setValidation({
        isValid: false,
        errors: ['Validation failed: ' + (error instanceof Error ? error.message : String(error))]
      });
      setUrlValidated(false);
    } finally {
      setIsValidating(false);
      setTitlePending(false);
    }
  };

  const validateForm = async () => {
    setIsValidating(true);

    try {
      // Skip validation for generic 'youtube' type - should be resolved by auto-validation
      if (formData.type === 'youtube') {
        setValidation({ isValid: true, errors: [] });
        setIsValidating(false);
        return;
      }

      // Basic validation (URL format only, title validated separately)
      const basicValidation = validateVideoSource(
        formData.type as VideoSourceType,
        formData.url,
        formData.path,
        '' // Don't validate title here - it's validated by form submission logic
      );

      if (!basicValidation.isValid) {
        setValidation(basicValidation);
        setIsValidating(false);
        return;
      }

      // Advanced validation based on type
      if (formData.type === 'youtube_channel' || formData.type === 'youtube_playlist') {
        if (formData.url) {
          const result = await dataAccess.validateYouTubeUrl(
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
        const result = await dataAccess.validateLocalPath(formData.path);
        
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

    // Check if title is provided (required for all source types)
    if (!formData.title.trim()) {
      setValidation({
        isValid: false,
        errors: ['Title is required']
      });
      return;
    }

    // For local paths, validate one more time since they don't auto-validate
    if (formData.type === 'local' && formData.path) {
      await validateForm();
      if (!validation.isValid) return;
    }

    // For YouTube sources, we already have validation from auto-validation
    if ((formData.type === 'youtube_channel' || formData.type === 'youtube_playlist') && !urlValidated) {
      setValidation({
        isValid: false,
        errors: ['Please enter a valid URL first']
      });
      return;
    }

    onSave(formData);
  };

  const getSortOrderOptions = (type: VideoSourceFormType) => {
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
      case 'youtube':
        // Generic YouTube options (will be resolved after URL detection)
        return [
          { value: 'newestFirst', label: 'Newest First' },
          { value: 'oldestFirst', label: 'Oldest First' },
          { value: 'playlistOrder', label: 'Playlist Order' }
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
            onChange={(e) => handleTypeChange(e.target.value as VideoSourceFormType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="youtube">YouTube</option>
            <option value="local">Local Folder</option>
          </select>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Title *
            {titlePending && formData.type !== 'local' && (
              <span className="ml-2 text-sm text-blue-600">Fetching title...</span>
            )}
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            disabled={(formData.type === 'youtube' || formData.type === 'youtube_channel' || formData.type === 'youtube_playlist') && !urlValidated}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              ((formData.type === 'youtube' || formData.type === 'youtube_channel' || formData.type === 'youtube_playlist') && !urlValidated) || titlePending ? 'bg-gray-100 text-gray-500' : ''
            }`}
            placeholder={
              formData.type === 'local'
                ? "Enter a descriptive title"
                : titlePending
                  ? "Fetching title from URL..."
                  : !urlValidated
                    ? "Paste URL first to enable title field"
                    : "Enter a descriptive title"
            }
            required
          />
          {formData.type !== 'local' && !formData.title.trim() && !titlePending && formData.url && (
            <p className="text-xs text-gray-500 mt-1">
              Title will be auto-filled when you paste a valid URL
            </p>
          )}
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
              YouTube URL *
            </label>
            <input
              type="url"
              id="url"
              value={formData.url || ''}
              onChange={(e) => handleInputChange('url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://www.youtube.com/channel/UCxxxxx or https://www.youtube.com/playlist?list=PLxxxxxx"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Paste any YouTube channel or playlist URL - we'll automatically detect the type
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
          <label htmlFor="sortPreference" className="block text-sm font-medium text-gray-700 mb-2">
            Sort Order
          </label>
          <select
            id="sortPreference"
            value={formData.sortPreference || (formData.type === 'local' ? getDefaultSortOrder('local') : 'newestFirst')}
            onChange={(e) => handleInputChange('sortPreference', e.target.value)}
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
            type="submit"
            disabled={!validation.isValid || isValidating || !formData.title.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isValidating && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isValidating ? 'Validating...' : (isAdding ? 'Add Source' : 'Save Changes')}
          </button>
        </div>
      </form>
    </div>
  );
};
