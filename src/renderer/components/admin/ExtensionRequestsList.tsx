import React, { useEffect, useState, useCallback } from 'react';
import { ExtensionRequest } from '../../types';
import { useAdminContext } from '../../contexts/AdminContext';

export const ExtensionRequestsList: React.FC = () => {
  const [requests, setRequests] = useState<ExtensionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { addMessage } = useAdminContext();

  const loadRequests = useCallback(async () => {
    try {
      if (window.electron?.timeTracking?.getPendingRequests) {
        const data = await window.electron.timeTracking.getPendingRequests();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 10000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const handleResolve = async (id: number, approved: boolean) => {
    try {
      if (window.electron?.timeTracking?.resolveRequest) {
        await window.electron.timeTracking.resolveRequest(id, approved);
        addMessage(
          `Request ${approved ? 'approved' : 'denied'} successfully`,
          'success',
          3000
        );
        loadRequests();
      }
    } catch (error) {
      console.error('Error resolving request:', error);
      addMessage('Failed to resolve request', 'error');
    }
  };

  if (loading && requests.length === 0) {
    return <div className="bg-white rounded-lg p-6 shadow-md mb-6 animate-pulse h-24"></div>;
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-md mb-6 border-l-4 border-purple-500">
      <h3 className="text-xl font-bold mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span>Pending Requests</span>
          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full animate-pulse">
            New
          </span>
        </span>
        <span className="bg-purple-100 text-purple-800 text-sm font-medium px-2.5 py-0.5 rounded">
          {requests.length}
        </span>
      </h3>

      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
            <div>
              <p className="font-semibold text-gray-800">{req.sourceName || 'Unknown Source'}</p>
              <p className="text-sm text-gray-600">
                Requested <span className="font-bold text-purple-700">{req.minutesRequested} min</span>
                <span className="mx-2 text-gray-300">•</span>
                {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleResolve(req.id, false)}
                className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Deny
              </button>
              <button
                onClick={() => handleResolve(req.id, true)}
                className="px-3 py-1.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
              >
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
