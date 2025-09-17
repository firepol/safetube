---
title: Technical Architecture
description: "Defines the technical stack, architecture patterns, and implementation guidelines."
inclusion: always
---

# SafeTube Technical Architecture

## Technology Stack

### Core Framework
- **Electron 36+**: Cross-platform desktop application framework
- **React 19+**: UI library with hooks-based architecture
- **TypeScript 5.8+**: Type-safe development with strict compilation
- **Vite 6+**: Fast build tool and development server
- **Node.js 20+**: Runtime for main and preload processes

### UI and Styling
- **Tailwind CSS 3.4+**: Utility-first CSS framework
- **shadcn/ui**: React component library for consistent UI
- **@radix-ui**: Accessible primitive components
- **CSS Grid/Flexbox**: Layout systems for responsive design

### Testing Framework
- **Vitest 3+**: Unit and integration testing
- **React Testing Library**: Component testing utilities
- **jsdom**: DOM simulation for testing
- **Coverage**: Built-in coverage reporting with v8

### Development Tools
- **ESLint 9+**: Code linting with TypeScript support
- **GitHub Actions**: CI/CD pipeline with Docker
- **Concurrently**: Parallel development server management
- **electron-builder**: Application packaging and distribution

## Architecture Overview

### Electron Multi-Process Architecture

SafeTube follows Electron's security best practices with strict process separation:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Main Process  │◄──►│ Preload Script  │◄──►│ Renderer Process│
│   (Node.js)     │    │  (Bridge)       │    │   (React App)   │
│                 │    │                 │    │                 │
│ • File System   │    │ • IPC Bridge    │    │ • UI Components │
│ • YouTube API   │    │ • Type Safety   │    │ • User Events   │
│ • Time Tracking │    │ • Validation    │    │ • Video Display │
│ • Video Sources │    │ • Logging       │    │ • State Mgmt    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Process Responsibilities

#### Main Process (`src/main/`)
- **File System Operations**: All configuration file read/write
- **YouTube API Integration**: Channel/playlist fetching and caching
- **Time Tracking Logic**: Usage monitoring and limit enforcement
- **Video Source Management**: Local folder scanning, DLNA discovery
- **Download Management**: yt-dlp integration for offline videos
- **Security**: Window management and IPC handler registration

#### Preload Script (`src/preload/`)
- **IPC Bridge**: Type-safe communication between main and renderer
- **API Abstraction**: Clean interface for renderer to access main functionality
- **Data Validation**: Input/output validation at process boundary
- **Logging Integration**: Secure logging from renderer to main
- **Environment Variables**: Safe environment data passing

#### Renderer Process (`src/renderer/`)
- **React UI**: Component-based user interface
- **State Management**: Local state with React hooks
- **Video Playback**: HTML5 video and YouTube iframe integration
- **User Interactions**: Event handling and navigation
- **Real-time Updates**: Time tracking display and video progress

## Core Technical Patterns

### Configuration Management Pattern
```typescript
// All configuration follows this pattern:
interface ConfigFile<T> {
  load(): Promise<T>;
  save(data: T): Promise<void>;
  validate(data: unknown): T;
  backup(): Promise<void>;
}

// Examples: TimeLimits, VideoSources, UsageLog, WatchedVideos
```

### IPC Communication Pattern
```typescript
// Type-safe IPC with validation
interface IPCHandler<TInput, TOutput> {
  channel: string;
  handler: (input: TInput) => Promise<TOutput>;
  validator?: (input: unknown) => TInput;
}

// All main/renderer communication uses this pattern
```

### Video Source Abstraction
```typescript
// Unified interface for all video sources
interface VideoSource {
  id: string;
  type: 'youtube_channel' | 'youtube_playlist' | 'local';
  loadVideos(): Promise<Video[]>;
  validateConfig(): ValidationResult;
}
```

### Time Tracking Architecture
```typescript
// Centralized time tracking with multiple update sources
interface TimeTracker {
  startTracking(videoId: string): void;
  updatePosition(position: number): void;
  pauseTracking(): void;
  stopTracking(): Promise<void>;
  checkLimits(): Promise<boolean>;
}
```

## Data Architecture

### JSON-Based Configuration System

All configuration stored in human-readable JSON files:

```
config/
├── timeLimits.json      # Daily time limits per weekday
├── usageLog.json        # Daily time usage tracking
├── watched.json         # Video history and positions
├── videoSources.json    # Video source definitions
├── youtubePlayer.json   # Player configuration
├── mainSettings.json    # Global app settings
└── pagination.json      # Pagination preferences
```

### Type Safety Strategy
- **Zod Schemas**: Runtime validation for all JSON configurations
- **TypeScript Interfaces**: Compile-time type checking
- **Validation Functions**: Input sanitization at process boundaries
- **Error Handling**: Graceful degradation with fallback defaults

### Caching Architecture
```
.cache/
├── youtube/
│   ├── channel-{id}.json    # Channel video caches
│   └── playlist-{id}.json   # Playlist video caches
├── thumbnails/              # Downloaded thumbnail cache
└── conversions/             # Video format conversion cache
```

## Video Playback Architecture

### Dual Player System

SafeTube implements two YouTube player strategies:

#### 1. YouTube iframe Player
```typescript
// Advantages: Smooth playback, adaptive streaming
// Disadvantages: Limited control, requires navigation blocking
interface IframePlayer {
  type: 'iframe';
  features: {
    adaptiveStreaming: true;
    smoothPlayback: true;
    qualityControls: true;
    relatedVideosBlocked: true;
  };
}
```

#### 2. MediaSource Player
```typescript
// Advantages: Full control, no external dependencies
// Disadvantages: Manual buffering, potential quality issues
interface MediaSourcePlayer {
  type: 'mediasource';
  features: {
    fullControl: true;
    customBuffering: true;
    languageSelection: true;
    qualitySelection: true;
  };
}
```

### Video Format Support
- **Web Native**: MP4 (H.264/AAC), WebM (VP8/VP9/Vorbis)
- **Conversion Pipeline**: FFmpeg integration for unsupported formats
- **Streaming Protocols**: HTTP(S), Local file, DLNA/UPnP

## Development Patterns

### Component Architecture
```typescript
// Standardized component structure
interface ComponentPattern {
  // 1. Props interface with strict typing
  props: StrictlyTypedProps;

  // 2. Custom hooks for complex logic
  logic: CustomHook[];

  // 3. Event handlers with proper typing
  handlers: TypedEventHandlers;

  // 4. Conditional rendering patterns
  render: ConditionalJSX;

  // 5. Comprehensive test coverage
  tests: ComponentTests;
}
```

### Error Handling Strategy
```typescript
// Layered error handling approach
interface ErrorHandling {
  // 1. Input validation at boundaries
  validation: ZodSchema;

  // 2. Graceful degradation with fallbacks
  fallbacks: FallbackStrategy;

  // 3. User-friendly error messages
  userMessages: LocalizedErrors;

  // 4. Detailed logging for debugging
  logging: StructuredLogs;
}
```

### Testing Patterns
```typescript
// Comprehensive testing strategy
interface TestingApproach {
  // 1. Unit tests for all business logic
  unit: ComponentLogicTests;

  // 2. Integration tests for file operations
  integration: FileSystemTests;

  // 3. Mock external dependencies
  mocking: ExternalServiceMocks;

  // 4. CI environment adaptations
  ciAdaptation: ConditionalTestSkipping;
}
```

## Security Architecture

### Process Isolation
- **No Node.js in Renderer**: Renderer process has no direct file system access
- **IPC-Only Communication**: All main process access through secure IPC
- **Input Validation**: All IPC inputs validated before processing
- **Minimal API Surface**: Only essential functionality exposed to renderer

### Content Security Policy
```typescript
// Strict CSP prevents external resource loading
const securityPolicy = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  mediaSrc: ["'self'", "blob:", "data:"],
  connectSrc: ["'self'", "https://www.googleapis.com"]
};
```

### YouTube Navigation Prevention
```typescript
// Multi-layer approach to prevent external navigation
interface NavigationSecurity {
  // 1. Electron window open handler
  windowOpenHandler: BlockExternalWindows;

  // 2. IPC-based internal navigation
  internalRouting: SecureVideoNavigation;

  // 3. iframe sandbox restrictions
  sandboxing: IframeSandbox;

  // 4. Custom end screen overlays
  endScreenBlocking: CustomOverlays;
}
```

## Performance Optimization

### Build Optimization
- **TypeScript Compilation**: Separate configs for main, preload, renderer
- **Vite Bundling**: Optimized production builds with tree shaking
- **Electron Distribution**: Platform-specific packaging with electron-builder
- **Asset Optimization**: Image compression and lazy loading

### Runtime Performance
- **Lazy Loading**: Components and data loaded on demand
- **Memoization**: React.memo and useMemo for expensive operations
- **Virtualization**: Large video lists handled with pagination
- **Caching**: Intelligent caching of YouTube API responses

### Memory Management
- **Event Cleanup**: Proper listener removal in useEffect cleanup
- **IPC Handler Cleanup**: Automatic cleanup of main process handlers
- **Video Element Management**: Proper disposal of video elements
- **Cache Size Limits**: Automatic cleanup of old cache entries

## Development Workflow

### Local Development
```bash
# Development server with hot reload
yarn dev                 # Start Vite development server
yarn electron:dev        # Start Electron with React dev server
yarn test:watch          # Run tests in watch mode
yarn type-check          # TypeScript compilation check
```

### Build Process
```bash
# Production build pipeline
yarn build:all           # Build all parts (main, preload, renderer)
yarn electron:build      # Create distributable packages
yarn test                # Run full test suite
yarn lint                # Code quality checks
```

### CI/CD Pipeline
```dockerfile
# Docker-based CI environment
FROM node:20-slim
RUN apt-get update && apt-get install -y yt-dlp git
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn test && yarn build:all
```

## Dependencies Management

### Production Dependencies
- **Core**: Electron, React, TypeScript runtime essentials
- **UI**: Tailwind, Radix UI, shadcn components
- **Video**: Video.js for enhanced playback controls
- **Utils**: dotenv, clsx, zod for configuration and validation

### Development Dependencies
- **Build Tools**: Vite, electron-builder, TypeScript compiler
- **Testing**: Vitest, React Testing Library, jsdom
- **Code Quality**: ESLint, TypeScript ESLint plugins
- **Development**: Concurrently, electron-nightly

### External Tools Integration
- **yt-dlp**: YouTube video downloading (auto-installed on Windows)
- **FFmpeg**: Video format conversion (optional, auto-detected)
- **YouTube API**: Enhanced metadata fetching (optional, graceful fallback)

## Deployment Architecture

### Distribution Strategy
- **Windows**: NSIS installer + portable executable
- **Linux**: AppImage + portable binary
- **macOS**: DMG package (future)

### File System Layout
```
SafeTube/
├── SafeTube.exe           # Main executable
├── resources/             # Electron resources
├── locales/              # Internationalization
└── [user data directory]/
    ├── config/           # Configuration files
    ├── .cache/          # Application cache
    └── logs/            # Application logs
```

### Update Strategy
- **Manual Updates**: Download and replace executable
- **Configuration Migration**: Automatic config file migration
- **Data Preservation**: User data survives updates
- **Rollback Support**: Previous version restoration capability