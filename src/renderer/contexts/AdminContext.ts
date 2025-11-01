/**
 * AdminContext
 *
 * Global state management for the admin interface including active tab,
 * messages, features, and access mode.
 */

import React, { createContext, useContext } from 'react';
import { TabType, Message, AdminContextValue, FeatureFlags, AccessMode } from '@/renderer/hooks/admin/types';

/**
 * React Context for global admin state
 */
export const AdminContext = createContext<AdminContextValue | undefined>(undefined);

/**
 * Hook to access the admin context
 * @throws Error if used outside AdminContextProvider
 */
export function useAdminContext(): AdminContextValue {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used within AdminContextProvider');
  }
  return context;
}

/**
 * Provider component properties
 */
export interface AdminContextProviderProps {
  children: React.ReactNode;
  initialTab?: TabType;
  features: FeatureFlags;
  accessMode: AccessMode;
  value: AdminContextValue;
}
