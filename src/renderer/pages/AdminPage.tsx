import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimeLimits } from '@/shared/types';
import { VideoSourcesManager } from '@/renderer/components/admin/VideoSourcesManager';

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
  const [activeTab, setActiveTab] = useState<'time' | 'sources'>('time');

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      try {
        const auth = await window.electron.adminAuthenticate('');
        setIsAuthenticated(auth.isAuthenticated);
      } catch (error) {
        // Not authenticated, show login form
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadTimeLimits();
    }
  }, [isAuthenticated]);

  const loadTimeLimits = async () => {
    try {
      const limits = await window.electron.getTimeLimits();
      setTimeLimits(limits);
    } catch (error) {
      console.error('Error loading time limits:', error);
      setError('Failed to load time limits');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const auth = await window.electron.adminAuthenticate(password);
      if (auth.isAuthenticated) {
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
    
    setTimeLimits({
      ...timeLimits,
      [day]: Math.max(0, Math.min(1440, value)) // Clamp between 0 and 1440 minutes
    });
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
        navigate(`/player/${lastWatchedInfo.video.videoId}`);
        
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
                    onClick={() => setExtraTimeMinutes(extraTimeMinutes - 10)}
                    className="w-8 h-8 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors duration-200 flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    id="extraTime"
                    value={extraTimeMinutes}
                    onChange={(e) => setExtraTimeMinutes(parseInt(e.target.value) || 0)}
                    className="w-20 text-center border border-gray-300 rounded-md px-2 py-1"
                    min="-120"
                    max="120"
                  />
                  <button
                    onClick={() => setExtraTimeMinutes(extraTimeMinutes + 10)}
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
      </div>
    </div>
  );
};