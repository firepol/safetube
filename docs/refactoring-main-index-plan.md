# Refactoring Plan: src/main/index.ts

## Overview

The main index file has grown to 3,405 lines with 250 logVerbose statements, making it difficult to maintain. This plan outlines extracting logical modules to separate files while preserving functionality and reducing verbose logging noise.

## Current File Analysis

### File Statistics
- **Lines of code**: 3,405 lines
- **logVerbose statements**: 250 (excessive for debugging)
- **Major function groups**: 80+ functions and IPC handlers
- **Imports**: 20+ dependencies

### Identified Functional Groups

1. **Local Video Management** (lines ~198-615)
   - `scanLocalFolder()`, `getLocalFolderContents()`, `countVideosInFolder()`
   - Extensive logging for folder scanning operations

2. **Thumbnail Management** (lines ~59-195)
   - `scheduleBackgroundThumbnailGeneration()`, `processNextThumbnailInQueue()`
   - `getThumbnailUrl()`, `notifyThumbnailReady()`, `findThumbnailForVideo()`

3. **IPC Handlers** (lines ~750-3400)
   - 50+ IPC handlers for different subsystems
   - Each handler has multiple logVerbose statements

4. **Video Source Loading** (lines ~2523-2726)
   - `loadAllVideosFromSourcesMain()` - massive function
   - Complex logic for YouTube, local, and DLNA sources

5. **DLNA/Network Operations** (lines ~780-824)
   - DLNA discovery and streaming logic

6. **URL Parsing Utilities** (lines ~708-730)
   - YouTube URL parsing functions

## Refactoring Strategy

### Phase 1: Extract Major Modules

#### 1.1 Local Video Service (`src/main/localVideoService.ts`) ✅ **COMPLETED**
**Extract functions:**
- `scanLocalFolder()` ✅
- `getLocalFolderContents()` ✅
- `countVideosInFolder()` ✅
- `countVideosRecursively()` ✅
- `getFlattenedContent()` ✅
- `filterDuplicateVideos()` ✅

**Logging reduction:**
- Keep: Error logging for file access issues ✅
- Remove: Verbose folder scanning logs (lines like "Found video at depth X") ✅
- Keep: Summary logs (total videos found) ✅

**Results:**
- Created `src/main/services/localVideoService.ts` with all local video functions
- Updated `src/main/index.ts` to import from new service
- Applied logging reduction - removed verbose scanning logs, kept error and summary logs
- All functions now use `[LocalVideoService]` prefix instead of `[Main]` in logs
- Type checking and builds pass successfully

#### 1.2 Thumbnail Service (`src/main/thumbnailService.ts`)
**Extract functions:**
- `scheduleBackgroundThumbnailGeneration()`
- `processNextThumbnailInQueue()`
- `getThumbnailUrl()`
- `notifyThumbnailReady()`
- `findThumbnailForVideo()`

**Logging reduction:**
- Keep: Error logging for thumbnail generation failures
- Remove: "Scheduled background thumbnail generation" logs
- Keep: Summary logs when thumbnail ready

#### 1.3 Network Services (`src/main/networkServices.ts`)
**Extract functions:**
- DLNA discovery logic
- Network video streaming handlers
- SSDP client management

**Logging reduction:**
- Keep: Connection errors and network failures
- Remove: Routine DLNA discovery logs
- Keep: Server connection success/failure

#### 1.4 IPC Handler Registry (`src/main/ipcHandlers.ts`)
**Extract all IPC handlers grouped by domain:**
- Video data handlers
- Time tracking handlers
- Admin handlers
- Video source handlers
- Favorites handlers
- Download handlers

**Logging reduction:**
- Keep: Error logging for IPC failures
- Remove: "Handler called successfully" type logs
- Keep: Authentication failures and validation errors

### Phase 2: Extract Utilities

#### 2.1 URL Utilities (`src/main/urlUtils.ts`)
**Extract functions:**
- `extractChannelId()`
- `extractPlaylistId()`
- `resolveUsernameToChannelId()`

#### 2.2 Video Data Service (`src/main/videoDataService.ts`)
**Extract video loading logic:**
- Video data resolution by ID
- Cross-source video lookup
- Video metadata enrichment

### Phase 3: Logging Optimization

#### 3.1 Essential logVerbose to Keep (Debugging Errors)
1. **Authentication failures**: Admin login issues
2. **File access errors**: Local video file not found
3. **API failures**: YouTube API errors, rate limiting
4. **Configuration errors**: Invalid JSON, missing config files
5. **Network errors**: DLNA connection failures
6. **Video processing errors**: Duration extraction failures
7. **IPC communication errors**: Renderer-main communication issues

#### 3.2 logVerbose to Remove (Information Noise)
1. **Routine operations**: "Loading config from...", "Handler called successfully"
2. **Detailed scanning logs**: Every video file found during folder scan
3. **Thumbnail generation steps**: Each step of background thumbnail processing
4. **Navigation logs**: Routine video navigation and switching
5. **Cache operations**: Cache hits/misses unless errors
6. **Routine data merging**: Video data merging operations
7. **Environment logging**: Directory paths and environment setup (lines 43-51)

#### 3.3 Logging Categories and Estimated Reduction
- **Current**: 250 logVerbose statements
- **Keep**: ~75 essential debugging logs
- **Remove**: ~175 informational logs
- **Reduction**: 70% fewer logVerbose statements

## File Structure After Refactoring

```
src/main/
├── index.ts                     (~500 lines - main app setup only)
├── services/
│   ├── localVideoService.ts    (~300 lines)
│   ├── thumbnailService.ts     (~200 lines)
│   ├── networkServices.ts      (~150 lines)
│   ├── videoDataService.ts     (~250 lines)
│   └── ipcHandlerRegistry.ts   (~800 lines)
├── utils/
│   └── urlUtils.ts             (~50 lines)
└── existing files...
```

## Migration Strategy

### Step 1: Extract Utilities (Low Risk)
1. Create `urlUtils.ts` with URL parsing functions
2. Update imports in main file
3. Test functionality

### Step 2: Extract Services (Medium Risk)
1. Create service files one by one
2. Move functions with their dependencies
3. Update imports and test each service
4. Apply logging reduction during move

### Step 3: Extract IPC Handlers (Higher Risk)
1. Group IPC handlers by domain
2. Create handler registry system
3. Test all IPC communication
4. Verify no handlers are missed

### Step 4: Clean Main File (Final Step)
1. Remove extracted code from main file
2. Add service imports
3. Initialize services in app ready handler
4. Final testing and cleanup

## Benefits

### Maintainability
- **Smaller files**: Each module under 300 lines
- **Single responsibility**: Each service has one clear purpose
- **Easier testing**: Isolated functions easier to unit test

### Performance
- **Faster debugging**: 70% fewer verbose logs
- **Cleaner logs**: Focus on actual errors and important events
- **Better startup**: Less logging overhead during initialization

### Developer Experience
- **Easier navigation**: Find relevant code faster
- **Clearer structure**: Logical separation of concerns
- **Reduced cognitive load**: Smaller files easier to understand

## Risk Mitigation

### Testing Strategy
1. **Unit tests**: Create tests for extracted functions
2. **Integration tests**: Verify IPC handlers still work
3. **Manual testing**: Test all video sources and operations
4. **Rollback plan**: Keep backup of original file

### Gradual Migration
- Extract one module at a time
- Test thoroughly after each extraction
- Apply logging reduction gradually
- Maintain backwards compatibility

## Success Criteria

1. **File size reduction**: Main index file under 500 lines
2. **Logging reduction**: Under 75 logVerbose statements total
3. **Functionality preservation**: All features work exactly as before
4. **Test coverage**: All extracted modules have unit tests
5. **Performance improvement**: Faster startup and less log noise

## Timeline Estimate

- **Phase 1**: 2-3 hours (extract major modules)
- **Phase 2**: 1 hour (extract utilities)
- **Phase 3**: 1-2 hours (logging optimization)
- **Testing**: 1 hour (comprehensive testing)
- **Total**: 5-7 hours

This refactoring will transform the unwieldy 3,405-line file into a maintainable modular architecture while significantly reducing logging noise and preserving all functionality.