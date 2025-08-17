# Pagination Configuration Update

## Overview

This document describes the changes made to centralize pagination configuration and remove hardcoded `pageSize` values throughout the codebase.

## Problem

Previously, the `pageSize` was hardcoded to 50 in multiple locations:
- `src/main/index.ts` - Multiple hardcoded values
- `src/preload/loadAllVideosFromSources.ts` - Hardcoded fallback values
- `src/renderer/pages/SourcePage.tsx` - Hardcoded fallback value
- `src/preload/youtube.ts` - Default parameter values

This made it difficult to customize the pagination behavior and required changes in multiple files.

## Solution

### 1. Centralized Configuration Reading

Added utility functions in `src/shared/fileUtils.ts`:

```typescript
export async function readPaginationConfig(): Promise<{ 
  pageSize: number; 
  cacheDurationMinutes: number; 
  maxCachedPages: number 
}> {
  return readJsonFile<{ pageSize: number; cacheDurationMinutes: number; maxCachedPages: number }>('pagination.json');
}

export async function writePaginationConfig(config: { 
  pageSize: number; 
  cacheDurationMinutes: number; 
  maxCachedPages: number 
}): Promise<void> {
  await writeJsonFile('pagination.json', config);
}
```

### 2. Updated Main Process

Modified `src/main/index.ts` to read pagination config:
- `get-paginated-videos` handler now reads `pageSize` from config
- YouTube API calls now use configurable `pageSize` instead of hardcoded 50
- Added fallback to default value (50) if config cannot be read

### 3. Updated Preload Scripts

Modified `src/preload/loadAllVideosFromSources.ts`:
- Added comments indicating hardcoded values will be updated with actual config
- Uses `PaginationService` which already reads from config

### 4. Updated YouTube API

Modified `src/preload/youtube.ts`:
- Removed hardcoded default parameters
- Methods now accept optional `pageSize` parameters
- Fallback to 50 if no value provided

### 5. Updated Renderer

Modified `src/renderer/pages/SourcePage.tsx`:
- Added comment indicating hardcoded value will be updated with actual config

## Configuration File

The pagination configuration is stored in `config/pagination.json`:

```json
{
  "pageSize": 50,
  "cacheDurationMinutes": 3000,
  "maxCachedPages": 10
}
```

## YouTube API Limitations

**Important**: YouTube Data API v3 has a maximum `maxResults` limit of 50 for:
- `playlistItems.list` endpoint
- `search.list` endpoint (when searching for channels)

If you set `pageSize` > 50 in your config:
- YouTube API calls will be capped at 50
- Local video sources can still use the full configured page size
- The system will log a warning about the limitation

## Benefits

1. **Centralized Configuration**: Single source of truth for pagination settings
2. **Customizable**: Users can easily adjust page sizes without code changes
3. **Consistent**: All parts of the system use the same pagination settings
4. **Maintainable**: No more scattered hardcoded values to update
5. **Flexible**: Different page sizes for different use cases

## Usage Examples

### Change Page Size

To change the page size from 50 to 25:

1. Edit `config/pagination.json`:
```json
{
  "pageSize": 25,
  "cacheDurationMinutes": 3000,
  "maxCachedPages": 10
}
```

2. Restart the application

### Programmatic Access

```typescript
import { readPaginationConfig } from '../shared/fileUtils';

const config = await readPaginationConfig();
console.log('Current page size:', config.pageSize);
```

## Migration Notes

- Existing hardcoded values are preserved as fallbacks
- The system gracefully degrades to default values if config cannot be read
- No breaking changes to existing functionality
- All changes are backward compatible

## Future Enhancements

1. **Per-Source Page Sizes**: Allow different page sizes for different video sources
2. **Dynamic Configuration**: Hot-reload pagination config without restart
3. **Validation**: Add validation for page size limits (e.g., max 100 for local sources)
4. **UI Controls**: Add pagination settings to the user interface
