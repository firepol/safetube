# Git Workflow Documentation

## Overview

SafeTube uses GitHub Actions for continuous integration, automatically running tests on each push to ensure code quality and prevent regressions. The workflow is designed for reliability with smart test skipping for external dependencies.

## Workflow Configuration

### GitHub Actions Workflow

The workflow is defined in `.github/workflows/test.yml` and runs:

- **Trigger**: On push to any branch and on pull requests
- **Environment**: Ubuntu latest with Docker support
- **Steps**:
  1. Checkout code
  2. Set up Docker Buildx
  3. Build custom Docker image with CI environment
  4. Run tests in container
  5. Upload test results as artifacts

### Docker Image

The custom Docker image (`Dockerfile`) includes:

- **Base**: Node.js 20 LTS Alpine Linux
- **Environment**: CI=true for test skipping logic
- **Dependencies**: 
  - Python 3 and pip
  - yt-dlp (for YouTube video processing)
  - Git
  - FFmpeg
  - Yarn package manager

### Test Execution

Tests are run using `yarn test` which executes:

- **Unit tests**: Components, utilities, and business logic
- **Integration tests**: Local video files and DLNA functionality
- **Time tracking tests**: All time management functionality
- **Skipped in CI**: YouTube integration tests (run locally only)

### Test Strategy

- **Local Development**: Full test suite including YouTube API integration
- **CI Environment**: Unit tests + local/DLNA tests only (YouTube tests skipped)
- **Reliability**: No external API dependencies in CI to prevent flaky builds

## Environment Configuration

### Environment Variables

Create a `.env` file from the provided template:

```bash
cp .env.example .env
```

Required variables:
- `VITE_YOUTUBE_API_KEY` - YouTube API key for local development (optional)

### CI Environment

The CI environment automatically sets:
- `CI=true` - Enables test skipping logic
- `NODE_ENV=production` - Optimized for testing

## Test Video Files

### Sample Videos

The `test-videos/` directory contains sample video files for testing:

- `sample-local.mp4` - Local video file for testing (generated with test pattern)

### Video Generation Scripts

Two scripts are provided for creating test videos:

```bash
# Generate a test pattern video
./scripts/generate-test-video.sh output.mp4 [duration_in_seconds]

# Optimize a recorded video for testing
./scripts/optimize-test-video.sh input.mp4 output.mp4
```

### Video Configuration

Test videos are referenced in `src/renderer/data/videos.json`:

```json
{
  "id": "test-local-1",
  "type": "local",
  "title": "Test Local Video",
  "url": "file://test-videos/sample-local.mp4"
}
```

## Setup Instructions

### Local Development

1. **Install Dependencies**: `yarn install`
2. **Environment Setup**: `cp .env.example .env`
3. **Run Tests**: `yarn test` (includes YouTube integration tests)

### Docker Testing

1. **Build Image**: `docker build -t safetube-test .`
2. **Run Tests**: `docker run --rm safetube-test yarn test`

### GitHub Repository

1. **Enable Actions**: Ensure GitHub Actions are enabled for the repository
2. **Push Changes**: The workflow will automatically run on pushes
3. **Monitor Results**: Check the Actions tab for test results

## Troubleshooting

### Common Issues

1. **YouTube Test Failures in CI**
   - **Expected**: YouTube integration tests are intentionally skipped in CI
   - **Solution**: Run tests locally to verify YouTube functionality

2. **Test Failures Due to Missing Videos**
   - Ensure sample video files are committed to source control
   - Check that video paths in `videos.json` are correct
   - Use the provided scripts to generate test videos

3. **Docker Build Failures**
   - Verify Docker is running
   - Check for sufficient disk space
   - Ensure all dependencies are available

4. **Environment Variable Issues**
   - Ensure `.env` file exists and is properly configured
   - Check that required variables are set for local development

### Debugging

- **Local Testing**: Run `yarn test` locally to identify issues
- **Docker Logs**: Check Docker build logs for dependency issues
- **GitHub Actions Logs**: Review detailed logs in the Actions tab
- **CI vs Local**: Compare test results between CI and local environments

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Keep Node.js and yt-dlp versions current
2. **Review Test Coverage**: Ensure new features have adequate test coverage
3. **Monitor Performance**: Track test execution time and optimize if needed
4. **Update Test Videos**: Regenerate test videos if needed using provided scripts

### Adding New Tests

1. **Create Test File**: Add test files following existing patterns
2. **Update Video Data**: Add test video entries to `videos.json` if needed
3. **Consider CI Impact**: Use CI skip logic for tests with external dependencies
4. **Commit Changes**: Include test files and video data in commits

## Best Practices

1. **Test Locally First**: Always run tests locally before pushing
2. **Keep Tests Fast**: Avoid long-running tests in CI
3. **Use Sample Data**: Use small, non-copyrighted video files for testing
4. **Skip External Dependencies**: Use CI skip logic for tests requiring external APIs
5. **Document Changes**: Update this documentation when workflow changes
6. **Environment Management**: Use `.env.example` for configuration templates 