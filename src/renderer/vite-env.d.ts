/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Primary API key source is Main Settings (via IPC from main process)
  // Environment variable fallback is handled in main process via YOUTUBE_API_KEY
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 