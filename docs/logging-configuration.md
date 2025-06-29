# Logging Configuration

This document explains how to configure logging verbosity for different environments in SafeTube.

## Overview

SafeTube uses a unified logging system that respects environment variables to control verbosity. The system works across both the main process (Electron) and renderer process (React app) and automatically detects the current environment.

## Environment Variables

### For Electron App
Set `ELECTRON_LOG_VERBOSE` in your `.env` file:
```env
# Enable verbose logging for Electron app
ELECTRON_LOG_VERBOSE=true

# Disable verbose logging for Electron app
ELECTRON_LOG_VERBOSE=false
```

### For Tests
Set `TEST_LOG_VERBOSE` in your test environment:
```env
# Enable verbose logging during tests
TEST_LOG_VERBOSE=true

# Disable verbose logging during tests (recommended for CI)
TEST_LOG_VERBOSE=false
```

## Usage

Replace debug `console.log` calls with `logVerbose`:

```typescript
import { logVerbose } from '@/shared/logging';

// Instead of:
// console.log('Debug info:', data);

// Use:
logVerbose('Debug info:', data);
```

## Available Functions

- `logVerbose(...args)` - Logs only when verbose mode is enabled for current environment
- `logError(...args)` - Always logs errors (not affected by verbosity setting)
- `logWarning(...args)` - Always logs warnings (not affected by verbosity setting)

## Environment Detection

The logging system automatically detects the current environment:
- **Test Environment**: Detected by `NODE_ENV=test`, presence of `jest`/`vitest`, or `VITEST` environment variable
- **Electron App**: All other environments

## Implementation Details

### Architecture
- **Main Process**: Uses `process.env.ELECTRON_LOG_VERBOSE` directly
- **Renderer Process**: Environment variable passed via preload script through `window.electron.env.ELECTRON_LOG_VERBOSE`
- **Shared Logic**: Single `shouldLogVerbose()` function handles both environments

### File Structure
```
src/
├── shared/
│   └── logging.ts          # Main logging utilities
├── main/
│   └── main.ts            # Main process (uses process.env directly)
├── preload/
│   └── index.ts           # Exposes env vars to renderer
└── renderer/
    └── types.ts           # TypeScript definitions for window.electron
```

### Preload Script Integration
The preload script (`src/preload/index.ts`) exposes environment variables to the renderer process:

```typescript
contextBridge.exposeInMainWorld('electron', {
  // ... other methods
  env: {
    ELECTRON_LOG_VERBOSE: process.env.ELECTRON_LOG_VERBOSE
  }
});
```

## Debugging

### Enable Debug Mode
To debug logging issues, the system includes built-in debugging:

1. **Check Preload Script**: Look for `[Preload]` messages in the terminal
2. **Check Renderer Process**: Look for `[Logging Debug]` messages in DevTools console
3. **Verify Environment Variable**: Ensure `ELECTRON_LOG_VERBOSE=true` is set

### Debug Output
When debugging is enabled **and verbose logging is turned on** (`ELECTRON_LOG_VERBOSE=true`), you'll see:
```
[Preload] Available env vars: ['ELECTRON_LOG_VERBOSE']
[Preload] ELECTRON_LOG_VERBOSE value: true
[Logging Debug] shouldLogVerbose check: {
  hasProcess: false,
  processEnv: "undefined",
  hasWindow: true,
  windowElectron: {...},
  windowElectronEnv: {...},
  windowElectronEnvValue: "true"
}
```

**Note**: Debug output only appears when `ELECTRON_LOG_VERBOSE=true`. When verbose logging is disabled, no debug messages will be shown.

## Troubleshooting

### Common Issues

1. **"No handler registered for 'get-env-var'"**
   - **Cause**: Old IPC-based implementation
   - **Solution**: Use the current preload script approach

2. **Verbose logs not showing in renderer**
   - **Check**: `window.electron.env.ELECTRON_LOG_VERBOSE` value in DevTools
   - **Solution**: Ensure environment variable is set and preload script is working

3. **Frequent re-rendering logs**
   - **Cause**: Logging statements at component level instead of in useEffect
   - **Solution**: Move logs inside useEffect with proper dependencies

### Verification Steps

1. **Start the app**: `ELECTRON_LOG_VERBOSE=true yarn electron:dev`
2. **Check terminal**: Look for `[Preload]` messages
3. **Open DevTools**: Check for `[Logging Debug]` messages
4. **Navigate to video**: Should see verbose logs from audio warnings, YouTube services, etc.

## Example Configuration

### Development
```env
# .env
ELECTRON_LOG_VERBOSE=true
```

### Production
```env
# .env
ELECTRON_LOG_VERBOSE=false
```

### Testing
```env
# .env.test or test environment
TEST_LOG_VERBOSE=false
```

## Recent Changes

- **2025-06-29**: Consolidated logging system to use single `logVerbose` function
- **2025-06-29**: Fixed environment variable passing via preload script
- **2025-06-29**: Added debugging capabilities for troubleshooting
- **2025-06-29**: Removed redundant renderer logger in favor of shared logging 