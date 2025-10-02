#!/usr/bin/env ts-node
/**
 * Sync IPC Constants from Shared to Preload
 *
 * This script ensures that the IPC constants in src/preload/index.ts
 * are kept in sync with the single source of truth in src/shared/ipc-channels.ts
 *
 * This is necessary because Electron's sandboxed preload environment
 * cannot import from relative modules, so the constants must be inlined.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHARED_FILE = path.join(__dirname, '../src/shared/ipc-channels.ts');
const PRELOAD_FILE = path.join(__dirname, '../src/preload/index.ts');

// Markers to identify the section to replace in preload
const START_MARKER = '// IPC Channel Constants - AUTO-GENERATED';
const END_MARKER = '} as const;';

function syncIPCConstants() {
  console.log('🔄 Syncing IPC constants from shared to preload...');

  // Read the shared constants file
  if (!fs.existsSync(SHARED_FILE)) {
    console.error(`❌ Shared file not found: ${SHARED_FILE}`);
    process.exit(1);
  }

  const sharedContent = fs.readFileSync(SHARED_FILE, 'utf8');

  // Extract the IPC constant declaration
  const ipcConstantMatch = sharedContent.match(/export const IPC = \{[\s\S]*?\} as const;/);

  if (!ipcConstantMatch) {
    console.error('❌ Could not find "export const IPC" in shared file');
    process.exit(1);
  }

  const ipcConstantDeclaration = ipcConstantMatch[0];

  // Read the preload file
  if (!fs.existsSync(PRELOAD_FILE)) {
    console.error(`❌ Preload file not found: ${PRELOAD_FILE}`);
    process.exit(1);
  }

  const preloadContent = fs.readFileSync(PRELOAD_FILE, 'utf8');

  // Find the section to replace in preload
  const startIndex = preloadContent.indexOf(START_MARKER);

  if (startIndex === -1) {
    console.error('❌ Could not find START_MARKER in preload file');
    console.error(`   Looking for: ${START_MARKER}`);
    process.exit(1);
  }

  // Find the end of the IPC constant declaration
  const searchStart = startIndex;
  let endIndex = preloadContent.indexOf(END_MARKER, searchStart);

  if (endIndex === -1) {
    console.error('❌ Could not find END_MARKER after START_MARKER in preload file');
    process.exit(1);
  }

  // Include the "} as const;" part
  endIndex += END_MARKER.length;

  // Build the replacement content
  const generatedComment = `// IPC Channel Constants - AUTO-GENERATED from src/shared/ipc-channels.ts
// DO NOT EDIT THIS SECTION MANUALLY - Run 'yarn sync-ipc' to update`;

  const replacementContent = `${generatedComment}\n${ipcConstantDeclaration.replace('export ', '')}`;

  // Replace the section
  const updatedPreloadContent =
    preloadContent.substring(0, startIndex) +
    replacementContent +
    preloadContent.substring(endIndex);

  // Write the updated preload file
  fs.writeFileSync(PRELOAD_FILE, updatedPreloadContent, 'utf8');

  console.log('✅ IPC constants synced successfully!');
  console.log(`   Source: ${path.relative(process.cwd(), SHARED_FILE)}`);
  console.log(`   Target: ${path.relative(process.cwd(), PRELOAD_FILE)}`);
}

// Run the sync
try {
  syncIPCConstants();
} catch (error) {
  console.error('❌ Error syncing IPC constants:', error);
  process.exit(1);
}
