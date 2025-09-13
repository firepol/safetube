// This file contains only interfaces and types that can be shared between main and renderer processes
// The actual AppPaths implementation is in src/main/appPaths.ts

export interface AppPathsInterface {
  getConfigDir(): string;
  getCacheDir(): string;
  getLogsDir(): string;
  getUserDataDir(): string;
  isDev(): boolean;
  getConfigPath(filename: string): string;
  getCachePath(filename: string): string;
  getLogPath(filename: string): string;
}