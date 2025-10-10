# Testing Guide

## Overview

SafeTube uses Vitest for testing. Tests are organized into different categories to optimize development workflow and CI/CD performance.

## Test Commands

### Main Commands

#### `yarn test`
**Fast, CI-safe tests** - Runs all unit tests with mocks, excluding integration tests that require external services.

- **Duration**: ~1-2 minutes
- **What it runs**: Unit tests, mocked tests
- **What it excludes**: YouTube API integration tests
- **Use cases**: Quick feedback during development, CI/CD pipelines
- **CI-safe**: ✅ Yes

```bash
yarn test
```

#### `yarn test:all`
**Complete test suite** - Runs ALL tests including slow integration tests.

- **Duration**: ~10+ minutes
- **What it runs**: Everything
- **Requirements**: May require YouTube API key for some tests
- **Use cases**: Pre-commit validation, comprehensive testing
- **CI-safe**: ⚠️ No (requires API keys)

```bash
yarn test:all
```

#### `yarn test:youtube`
**YouTube API integration tests** - Tests that interact with real YouTube API.

- **Duration**: ~5-8 minutes
- **Requirements**: YouTube API key configured
- **What it runs**:
  - `src/renderer/services/*.integration.test.ts`
  - `src/main/__tests__/youtube-username-resolution.test.ts`
- **Use cases**: Testing YouTube API integration, validating API changes
- **CI-safe**: ❌ No (requires real API key)

```bash
# These tests are automatically skipped in CI environment (process.env.CI)
yarn test:youtube
```

**Setting up YouTube API key for integration tests:**
1. Get a YouTube Data API v3 key from Google Cloud Console
2. Configure it via the Admin Settings tab in the app, OR
3. Set the `YOUTUBE_API_KEY` environment variable

### Specialized Commands

#### `yarn test:database`
Database-related tests.

```bash
yarn test:database
```

#### `yarn test:contract`
IPC contract validation tests.

```bash
yarn test:contract
```

#### `yarn test:watch`
Run tests in watch mode for active development.

```bash
yarn test:watch
```

#### `yarn test:coverage`
Generate test coverage report.

```bash
yarn test:coverage
```

#### `yarn test:ui`
Launch Vitest UI for interactive test exploration.

```bash
yarn test:ui
```

## Test Organization

### Unit Tests
- **Location**: Throughout the codebase alongside source files
- **Pattern**: `*.test.ts`, `*.test.tsx`
- **Characteristics**: Fast, use mocks, no external dependencies
- **Examples**: Component tests, utility tests, service tests with mocks

### Integration Tests
- **Location**: `src/renderer/services/*.integration.test.ts`
- **Pattern**: `*.integration.test.ts`
- **Characteristics**: Slower, may use real external services
- **Special handling**: Automatically skipped in CI via `process.env.CI` check

### YouTube API Tests
Tests that require a real YouTube API key:

1. **`youtube.integration.test.ts`** - Tests real YouTube API calls for video details, streams, playlists, channels
2. **`youtube-username-resolution.test.ts`** - Tests @username to channel ID resolution
3. **`video-urls.integration.test.ts`** - Validates YouTube stream URLs
4. **`youtube.test.ts` (Debug Tests section)** - Video stream verification

### Database Tests
- **Location**: `src/main/database/__tests__/`
- **Run with**: `yarn test:database`
- **Characteristics**: Tests database queries, migrations, schema

### Contract Tests
- **Location**: `__tests__/contracts/`
- **Run with**: `yarn test:contract`
- **Characteristics**: Validates IPC communication contracts

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/test.yml`) runs:

```bash
yarn test
```

This ensures:
- ✅ Fast execution (~1-2 minutes)
- ✅ No external API dependencies
- ✅ Reliable, consistent results
- ✅ No API key requirements

## Development Workflow

### Quick Development Cycle
```bash
# Fast feedback loop
yarn test:watch
```

### Before Committing
```bash
# Run fast tests
yarn test

# If you modified YouTube-related code and have an API key
yarn test:youtube

# Check types
yarn type-check

# Build to ensure everything compiles
yarn build:all
```

### Comprehensive Testing
```bash
# Run everything
yarn test:all
```

## Best Practices

1. **Write unit tests first** - They're faster and easier to maintain
2. **Mock external services** - Use mocks for unit tests, real services only for integration tests
3. **Use `describe.skip` wisely** - For tests that need special setup
4. **Keep tests fast** - Aim for <100ms per unit test
5. **CI environment** - Tests can check `process.env.CI` to skip expensive operations
6. **API keys** - Never commit API keys; use environment variables or app settings

## Troubleshooting

### Tests timing out
- Make sure you're running `yarn test` (not `yarn test:all`)
- Check for infinite loops or missing mocks
- Increase timeout in `vitest.config.ts` if needed (currently 30s)

### YouTube API tests failing
- Verify API key is configured correctly
- Check API quota hasn't been exceeded
- Ensure network connectivity
- Tests are cached to reduce API calls

### Database tests failing
- Make sure test database is initialized
- Check for schema migration issues
- Verify file permissions for SQLite

## Test Cache

YouTube integration tests use a caching mechanism to minimize API calls:
- **Location**: In-memory cache during test runs
- **Purpose**: Avoid hitting API rate limits
- **Stats**: Cache statistics are logged after test completion
