/**
 * AdminLayout Component
 *
 * Main layout for the admin interface after authentication.
 * Coordinates header, navigation, messages, and tab content areas.
 */

import React from 'react';
import { useAdminContext } from '@/renderer/contexts/AdminContext';
import { AdminHeader } from './AdminHeader';
import { MessageBanner } from './MessageBanner';
import { TabNavigation } from './TabNavigation';

export const AdminLayout: React.FC = () => {
  const { activeTab, messages } = useAdminContext();

  // Placeholder content for tabs - will be replaced with actual components in Phase 3
  const renderTabContent = () => {
    switch (activeTab) {
      case 'time':
        return (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-2xl font-bold mb-4">Time Management</h2>
            <p className="text-gray-600">Time management content coming soon...</p>
          </div>
        );
      case 'main':
        return (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-2xl font-bold mb-4">Main Settings</h2>
            <p className="text-gray-600">Main settings content coming soon...</p>
          </div>
        );
      case 'sources':
        return (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-2xl font-bold mb-4">Video Sources</h2>
            <p className="text-gray-600">Video sources content coming soon...</p>
          </div>
        );
      case 'search':
        return (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-2xl font-bold mb-4">Search History</h2>
            <p className="text-gray-600">Search history content coming soon...</p>
          </div>
        );
      case 'wishlist':
        return (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-2xl font-bold mb-4">Wishlist Moderation</h2>
            <p className="text-gray-600">Wishlist moderation content coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      {messages.length > 0 && <MessageBanner />}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <TabNavigation />

        <div className="mt-8">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};
