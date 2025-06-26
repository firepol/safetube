# Git Workflow Documentation

## Overview

SafeTube uses GitHub Actions for continuous integration, automatically running tests on each push to ensure code quality and prevent regressions.

## Workflow Configuration

### GitHub Actions Workflow

The workflow is defined in `.github/workflows/test.yml` and runs:

- **Trigger**: On push to `main` or `develop` branches, and on pull requests
- **Environment**: Ubuntu latest with Docker support
- **Steps**:
  1. Checkout code
  2. Set up Docker Buildx
  3. Build custom Docker image
  4. Run tests in container
  5. Upload test results as artifacts

### Docker Image

The custom Docker image (`Dockerfile`) includes:

- **Base**: Node.js 18 Alpine Linux
- **Dependencies**: 
  - Python 3 and pip
  - yt-dlp (for YouTube video processing)
  - Git
  - FFmpeg
  - Yarn package manager

### Test Execution

Tests are run using `yarn test` which executes:

- Unit tests for components and utilities
- Integration tests for video playback
- Time tracking functionality tests
- Video URL validation tests

## Test Video Files

### Sample Videos

The `test-videos/` directory contains sample video files for testing:

- `sample-local.mp4` - Local video file for testing
- `sample-dlna.mp4` - DLNA video file for testing

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

1. **Install Docker**: Ensure Docker is installed and running
2. **Build Image**: `docker build -t safetube-test .`
3. **Run Tests**: `docker run --rm safetube-test yarn test`

### GitHub Repository

1. **Enable Actions**: Ensure GitHub Actions are enabled for the repository
2. **Push Changes**: The workflow will automatically run on pushes
3. **Monitor Results**: Check the Actions tab for test results

## Troubleshooting

### Common Issues

1. **Test Failures Due to Missing Videos**
   - Ensure sample video files are committed to source control
   - Check that video paths in `videos.json` are correct

2. **Docker Build Failures**
   - Verify Docker is running
   - Check for sufficient disk space
   - Ensure all dependencies are available

3. **yt-dlp Issues**
   - Update yt-dlp version in Dockerfile if needed
   - Check for YouTube API changes

### Debugging

- **Local Testing**: Run `yarn test` locally to identify issues
- **Docker Logs**: Check Docker build logs for dependency issues
- **GitHub Actions Logs**: Review detailed logs in the Actions tab

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Keep Node.js and yt-dlp versions current
2. **Review Test Coverage**: Ensure new features have adequate test coverage
3. **Monitor Performance**: Track test execution time and optimize if needed

### Adding New Tests

1. **Create Test File**: Add test files following existing patterns
2. **Update Video Data**: Add test video entries to `videos.json` if needed
3. **Commit Changes**: Include test files and video data in commits

## Best Practices

1. **Test Locally First**: Always run tests locally before pushing
2. **Keep Tests Fast**: Avoid long-running tests in CI
3. **Use Sample Data**: Use small, non-copyrighted video files for testing
4. **Document Changes**: Update this documentation when workflow changes 