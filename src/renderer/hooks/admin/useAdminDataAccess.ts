/**
 * useAdminDataAccess Hook
 *
 * Provides access to the IAdminDataAccess implementation through React Context.
 * This is the foundational hook that all other admin hooks depend on.
 */

import { createContext, useContext } from 'react';
import { IAdminDataAccess } from '@/renderer/services/AdminDataAccess';

/**
 * React Context for providing admin data access to components
 */
export const AdminDataAccessContext = createContext<IAdminDataAccess | undefined>(undefined);

/**
 * Hook to access the IAdminDataAccess instance
 * @throws Error if used outside AdminDataAccessProvider
 */
export function useAdminDataAccess(): IAdminDataAccess {
  const context = useContext(AdminDataAccessContext);
  if (!context) {
    throw new Error('useAdminDataAccess must be used within AdminDataAccessProvider');
  }
  return context;
}
