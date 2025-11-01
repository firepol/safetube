/**
 * LoginForm Component
 *
 * Login form for admin authentication with password input and error display.
 * Works for both IPC and HTTP authentication modes.
 */

import React, { useState, FormEvent } from 'react';

interface LoginFormProps {
  onLogin: (password: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin, isLoading, error }) => {
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      await onLogin(password);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SafeTube Admin</h1>
        <p className="text-gray-600 mb-6">Enter your admin password to continue</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Enter your password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-700 text-white font-semibold py-2 px-4 rounded-lg hover:from-blue-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-4">
          SafeTube Admin Panel • Enter your admin password for full access
        </p>
      </div>
    </div>
  );
};
