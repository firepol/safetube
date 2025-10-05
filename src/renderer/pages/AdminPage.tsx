import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimeLimits, TimeTrackingState } from '@/shared/types';
import { VideoSourcesManager } from '@/renderer/components/admin/VideoSourcesManager';
import { SearchHistoryTab } from '@/renderer/components/admin/SearchHistoryTab';
import { TimeIndicator } from '@/renderer/components/layout/TimeIndicator';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Admin state
  const [extraTimeMinutes, setExtraTimeMinutes] = useState(10);
  const [timeLimits, setTimeLimits] = useState<TimeLimits | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'time' | 'sources' | 'main' | 'search'>('time');
  const [currentTimeState, setCurrentTimeState] = useState<TimeTrackingState | null>(null);
  const [projectedTimeState, setProjectedTimeState] = useState<TimeTrackingState | null>(null);
  const [dailyLimitModified, setDailyLimitModified] = useState(false);
  
  // Main settings state
  const [mainSettings, setMainSettings] = useState<{
    downloadPath?: string;
    youtubeApiKey?: string;
    adminPassword?: string;
    enableVerboseLogging?: boolean;
    allowYouTubeClicksToOtherVideos?: boolean;
  }>({});
  const [originalAdminPasswordHash, setOriginalAdminPasswordHash] = useState<string>('');
  const [isLoadingMainSettings, setIsLoadingMainSettings] = useState(false);
  const [mainSettingsSaveMessage, setMainSettingsSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    // Always start unauthenticated - no need to check
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadTimeLimits();
      loadCurrentTimeState();
    }
  }, [isAuthenticated]);

  // Update projected time state when extra time or time limits change
  useEffect(() => {
    if (currentTimeState && timeLimits) {
      // Use the current timeLimits value from the closure
      calculateProjectedTimeStateWithLimits(currentTimeState, extraTimeMinutes, timeLimits);
    }
  }, [extraTimeMinutes, currentTimeState, timeLimits]);

  const loadTimeLimits = async () => {
    try {
      const limits = await window.electron.getTimeLimits();
      setTimeLimits(limits);
      setDailyLimitModified(false); // Reset the flag when loading fresh data
    } catch (error) {
      console.error('Error loading time limits:', error);
      setError('Failed to load time limits');
    }
  };

  const loadCurrentTimeState = async () => {
    try {
      const state = await window.electron.getTimeTrackingState();
      setCurrentTimeState(state);
      // Don't calculate projected state here - let the useEffect handle it
    } catch (error) {
      console.error('Error loading time state:', error);
    }
  };

  const calculateProjectedTimeStateWithLimits = (currentState: TimeTrackingState, extraMinutes: number, limits: TimeLimits) => {
    if (!currentState || !limits) {
      return;
    }

    // Get current day of week
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' }) as keyof TimeLimits;
    
    // Calculate projected time limit
    const baseLimitMinutes = Number(limits[dayOfWeek]) || 0;
    const currentExtraTime = currentState.extraTimeToday || 0;
    const projectedExtraTime = currentExtraTime + extraMinutes;
    const projectedLimitMinutes = baseLimitMinutes + projectedExtraTime;
    const projectedLimitSeconds = projectedLimitMinutes * 60;
    
    // Calculate projected time remaining
    const projectedTimeRemaining = Math.max(0, projectedLimitSeconds - currentState.timeUsedToday);
    const projectedIsLimitReached = projectedTimeRemaining <= 0;


    setProjectedTimeState({
      ...currentState,
      timeLimitToday: projectedLimitSeconds,
      timeRemaining: projectedTimeRemaining,
      isLimitReached: projectedIsLimitReached,
      extraTimeToday: projectedExtraTime
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const auth = await window.electron.adminAuthenticate(password);
      if (auth.success) {
        setIsAuthenticated(true);
        setPassword('');
      } else {
        setError('Invalid password');
      }
    } catch (error) {
      setError('Authentication failed. Please check your password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExtraTime = async () => {
    if (extraTimeMinutes === 0) {
      setError('No change to apply.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await window.electron.adminAddExtraTime(extraTimeMinutes);
      setSaveMessage(`Successfully processed ${extraTimeMinutes} minutes!`);
      setExtraTimeMinutes(10); // Reset to default
      
      // Refresh the current time state after applying changes
      await loadCurrentTimeState();
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setError('Failed to process extra time. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTimeLimits = async () => {
    if (!timeLimits) return;

    setIsSaving(true);
    setError(null);

    try {
      console.log('[AdminPage] Saving time limits:', timeLimits);
      await window.electron.adminWriteTimeLimits(timeLimits);
      console.log('[AdminPage] Time limits saved successfully');
      setSaveMessage('Time limits updated successfully!');
      setDailyLimitModified(false); // Reset the flag after saving
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('[AdminPage] Error saving time limits:', error);
      setError('Failed to save time limits. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateTimeLimit = (day: keyof TimeLimits, value: number) => {
    if (!timeLimits) return;
    
    const newTimeLimits = {
      ...timeLimits,
      [day]: Math.max(0, Math.min(1440, value)) // Clamp between 0 and 1440 minutes
    };
    setTimeLimits(newTimeLimits);
    setDailyLimitModified(true);
    
    // The useEffect will handle the projected time calculation
  };

  const handleExtraTimeChange = (newExtraTime: number) => {
    setExtraTimeMinutes(newExtraTime);
    // The useEffect will handle the projected time calculation
  };

  const handleSmartExit = async () => {
    try {
      console.log('[AdminPage] Smart Exit: Getting last watched video info...');
      
      // Get the last watched video with source information
      const lastWatchedInfo = await window.electron.adminGetLastWatchedVideoWithSource();
      console.log('[AdminPage] Smart Exit: Last watched info:', lastWatchedInfo);
      
      if (lastWatchedInfo) {
        console.log('[AdminPage] Smart Exit: Navigating to video player for video:', lastWatchedInfo.video.videoId);
        
        // First, replace the current admin page in history with the source page
        // This ensures that when user clicks back from video player, they go to the source
        navigate(`/source/${lastWatchedInfo.sourceId}`, { replace: true });
        
        // Then navigate to the video player, adding it to history
        // Now the history will be: [previous page] -> [source page] -> [video player]
        navigate(`/player/${encodeURIComponent(lastWatchedInfo.video.videoId)}`);
        
        setSaveMessage(`Returning to ${lastWatchedInfo.video.title || 'your video'} where you last left off.`);
      } else {
        console.log('[AdminPage] Smart Exit: No last watched video found, going to homepage');
        // Fallback to homepage if no last watched video found
        navigate('/');
        setSaveMessage('No recent video found. Returning to homepage.');
      }
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('[AdminPage] Smart Exit error:', error);
      // Fallback to homepage on error
      navigate('/');
      setError('Smart exit failed. Returning to homepage.');
    }
  };

  // Main settings functions
  const loadMainSettings = async () => {
    try {
      setIsLoadingMainSettings(true);
      const settings = await window.electron.readMainSettings();

      // Store the original password hash for comparison
      setOriginalAdminPasswordHash(settings.adminPassword || '');

      // Clear the password field for display (don't show the hash)
      setMainSettings({
        ...settings,
        adminPassword: ''
      });
    } catch (error) {
      console.error('Error loading main settings:', error);
      setError('Failed to load main settings');
    } finally {
      setIsLoadingMainSettings(false);
    }
  };

  const handleSaveMainSettings = async () => {
    try {
      setIsSaving(true);
      setMainSettingsSaveMessage(null);
      setError(null);

      // Prepare settings to save
      let settingsToSave = { ...mainSettings };

      // Check if the password has been changed
      if (mainSettings.adminPassword && mainSettings.adminPassword.trim() !== '') {
        // Password field has content, need to hash it
        const hashResult = await window.electron.adminHashPassword(mainSettings.adminPassword);

        if (hashResult.success) {
          settingsToSave.adminPassword = hashResult.hashedPassword;
        } else {
          setError('Failed to hash password: ' + hashResult.error);
          return;
        }
      } else {
        // No password entered, keep the original hash
        settingsToSave.adminPassword = originalAdminPasswordHash;
      }

      const result = await window.electron.writeMainSettings(settingsToSave);

      if (result.success) {
        setMainSettingsSaveMessage('Settings saved successfully!');

        // Update the original hash if password was changed
        if (mainSettings.adminPassword && mainSettings.adminPassword.trim() !== '') {
          setOriginalAdminPasswordHash(settingsToSave.adminPassword || '');
          // Clear the password field after successful save
          setMainSettings(prev => ({ ...prev, adminPassword: '' }));
        }

        // Clear message after 3 seconds
        setTimeout(() => setMainSettingsSaveMessage(null), 3000);
      } else {
        setError(result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving main settings:', error);
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDownloadPath = async () => {
    try {
      const defaultPath = await window.electron.getDefaultDownloadPath();
      setMainSettings(prev => ({ ...prev, downloadPath: defaultPath }));
    } catch (error) {
      console.error('Error getting default download path:', error);
      setError('Failed to get default download path');
    }
  };


  // Load main settings when authenticated
  useEffect(() => {
    if (isAuthenticated && activeTab === 'main') {
      loadMainSettings();
    }
  }, [isAuthenticated, activeTab]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Parent Access</h1>
            <p className="text-gray-600">Enter your password to access admin controls</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter admin password"
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? 'Authenticating...' : 'Access Admin Area'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Manage SafeTube settings and time limits</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/')}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200"
              >
                Back to App
              </button>
              <button
                onClick={handleSmartExit}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
                title="Exit and return to last watched video player"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Smart Exit
              </button>

            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {saveMessage && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
            <p className="text-sm text-green-600">{saveMessage}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('time')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'time'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Time Management
              </button>
              <button
                onClick={() => setActiveTab('sources')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'sources'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Video Sources
              </button>
              <button
                onClick={() => setActiveTab('main')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'main'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Main Settings
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'search'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Search History
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'time' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Time Extension */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Time Extension</h2>
            <p className="text-gray-600 mb-4">
              Add or remove extra viewing time for today. Use negative numbers to remove previously added time or reduce daily limits.
            </p>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label htmlFor="extraTime" className="text-sm font-medium text-gray-700">
                  Extra Minutes:
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleExtraTimeChange(extraTimeMinutes - 10)}
                    className="w-8 h-8 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors duration-200 flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    id="extraTime"
                    value={extraTimeMinutes}
                    onChange={(e) => handleExtraTimeChange(parseInt(e.target.value) || 0)}
                    className="w-20 text-center border border-gray-300 rounded-md px-2 py-1"
                    min="-120"
                    max="120"
                  />
                  <button
                    onClick={() => handleExtraTimeChange(extraTimeMinutes + 10)}
                    className="w-8 h-8 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors duration-200 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                {extraTimeMinutes > 0 ? (
                  <span className="text-green-600">Adding {extraTimeMinutes} minutes to today's limit</span>
                ) : extraTimeMinutes < 0 ? (
                  <span className="text-red-600">Removing {Math.abs(extraTimeMinutes)} minutes from today's limit</span>
                ) : (
                  <span className="text-gray-500">No change to today's limit</span>
                )}
              </div>

              {/* Current Time State */}
              {currentTimeState && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Current Time Status</h4>
                  <TimeIndicator 
                    initialState={{
                      timeRemaining: currentTimeState.timeRemaining,
                      timeLimit: currentTimeState.timeLimitToday,
                      timeUsed: currentTimeState.timeUsedToday,
                      isLimitReached: currentTimeState.isLimitReached,
                      extraTimeToday: currentTimeState.extraTimeToday
                    }}
                    className="text-sm"
                  />
                </div>
              )}

              {/* Projected Time State */}
              {projectedTimeState && (extraTimeMinutes !== 0 || dailyLimitModified) && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-700 mb-2">
                    {extraTimeMinutes !== 0 
                      ? `After ${extraTimeMinutes > 0 ? 'adding' : 'removing'} ${Math.abs(extraTimeMinutes)} minutes:`
                      : 'After changing daily limit:'
                    }
                  </h4>
                  <TimeIndicator 
                    initialState={{
                      timeRemaining: projectedTimeState.timeRemaining,
                      timeLimit: projectedTimeState.timeLimitToday,
                      timeUsed: projectedTimeState.timeUsedToday,
                      isLimitReached: projectedTimeState.isLimitReached,
                      extraTimeToday: projectedTimeState.extraTimeToday
                    }}
                    className="text-sm"
                  />
                </div>
              )}

              <button
                onClick={handleAddExtraTime}
                disabled={isLoading || extraTimeMinutes === 0}
                className={`w-full py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ${
                  extraTimeMinutes > 0 
                    ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500' 
                    : extraTimeMinutes < 0 
                    ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                    : 'bg-gray-400 text-white cursor-not-allowed'
                }`}
              >
                {isLoading ? 'Processing...' : 
                  extraTimeMinutes > 0 ? `Add ${extraTimeMinutes} Minutes` :
                  extraTimeMinutes < 0 ? `Remove ${Math.abs(extraTimeMinutes)} Minutes` :
                  'No Change'
                }
              </button>
            </div>
          </div>

          {/* Time Limits Configuration */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Daily Time Limits</h2>
            <p className="text-gray-600 mb-4">
              Configure viewing time limits for each day of the week.
            </p>

            {/* Today's Current Limit Display */}
            {currentTimeState && timeLimits && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-700">
                  <strong>Today's limit:</strong> {Math.round(Number(currentTimeState.timeLimitToday || 0) / 60)} minutes
                  {currentTimeState.extraTimeToday && currentTimeState.extraTimeToday !== 0 && (
                    <span className="ml-2">
                      ({Math.floor(currentTimeState.timeLimitToday / 60) - Math.floor((currentTimeState.timeLimitToday / 60) - (currentTimeState.extraTimeToday || 0))} base + {currentTimeState.extraTimeToday} extra)
                    </span>
                  )}
                </div>
              </div>
            )}

            {timeLimits && (
              <div className="space-y-3">
                {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const).map((day) => (
                  <div key={day} className="flex items-center justify-between">
                    <label htmlFor={day} className="text-sm font-medium text-gray-700 w-24">
                      {day}:
                    </label>
                    <input
                      type="number"
                      id={day}
                      value={timeLimits[day] || 0}
                      onChange={(e) => updateTimeLimit(day, parseInt(e.target.value) || 0)}
                      className="w-20 text-center border border-gray-300 rounded-md px-2 py-1"
                      min="0"
                      max="1440"
                    />
                    <span className="text-sm text-gray-500 ml-2">minutes</span>
                  </div>
                ))}

                <button
                  onClick={handleSaveTimeLimits}
                  disabled={isSaving}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 mt-4"
                >
                  {isSaving ? 'Saving...' : 'Save Time Limits'}
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'sources' && (
          <VideoSourcesManager />
        )}

        {activeTab === 'main' && (
          <div className="space-y-6">
            {/* Main Settings */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Main Settings</h2>
              
              {isLoadingMainSettings ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading settings...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Download Path Setting */}
                  <div>
                    <label htmlFor="downloadPath" className="block text-sm font-medium text-gray-700 mb-2">
                      Download Path
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        id="downloadPath"
                        value={mainSettings.downloadPath || ''}
                        onChange={(e) => setMainSettings(prev => ({ ...prev, downloadPath: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter download path..."
                      />
                      <button
                        type="button"
                        onClick={handleResetDownloadPath}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                      >
                        Reset to Default
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Path where downloaded YouTube videos will be stored. Leave empty to use default location.
                    </p>
                  </div>

                  {/* YouTube API Key Setting */}
                  <div>
                    <label htmlFor="youtubeApiKey" className="block text-sm font-medium text-gray-700 mb-2">
                      YouTube API Key
                    </label>
                    <input
                      type="text"
                      id="youtubeApiKey"
                      value={mainSettings.youtubeApiKey || ''}
                      onChange={(e) => setMainSettings(prev => ({ ...prev, youtubeApiKey: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter YouTube API key (optional)..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Optional. Used for enhanced YouTube functionality. Get your key from Google Cloud Console.
                    </p>
                  </div>


                  {/* Admin Password Setting */}
                  <div>
                    <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Password
                    </label>
                    <input
                      type="password"
                      id="adminPassword"
                      value={mainSettings.adminPassword || ''}
                      onChange={(e) => setMainSettings(prev => ({ ...prev, adminPassword: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter new password to change, or leave empty to keep current"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only enter a new password if you want to change it. Leave empty to keep the current password.
                    </p>
                  </div>

                  {/* Verbose Logging Setting */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enableVerboseLogging"
                      checked={mainSettings.enableVerboseLogging || false}
                      onChange={(e) => setMainSettings(prev => ({ ...prev, enableVerboseLogging: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enableVerboseLogging" className="ml-2 block text-sm text-gray-700">
                      Enable Verbose Logging
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Enable detailed logging for debugging purposes.
                  </p>

                  {/* YouTube Click Control Setting */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="allowYouTubeClicksToOtherVideos"
                        checked={mainSettings.allowYouTubeClicksToOtherVideos || false}
                        onChange={(e) => setMainSettings(prev => ({ ...prev, allowYouTubeClicksToOtherVideos: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                      />
                      <div className="ml-2 flex-1">
                        <label htmlFor="allowYouTubeClicksToOtherVideos" className="block text-sm font-medium text-gray-700">
                          Allow YouTube Clicks to Other Videos (Channel Validation Mode)
                        </label>
                        <div className="mt-2 space-y-2">
                          <p className="text-xs text-gray-600">
                            <strong>When unchecked (default, most restrictive):</strong> Blocks all clicks to related videos in the YouTube iframe player.
                          </p>
                          <p className="text-xs text-gray-600">
                            <strong>When checked (less restrictive):</strong> Validates clicked videos against approved channel sources. Only allows videos from channels that are in your approved sources list.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={handleSaveMainSettings}
                      disabled={isSaving}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {isSaving ? 'Saving...' : 'Save Main Settings'}
                    </button>
                    
                    {mainSettingsSaveMessage && (
                      <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-3">
                        <p className="text-sm text-green-600">{mainSettingsSaveMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <SearchHistoryTab />
        )}
      </div>
    </div>
  );
};