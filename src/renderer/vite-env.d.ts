/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Legacy fallback support for development/testing
  // Primary API key source is now mainSettings.json via IPC
  readonly VITE_YOUTUBE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 