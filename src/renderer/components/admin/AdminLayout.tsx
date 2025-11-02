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
import { TimeManagementTab } from './TimeManagementTab';
import { MainSettingsTab } from './MainSettingsTab';
import { VideoSourcesTab } from './VideoSourcesTab';
import { SearchHistoryTab } from './SearchHistoryTab';
import { WishlistModerationTab } from './WishlistModerationTab';

export const AdminLayout: React.FC = () => {
  const { activeTab, messages } = useAdminContext();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'time':
        return <TimeManagementTab />;
      case 'main':
        return <MainSettingsTab />;
      case 'sources':
        return <VideoSourcesTab />;
      case 'search':
        return <SearchHistoryTab />;
      case 'wishlist':
        return <WishlistModerationTab />;
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
