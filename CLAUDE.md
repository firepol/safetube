# CLAUDE.md

AI agent guidance for working with the SafeTube project.

## Project Overview

SafeTube is a kid-friendly video player built with Electron, React, and TypeScript. It combines YouTube content and local video files with parental controls and time tracking.

## Essential References

- **@README.md** - Main project overview and setup instructions
- **@package.json** - Available npm/yarn commands
- **@docs/development-tracking.md** - Current project status and feature progress
- **@docs/specifications.md** - Complete technical specifications and architecture
- **@docs/prds/** - Feature-specific Product Requirements Documents
- **@.cursor/rules/** - Development workflow and code quality guidelines

## Quick Reference

### Development Commands
```bash
yarn dev              # Start development server
yarn electron:dev     # Start Electron app in development
yarn test            # Run all tests
yarn lint            # Run linter
yarn type-check      # Type checking
```

### Key Architecture
- **Main Process** (`src/main/`): Electron IPC, file access, system integration
- **Renderer Process** (`src/renderer/`): React UI, video playback
- **Preload Script** (`src/preload/`): Secure main-renderer bridge
- **Shared Code** (`src/shared/`): Common utilities and types

### Configuration Files (`config/`)
- `videoSources.json` - Video source definitions
- `youtubePlayer.json` - Player settings and quality control
- `timeLimits.json` - Daily time limits and parental controls
- `usageLog.json` - Usage tracking data (generated)
- `watched.json` - Video history and resume positions (generated)
- `mainSettings.json`: Main app settings (generated)

## Development Guidelines

Follow the Cursor rules in `@.cursor/rules/` for:
- **Code Quality**: Electron architecture patterns, testable design
- **Code Style**: TypeScript best practices, React patterns
- **Git Operations**: Automatic commits, message format
- **Testing**: Comprehensive test requirements
- **Security**: Input validation, error handling

## Working on Features

1. **Check current status** in `@docs/development-tracking.md`
2. **Read relevant PRD** in `@docs/prds/` for feature requirements
3. **Follow Cursor rules** for code quality and workflow
4. **Run tests** before committing changes
5. **Update documentation** when adding new features

## Testing Strategy

- **Unit Tests**: Components, utilities, business logic
- **Integration Tests**: YouTube API, file system, video playback
- **CI Environment**: Use `CI=true yarn test` to skip YouTube tests
- **Test Infrastructure**: Sample videos in `test-videos/`, mocked services

## Key Technical Notes

- **YouTube Integration**: Dual player system (MediaSource + iframe)
- **Time Tracking**: Second-level precision with automatic enforcement
- **Video Sources**: YouTube channels/playlists + local files + DLNA
- **Security**: IPC-only renderer access, no direct filesystem access
- **Environment**: `ELECTRON_LOG_VERBOSE=true` for debug logging

For detailed information, always reference the specific documentation files mentioned above.

## More rules to follow

- Always write and run tests (or specify what to test if automated tests are impractical), and ensure you run `yarn build:all` before committing changes