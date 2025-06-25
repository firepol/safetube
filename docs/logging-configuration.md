# Logging Configuration

This document explains how to configure logging verbosity for different environments in SafeTube.

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
import { logVerbose } from '../shared/logging';

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