/**
 * useMainSettings Hook
 *
 * Manages main application settings CRUD operations with password hashing support.
 * Handles loading, saving, and updating settings including secure password handling.
 */

import { useState, useCallback } from 'react';
import { useAdminDataAccess } from './useAdminDataAccess';
import { MainSettings } from './types';

/**
 * Main settings hook return type
 */
export interface UseMainSettingsReturn {
  settings: MainSettings;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (updates: Partial<MainSettings>) => Promise<boolean>;
  update: (key: keyof MainSettings, value: any) => void;
}

/**
 * Hook for managing main application settings
 * @returns Settings state and methods
 */
export function useMainSettings(): UseMainSettingsReturn {
  const dataAccess = useAdminDataAccess();
  const [settings, setSettings] = useState<MainSettings>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await dataAccess.getMainSettings();
      setSettings(loaded);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [dataAccess]);

  const save = useCallback(
    async (updates: Partial<MainSettings>): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        let settingsToSave = { ...updates };

        // Hash password if provided and not empty
        if (updates.adminPassword && updates.adminPassword.trim()) {
          const password = updates.adminPassword.trim();

          // Validate minimum password length (4 characters)
          if (password.length < 4) {
            setError('Password must be at least 4 characters long');
            setIsLoading(false);
            return false;
          }

          try {
            const hashed = await dataAccess.hashPassword(password);
            settingsToSave = { ...settingsToSave, adminPassword: hashed };
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to hash password';
            setError(errorMessage);
            return false;
          }
        } else {
          // Remove password from update if empty - let backend preserve existing password
          const { adminPassword, ...rest } = settingsToSave;
          settingsToSave = rest;
        }

        // Merge with existing settings
        const merged = { ...settings, ...settingsToSave };
        await dataAccess.setMainSettings(merged);
        setSettings(merged);
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [dataAccess, settings]
  );

  const update = useCallback((key: keyof MainSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  return {
    settings,
    isLoading,
    error,
    load,
    save,
    update,
  };
}
