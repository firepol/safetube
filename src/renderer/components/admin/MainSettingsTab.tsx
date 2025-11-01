/**
 * MainSettingsTab Component
 *
 * Tab for main application settings.
 * Handles various setting types with conditional display based on access mode.
 */

import React, { useEffect } from 'react';
import { useMainSettings } from '@/renderer/hooks/admin/useMainSettings';
import { useAdminDataAccess } from '@/renderer/hooks/admin/useAdminDataAccess';
import { useAdminContext } from '@/renderer/contexts/AdminContext';

export const MainSettingsTab: React.FC = () => {
  const { settings, isLoading, load, save, update } = useMainSettings();
  const dataAccess = useAdminDataAccess();
  const { addMessage, features } = useAdminContext();
  const [isSaving, setIsSaving] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await save(settings);
    setIsSaving(false);
    if (success) {
      addMessage('Settings saved successfully!', 'success', 3000);
    } else {
      addMessage('Failed to save settings', 'error');
    }
  };

  const handleResetDownloadPath = async () => {
    try {
      const defaultPath = await dataAccess.getDefaultDownloadPath();
      update('downloadPath', defaultPath);
      addMessage('Download path reset to default', 'success', 3000);
    } catch {
      addMessage('Failed to reset download path', 'error');
    }
  };

  if (isLoading || !settings) {
    return <div className="p-6 text-center">Loading settings...</div>;
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-md max-w-2xl">
      <h3 className="text-xl font-bold mb-6">Main Settings</h3>

      <div className="space-y-6">
        {/* Download Path - IPC only */}
        {features.hasFileSystem && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Download Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.downloadPath || ''}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
              <button
                onClick={handleResetDownloadPath}
                disabled={isSaving}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50"
              >
                Reset
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Location where videos are downloaded</p>
          </div>
        )}

        {/* YouTube API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">YouTube API Key</label>
          <input
            type="text"
            value={settings.youtubeApiKey || ''}
            onChange={(e) => update('youtubeApiKey', e.target.value)}
            placeholder="Enter your YouTube Data API v3 key"
            disabled={isSaving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Get from Google Cloud Console</p>
        </div>

        {/* Admin Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Admin Password</label>
          <div className="flex gap-2">
            <input
              type={showPassword ? 'text' : 'password'}
              value={settings.adminPassword || ''}
              onChange={(e) => update('adminPassword', e.target.value)}
              placeholder="Leave blank to keep current password"
              disabled={isSaving}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Will be securely hashed before saving</p>
        </div>

        {/* Verbose Logging */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="verbose-logging"
            checked={settings.enableVerboseLogging || false}
            onChange={(e) => update('enableVerboseLogging', e.target.checked)}
            disabled={isSaving}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="verbose-logging" className="ml-3 text-sm font-medium text-gray-700">
            Enable Verbose Logging
          </label>
          <p className="text-xs text-gray-500 ml-2">Detailed debug logging to console</p>
        </div>

        {/* YouTube Clicks Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="youtube-clicks"
            checked={settings.allowYouTubeClicksToOtherVideos || false}
            onChange={(e) => update('allowYouTubeClicksToOtherVideos', e.target.checked)}
            disabled={isSaving}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="youtube-clicks" className="ml-3 text-sm font-medium text-gray-700">
            Allow YouTube Clicks to Other Videos
          </label>
          <p className="text-xs text-gray-500 ml-2">Allow clicking through YouTube recommended videos</p>
        </div>

        {/* Remote Access Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="remote-access"
            checked={settings.remoteAccessEnabled || false}
            onChange={(e) => update('remoteAccessEnabled', e.target.checked)}
            disabled={isSaving}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="remote-access" className="ml-3 text-sm font-medium text-gray-700">
            Enable Remote Access
          </label>
          <p className="text-xs text-gray-500 ml-2">Allow access from other devices via HTTP</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full mt-8 bg-gradient-to-r from-blue-600 to-purple-700 text-white font-bold py-3 rounded-lg hover:from-blue-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
};
