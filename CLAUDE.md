# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SafeTube is a kid-friendly video player built with Electron, React, and TypeScript. It combines local video files, DLNA streaming, and YouTube content with parental controls and time tracking.

## Development Commands

### Build & Development
```bash
# Start development server
yarn dev

# Build all components
yarn build:all

# Start Electron app in development
yarn electron:dev

# Build and package for production
yarn electron:build
```

### Testing
```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run only unit tests (skip integration tests)
yarn test:unit

# Run only integration tests
yarn test:integration

# Run tests with coverage
yarn test:coverage
```

### Code Quality
```bash
# Run linter
yarn lint

# Fix linting issues
yarn lint:fix

# Type checking
yarn type-check
```

## Architecture

### Core Structure
- **Main Process** (`src/main/`): Electron main process handling IPC, file access, and system integration
- **Renderer Process** (`src/renderer/`): React app with routing, UI components, and video playback
- **Preload Script** (`src/preload/`): Secure bridge between main and renderer processes
- **Shared Code** (`src/shared/`): Common utilities for time tracking, logging, and file operations

### Key Components

#### Video Sources System
SafeTube supports multiple video sources configured in `config/videoSources.json`:
- **YouTube Channels**: Fetches latest videos from configured channels
- **YouTube Playlists**: Displays videos from playlists
- **DLNA/UPnP**: Streams from network media servers
- **Local Files**: Plays local video files

#### Dual YouTube Player System
Two player implementations for different needs:
- **MediaSource Player**: Custom implementation with quality control and language selection
- **YouTube iframe Player**: Native YouTube player with adaptive streaming

Player configuration in `config/youtubePlayer.json` controls:
- Player type selection
- Maximum quality settings (144p to 4K)
- Language preferences
- Fallback behavior

#### Time Tracking System
Comprehensive parental controls with:
- Daily time limits per day of week (`config/timeLimits.json`)
- Usage logging with second-level precision
- Video watching history with resume positions
- Time-up enforcement with automatic navigation

### IPC Communication
Main process exposes APIs through preload script:
- `electron.getLocalFile(filePath)`: Access local video files
- `electron.getDlnaFile(server, port, path)`: Stream DLNA content
- `electron.getVideoStreams(videoId)`: Get YouTube video streams
- `electron.recordVideoWatching(videoId, position, timeWatched)`: Track viewing time
- `electron.getTimeTrackingState()`: Get current time limits and usage
- `electron.getPlayerConfig()`: Load YouTube player configuration

### React Router Structure
- `/`: Main kid-friendly video grid (KidScreen)
- `/player/:id`: Dynamic video player routing (PlayerRouter)
- `/time-up`: Time limit reached page

## Configuration

### Environment Variables
```bash
# YouTube API key (optional)
VITE_YOUTUBE_API_KEY=your_api_key_here

# Enable verbose logging
ELECTRON_LOG_VERBOSE=true
```

### Configuration Files
Located in `config/` directory:
- `videoSources.json`: Video source definitions
- `youtubePlayer.json`: YouTube player settings
- `timeLimits.json`: Daily time limits per day of week
- `usageLog.json`: Usage tracking data (generated)
- `watched.json`: Video history with positions (generated)

## Testing Strategy

### Test Categories
- **Unit Tests**: Business logic, utilities, and components
- **Integration Tests**: YouTube API, DLNA discovery, file system operations
- **CI/CD**: Unit tests + local/DLNA tests (YouTube tests skipped with `CI=true`)

### Test Infrastructure
- **Test Videos**: Sample videos in `test-videos/` for reliable testing
- **Mock Services**: Electron API mocks for renderer testing
- **Caching**: YouTube API responses cached for consistent test results

### Running Tests
Integration tests require actual network access and external services. Use environment variables or CI flag to control test execution:

```bash
# Full test suite (includes YouTube integration)
yarn test

# CI-safe tests only
CI=true yarn test
```

## Project-Specific Notes

### YouTube Integration
- Uses YouTube Data API v3 for metadata
- Custom stream extraction with quality filtering
- Language-based audio track selection
- Handles both combined and separate video/audio streams

### Security Considerations
- All file paths use placeholders in configuration
- No hardcoded API keys or sensitive data
- Secure IPC communication with context isolation
- CORS handling for external video sources

### Video Quality Management
Quality settings directly impact performance:
- `720p`/`1080p`: Recommended for most systems
- `480p`/`360p`: Better for slower connections
- `1440p`/`2160p`: May cause stuttering on some systems

### DLNA/UPnP Support
- Automatic network discovery
- Configurable server endpoints
- Folder-based content filtering
- HTTP streaming with CORS handling

## Common Development Tasks

### Adding New Video Sources
1. Update `config/videoSources.json` with new source definition
2. Implement source handler in `src/renderer/services/`
3. Add routing logic in `PlayerRouter.tsx`
4. Update video grid loading in `KidScreen.tsx`

### Modifying Time Tracking
1. Update types in `src/shared/types.ts`
2. Modify logic in `src/shared/timeTracking.ts`
3. Update IPC handlers in `src/main/main.ts`
4. Adjust UI components for time display

### YouTube Player Configuration
1. Modify `config/youtubePlayer.json` for settings
2. Update `src/renderer/services/playerConfig.ts` for logic
3. Test with various video qualities and formats
4. Verify language selection and fallback behavior