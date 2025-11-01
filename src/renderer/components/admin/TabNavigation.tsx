/**
 * TabNavigation Component
 *
 * Tab navigation for switching between admin tabs.
 * Shows tabs based on feature flags for the current access mode.
 */

import React from 'react';
import { useAdminContext } from '@/renderer/contexts/AdminContext';

export const TabNavigation: React.FC = () => {
  const { activeTab, setActiveTab, features } = useAdminContext();

  const tabs = [
    { id: 'time' as const, label: 'Time Management', always: true },
    { id: 'sources' as const, label: 'Video Sources', available: features.canManageVideoSources },
    { id: 'main' as const, label: 'Main Settings', always: true },
    { id: 'search' as const, label: 'Search History', available: features.canViewSearchHistory },
    { id: 'wishlist' as const, label: 'Wishlist Moderation', available: features.canModerateWishlist },
  ];

  const visibleTabs = tabs.filter(tab => tab.always || tab.available);

  return (
    <nav className="flex space-x-2 border-b border-gray-200 overflow-x-auto">
      {visibleTabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
            activeTab === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
};
