# CLAUDE.md

AI agent guidance for working with the SafeTube project.

## Project Overview

SafeTube is a kid-friendly video player built with Electron, React, and TypeScript. It combines YouTube content and local video files with parental controls and time tracking.

## Essential References

- **README.md** - Main project overview and setup instructions
- **package.json** - Available npm/yarn commands
- **docs/development-tracking.md** - Current project status and feature progress
- **docs/specifications.md** - Complete technical specifications and architecture
- **docs/prds/** - Feature-specific Product Requirements Documents
- **.cursor/rules/** - Development workflow and code quality guidelines
- **docs/features/** - Feature-specific documentation structured with **requirements.md**, **design.md**, and **tasks.md** details

## Quick Reference

### Development Commands
```bash
yarn dev              # Start development server
yarn electron:dev     # Start Electron app in development
yarn test            # Run fast tests (CI-safe, ~1-2 min)
yarn test:all        # Run ALL tests including slow ones (~10+ min)
yarn test:youtube    # Run YouTube API integration tests (requires API key)
yarn lint            # Run linter
yarn type-check      # Type checking
```

See **@docs/testing-guide.md** for complete testing documentation.

### Key Architecture
- **Main Process** (`src/main/`): Electron IPC, file access, system integration
- **Renderer Process** (`src/renderer/`): React UI, video playback
- **Preload Script** (`src/preload/`): Secure main-renderer bridge
- **Shared Code** (`src/shared/`): Common utilities and types

### Configuration Files (`config/`)
- Video sources are now managed through the admin panel and stored in the SQLite database
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

- **Unit Tests**: Components, utilities, business logic (run with `yarn test`)
- **Integration Tests**: YouTube API tests (run with `yarn test:youtube`, requires API key)
- **CI Environment**: `yarn test` automatically excludes YouTube API tests
- **Test Infrastructure**: Sample videos in `test-videos/`, mocked services
- **Complete Guide**: See **@docs/testing-guide.md** for detailed testing documentation

## Key Technical Notes

- **YouTube Integration**: Dual player system (MediaSource + iframe)
- **Time Tracking**: Second-level precision with automatic enforcement
- **Video Sources**: YouTube channels/playlists + local files (managed via database and admin panel)
- **Security**: IPC-only renderer access, no direct filesystem access
- **Environment**: `ELECTRON_LOG_VERBOSE=true` for debug logging

For detailed information, always reference the specific documentation files mentioned above.

## More rules to follow

- Always write and run tests (or specify what to test if automated tests are impractical), and ensure you run `yarn build:all` before committing changes
- Always auto commit sub-tasks big enough to be meaningful, and use a concise commit message for little changes, add some details for bigger changes
- Do NOT run `yarn lint:fix` unless specifically instructed to do so (you can run `yarn lint` to see lint errors and fix them in the new code you write)