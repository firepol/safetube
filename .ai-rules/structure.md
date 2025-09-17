---
title: Project Structure
description: "Defines the codebase organization, file structure, and development workflows."
inclusion: always
---

# SafeTube Project Structure

## Root Directory Organization

```
safetube/
├── .ai-rules/                 # AI agent steering files
├── .cache/                    # Application runtime cache
├── .cursor/                   # Cursor IDE configuration
├── .github/                   # GitHub Actions CI/CD
├── build/                     # Electron build assets
├── config.example/            # Example configuration files
├── dist/                      # Compiled output
├── docs/                      # Project documentation
├── node_modules/              # Dependencies
├── release/                   # Distribution packages
├── scripts/                   # Build and development scripts
├── src/                       # Source code
├── test-videos/              # Sample videos for testing
└── Configuration Files        # See below
```

## Configuration Files (Root Level)

### Build and Package Management
- `package.json` - Dependencies and npm scripts
- `yarn.lock` - Dependency version lock file
- `tsconfig.json` - Main TypeScript configuration
- `tsconfig.main.json` - Main process TypeScript config
- `tsconfig.preload.json` - Preload script TypeScript config
- `tsconfig.shared.json` - Shared code TypeScript config
- `tsconfig.node.json` - Node.js TypeScript config

### Development Tools
- `vite.config.ts` - Vite build configuration
- `vitest.config.ts` - Test runner configuration
- `eslint.config.js` - Code linting rules
- `tailwind.config.js` - CSS utility configuration
- `postcss.config.js` - CSS processing configuration

### Environment and Documentation
- `.env.example` - Environment variables template
- `.gitignore` - Git ignore patterns
- `README.md` - Project overview and setup
- `CLAUDE.md` - AI agent instructions
- `Dockerfile` - CI environment container

## Source Code Architecture (`src/`)

### Main Process (`src/main/`)
**Purpose**: Electron main process - file system, APIs, system integration

```
src/main/
├── main.ts                    # Application entry point
├── index.ts                   # Main process initialization
├── logger.ts                  # Logging system setup
├── appPaths.ts               # File path management
├── fileUtils.ts              # File system utilities
├── firstRunSetup.ts          # Initial configuration setup
├── timeTracking.ts           # Time limit enforcement
├── youtube.ts                # YouTube API integration
├── youtube-api.ts            # YouTube API client
├── youtubeCache.ts           # YouTube response caching
├── downloadManager.ts        # Video download management
├── ytDlpManager.ts           # yt-dlp integration
├── downloadResetService.ts   # Download status management
├── smartPlaybackRouter.ts    # Video player routing
├── thumbnailGenerator.ts     # Thumbnail creation
├── videoCodecUtils.ts        # Video format handling
├── types/                    # Main process type definitions
└── __tests__/               # Main process tests
```

### Preload Script (`src/preload/`)
**Purpose**: Secure bridge between main and renderer processes

```
src/preload/
├── index.ts                  # Main preload entry point
├── types.ts                  # Preload API type definitions
├── utils.ts                  # Preload utility functions
├── logging.ts                # Logging bridge
├── watchedDataUtils.ts       # Video history utilities
├── youtube.ts                # YouTube data processing
├── youtubePageFetcher.ts     # YouTube page data fetching
├── youtubePageCache.ts       # YouTube data caching
├── cached-youtube-sources.ts # YouTube source caching
├── loadAllVideosFromSources.ts # Video loading orchestration
├── localVideoScanner.ts     # Local file scanning
├── paginationService.ts      # Video pagination logic
└── __tests__/               # Preload tests
```

### Renderer Process (`src/renderer/`)
**Purpose**: React UI application - user interface and interactions

```
src/renderer/
├── main.tsx                  # React application entry
├── App.tsx                   # Root React component
├── types.ts                  # Renderer type definitions
├── setupTests.ts            # Test environment setup
├── vite-env.d.ts            # Vite type definitions
├── components/              # React components
├── pages/                   # Application pages
├── hooks/                   # Custom React hooks
├── services/                # Business logic services
├── lib/                     # Utility libraries
└── types/                   # Renderer-specific types
```

### Shared Code (`src/shared/`)
**Purpose**: Common utilities and types used across all processes

```
src/shared/
├── types.ts                  # Shared type definitions
├── logging.ts               # Unified logging system
├── timeTracking.ts          # Time tracking utilities
├── fileUtils.ts             # File operation utilities
├── appPaths.ts              # Path resolution utilities
├── videoSourceUtils.ts      # Video source utilities
├── videoDurationUtils.ts    # Video duration extraction
├── thumbnailUtils.ts        # Thumbnail utilities
├── videoErrorHandling.ts    # Error handling utilities
├── firstRunSetup.ts         # First run setup logic
└── __tests__/               # Shared code tests
```

### Test Infrastructure (`src/test/`)
**Purpose**: Testing utilities and mocks

```
src/test/
├── setup.ts                 # Global test setup
├── logger.test.ts           # Logging system tests
├── mocks/                   # Mock implementations
│   └── electron.ts          # Electron API mocks
└── [various test files]
```

## Component Architecture (`src/renderer/components/`)

### Layout Components (`components/layout/`)
```
layout/
├── Layout.tsx               # Main application layout
├── Header.tsx               # Application header
├── Navigation.tsx           # Navigation components
├── Breadcrumbs.tsx         # Navigation breadcrumbs
└── __tests__/              # Layout component tests
```

### Video Components (`components/video/`)
```
video/
├── VideoGrid.tsx           # Video thumbnail grid
├── VideoCardBase.tsx       # Individual video card
├── VideoPlayer.tsx         # Video playback component
├── TimeDisplay.tsx         # Time tracking display
├── PlayerControls.tsx      # Video player controls
├── CountdownOverlay.tsx    # Time warning overlay
└── __tests__/              # Video component tests
```

### Admin Components (`components/admin/`)
```
admin/
├── AdminPanel.tsx          # Main admin interface
├── VideoSourceManager.tsx  # Source configuration
├── TimeSettings.tsx        # Time limit configuration
├── MainSettings.tsx        # Global settings
└── [other admin components]
```

## Page Architecture (`src/renderer/pages/`)

### Core Pages
```
pages/
├── KidScreen.tsx           # Main kid-friendly homepage
├── Player.tsx              # Video player page
├── TimesUp.tsx             # Time limit reached page
├── SourceView.tsx          # Individual source browsing
├── FolderView.tsx          # Local folder navigation
├── HistoryView.tsx         # Video history display
├── Admin.tsx               # Admin interface
└── __tests__/              # Page component tests
```

## Services Architecture (`src/renderer/services/`)

### Business Logic Services
```
services/
├── youtube.ts              # YouTube video processing
├── youtube-api.ts          # YouTube API client
├── video-urls.ts           # Video URL generation
├── youtubeIframe.ts        # YouTube iframe integration
├── playerConfig.ts         # Player configuration
├── audioWarning.ts         # Audio warning system
└── __tests__/              # Service tests
```

## Hook Architecture (`src/renderer/hooks/`)

### Custom React Hooks
```
hooks/
├── useVideoStatus.ts       # Video watching status
├── usePagination.ts        # Video pagination logic
├── useThumbnailUpdates.ts  # Thumbnail loading updates
├── useDownload.ts          # Video download management
└── [other custom hooks]
```

## Documentation Structure (`docs/`)

### Architecture Documentation
```
docs/
├── architecture/           # System architecture docs
├── operations/            # Operational procedures
├── features/              # Feature-specific documentation
├── schemas/               # Data schema documentation
└── prds/                  # Product Requirements Documents
```

### Product Requirements Documents (`docs/prds/`)
```
prds/
├── 00-project-setup.md        # Project foundation
├── 01-kid-screen.md           # Homepage functionality
├── 02-play-video.md           # Video playback
├── 03-time-tracking.md        # Time management
├── 04-video-history.md        # History tracking
├── 05-configuration.md        # JSON configuration
├── 06-placeholder-thumbnails.md # Thumbnail system
├── 07-git-workflow.md         # Development workflow
├── 08-dual-youtube-player-system.md # Player architecture
├── 09-advanced-video-sources.md # Source management
├── 10-youtube-video-download.md # Download system
├── 11-favorites.md            # Favorites system
└── 12-kidlists-system.md      # Custom playlists
```

## Configuration Management

### Example Configuration (`config.example/`)
```
config.example/
├── timeLimits.json         # Time limit examples
├── usageLog.json           # Usage tracking example
├── watched.json            # Video history example
├── videoSources.json       # Source configuration example
├── youtubePlayer.json      # Player settings example
├── pagination.json         # Pagination preferences
└── mainSettings.json       # Global settings example
```

### Runtime Configuration (`config/` - created at runtime)
- **Location**: User data directory (OS-specific)
- **Purpose**: Actual configuration files used by application
- **Creation**: Copied from examples on first run
- **Backup**: Automatic backups before modifications

## Build and Distribution

### Build Scripts (`scripts/`)
```
scripts/
├── kill-server.sh          # Development server cleanup (Linux/macOS)
├── kill-server.bat         # Development server cleanup (Windows)
├── start-electron.sh       # Electron startup (Linux/macOS)
├── start-electron.bat      # Electron startup (Windows)
└── package.json            # Script-specific dependencies
```

### Distribution Output (`release/`)
```
release/
├── SafeTube-1.0.0.exe      # Windows NSIS installer
├── SafeTube-1.0.0.AppImage # Linux AppImage
├── win-unpacked/           # Windows portable version
├── linux-unpacked/         # Linux portable version
└── [platform-specific files]
```

## Development Workflow Patterns

### File Naming Conventions
- **Components**: PascalCase (e.g., `VideoCard.tsx`)
- **Utilities**: camelCase (e.g., `fileUtils.ts`)
- **Types**: camelCase with interfaces (e.g., `types.ts`)
- **Tests**: `*.test.ts` or `*.test.tsx`
- **Config**: kebab-case (e.g., `tsconfig.json`)

### Import/Export Patterns
```typescript
// Barrel exports for clean imports
export { VideoCard } from './VideoCard';
export { VideoGrid } from './VideoGrid';

// Absolute imports using path mapping
import { Video } from '@/shared/types';
import { logVerbose } from '@/shared/logging';
```

### Code Organization Rules
1. **Single Responsibility**: Each file has one primary purpose
2. **Layer Separation**: No direct imports between main/renderer
3. **Type Safety**: All inter-process communication is typed
4. **Test Collocation**: Tests near the code they test
5. **Documentation**: README files in complex directories

### Development Commands
```bash
# Development workflow
yarn dev                    # Start development server
yarn electron:dev           # Start Electron app
yarn test:watch            # Run tests in watch mode
yarn type-check            # TypeScript validation
yarn lint                  # Code quality check

# Build workflow
yarn build:all             # Build all components
yarn electron:build        # Create distribution packages
yarn test                  # Run full test suite
yarn lint:fix              # Auto-fix linting issues
```

## Testing Strategy Organization

### Test File Organization
- **Unit Tests**: Adjacent to source files (`*.test.ts`)
- **Integration Tests**: In `__tests__/` directories
- **Test Utilities**: In `src/test/` directory
- **Mock Data**: Co-located with tests that use them

### Test Categories
- **Component Tests**: React component behavior
- **Service Tests**: Business logic validation
- **Integration Tests**: File system and API operations
- **E2E Tests**: Full application workflow (future)

### CI/CD Test Execution
- **Local**: Full test suite including YouTube integration
- **CI**: Unit tests + local file tests (YouTube tests skipped)
- **Docker**: Containerized test environment for consistency

## Security Considerations

### File Access Patterns
- **Main Process Only**: All file system operations
- **IPC Validation**: Input validation at process boundaries
- **Path Sanitization**: Prevent directory traversal attacks
- **Sandboxing**: Renderer process has no direct file access

### Content Security
- **YouTube Navigation**: Blocked through multiple mechanisms
- **External Resources**: Limited to essential domains only
- **Input Validation**: All user inputs validated and sanitized
- **Configuration**: JSON schema validation for all config files

This structure provides a clear separation of concerns, maintains security boundaries, and enables efficient development while ensuring the application remains maintainable and testable.