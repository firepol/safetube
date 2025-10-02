/**
 * IPC Test Helpers
 *
 * Utilities for testing IPC channel contracts and handler registration
 */

import { vi } from 'vitest';
import { ipcMain } from 'electron';

/**
 * Captures all IPC handlers registered during execution
 * Returns a Map of channel names to handler functions
 */
export function captureIPCHandlers(): Map<string, Function> {
  const handlers = new Map<string, Function>();

  // Mock ipcMain.handle to capture registrations
  vi.spyOn(ipcMain, 'handle').mockImplementation((channel: string, handler: Function) => {
    handlers.set(channel, handler);
  });

  return handlers;
}

/**
 * Get a specific handler by channel name
 */
export function getHandler(handlers: Map<string, Function>, channel: string): Function | undefined {
  return handlers.get(channel);
}

/**
 * Check if a handler is registered for a channel
 */
export function hasHandler(handlers: Map<string, Function>, channel: string): boolean {
  return handlers.has(channel);
}

/**
 * Get all registered channel names
 */
export function getRegisteredChannels(handlers: Map<string, Function>): string[] {
  return Array.from(handlers.keys());
}
