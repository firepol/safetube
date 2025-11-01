/**
 * AdminPage Component
 *
 * Main admin page component that serves as the entry point for the admin interface.
 * This is a thin wrapper around the refactored AdminApp component.
 */

import React from 'react';
import { AdminApp } from '@/renderer/components/admin/AdminApp';

export const AdminPage: React.FC = () => {
  return <AdminApp />;
};
