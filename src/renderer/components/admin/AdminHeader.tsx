/**
 * AdminHeader Component
 *
 * Header for the admin interface displaying title and exit/navigation buttons.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminContext } from '@/renderer/contexts/AdminContext';
import { useAdminDataAccess } from '@/renderer/hooks/admin/useAdminDataAccess';

export const AdminHeader: React.FC = () => {
  const navigate = useNavigate();
  const { features } = useAdminContext();
  const dataAccess = useAdminDataAccess();
  const [networkInfo, setNetworkInfo] = React.useState<{ url: string } | null>(null);

  React.useEffect(() => {
    if (features.hasFileSystem) {
      dataAccess.getNetworkInfo().then(setNetworkInfo);
    }
  }, [features, dataAccess]);

  const handleBackToApp = () => {
    navigate('/');
  };

  const handleSmartExit = async () => {
    try {
      const videoInfo = await dataAccess.getLastWatchedVideoWithSource();
      if (videoInfo?.video?.id) {
        navigate(`/player/${videoInfo.video.id}`, {
          state: { sourceId: videoInfo.sourceId },
        });
      } else {
        navigate('/');
      }
    } catch {
      navigate('/');
    }
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">SafeTube Admin</h1>
            <p className="text-blue-100 text-sm mt-1">
              {features.hasDatabase ? 'Full Control' : 'Limited Access'}
            </p>
          </div>

          <div className="flex gap-3">
            {features.hasFileSystem && (
              <button
                onClick={handleSmartExit}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                title="Return to the last video you were watching"
              >
                Back to Video
              </button>
            )}
            <button
              onClick={handleBackToApp}
              className="bg-white text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              Back to App
            </button>
          </div>
        </div>

        {networkInfo && features.hasDatabase && (
          <div className="mt-4 text-sm text-blue-100">
            Network URL: <code className="bg-white/10 px-2 py-1 rounded">{networkInfo.url}</code>
          </div>
        )}
      </div>
    </header>
  );
};
