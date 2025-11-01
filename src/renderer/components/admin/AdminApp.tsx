/**
 * AdminApp Component
 *
 * Root component for the admin interface that orchestrates:
 * - Data access layer initialization
 * - Context providers setup
 * - Authentication gate
 * - Main admin layout and tab navigation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createAdminDataAccess, IAdminDataAccess } from '@/renderer/services/AdminDataAccess';
import { AdminDataAccessContext } from '@/renderer/hooks/admin/useAdminDataAccess';
import { AdminContext } from '@/renderer/contexts/AdminContext';
import { TabType, Message, AdminContextValue, FeatureFlags, AccessMode } from '@/renderer/hooks/admin/types';
import { AuthGate } from './AuthGate';
import { AdminLayout } from './AdminLayout';

export const AdminApp: React.FC = () => {
  const [dataAccess, setDataAccess] = useState<IAdminDataAccess | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>('electron');
  const [features, setFeatures] = useState<FeatureFlags>({
    hasDatabase: false,
    hasFileSystem: false,
    hasAppRestart: false,
    canManageVideoSources: false,
    canViewSearchHistory: false,
    canModerateWishlist: false,
  });
  const [activeTab, setActiveTab] = useState<TabType>('time');
  const [messages, setMessages] = useState<Message[]>([]);

  // Initialize data access layer
  useEffect(() => {
    const access = createAdminDataAccess();
    setDataAccess(access);
    setAccessMode(access.getAccessMode());
    setFeatures(access.getFeatureFlags());
  }, []);

  // Manage active tab based on feature availability
  useEffect(() => {
    // If active tab is not available in current mode, switch to default
    const availableTabs: TabType[] = ['time', 'main'];
    if (features.canManageVideoSources) availableTabs.push('sources');
    if (features.canViewSearchHistory) availableTabs.push('search');
    if (features.canModerateWishlist) availableTabs.push('wishlist');

    if (!availableTabs.includes(activeTab)) {
      setActiveTab('time');
    }
  }, [features, activeTab]);

  const addMessage = useCallback((text: string, type: Message['type'], duration?: number) => {
    const id = `msg-${Date.now()}`;
    const message: Message = { id, text, type, duration };
    setMessages(prev => [...prev, message]);

    // Auto-dismiss if duration is set
    if (duration && duration > 0) {
      setTimeout(() => removeMessage(id), duration);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const contextValue: AdminContextValue = {
    activeTab,
    setActiveTab,
    messages,
    addMessage,
    clearMessages,
    removeMessage,
    features,
    accessMode,
  };

  if (!dataAccess) {
    return <div className="p-4 text-center">Initializing admin interface...</div>;
  }

  return (
    <AdminDataAccessContext.Provider value={dataAccess}>
      <AdminContext.Provider value={contextValue}>
        <AuthGate onAuthenticated={() => <AdminLayout />} />
      </AdminContext.Provider>
    </AdminDataAccessContext.Provider>
  );
};
