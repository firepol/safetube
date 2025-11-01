/**
 * AuthGate Component
 *
 * Authentication gateway that conditionally renders login form or admin interface.
 * Protects admin features behind password authentication.
 */

import React, { ReactNode } from 'react';
import { useAdminAuth } from '@/renderer/hooks/admin/useAdminAuth';
import { LoginForm } from './LoginForm';

interface AuthGateProps {
  onAuthenticated: () => ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const { isAuthenticated, isLoading, error, login, logout } = useAdminAuth();

  if (isAuthenticated) {
    return <>{onAuthenticated()}</>;
  }

  return <LoginForm onLogin={login} isLoading={isLoading} error={error} />;
};
