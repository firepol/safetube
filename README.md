# SafeTube

A safe video player application for kids built with Electron, React, and TypeScript.

## Features

- Kid-friendly video interface
- YouTube integration with content filtering
- Local video file support
- DLNA/UPnP streaming support
- Time tracking and parental controls
- Cross-platform desktop application

## Setup

### Prerequisites

- Node.js 20+ and Yarn
- YouTube API key (optional, for YouTube features)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd safetube
```

2. Install dependencies:
```bash
yarn install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your environment variables:
```bash
# Add your YouTube API key (optional)
VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
```

### Configuration

Before running the application, update the configuration files with your settings:

1. **Video Sources** (`config/videoSources.json`):
   - Replace `192.168.1.100:8200` with your DLNA server IP
   - Update `/path/to/your/local/videos` with your local video directory path

2. **DLNA Browser Script** (`scripts/dlna-browser.ts`):
   - Replace `192.168.1.100` with your DLNA server IP

### YouTube Player Configuration

SafeTube supports two YouTube player types with configurable quality settings:

#### Player Types

- **MediaSource Player** (Default): Custom implementation with full control
- **YouTube iframe Player** (Future): YouTube's native player with adaptive streaming

#### Quality Settings

The `maxQuality` setting in `youtubePlayer.json` controls the maximum video resolution:

| Quality Value | Resolution | Height | Use Case |
|---------------|------------|--------|----------|
| `144p` | 256×144 | 144px | Very slow connections |
| `240p` | 426×240 | 240px | Slow connections |
| `360p` | 640×360 | 360px | Basic streaming |
| `480p` | 854×480 | 480px | Standard definition |
| `720p` | 1280×720 | 720px | High definition (recommended) |
| `1080p` | 1920×1080 | 1080px | Full HD (default) |
| `1440p` | 2560×1440 | 1440px | 2K resolution |
| `2160p` | 3840×2160 | 2160px | 4K resolution |
| `4k` | 3840×2160 | 2160px | 4K resolution (alias) |

#### Configuration Example

```json
{
  "youtubePlayerType": "mediasource",
  "youtubePlayerConfig": {
    "mediasource": {
      "maxQuality": "1080p",
      "preferredLanguages": ["en"],
      "fallbackToLowerQuality": true
    }
  }
}
```

#### Quality Selection Logic

1. **Available Quality**: The system checks what qualities are available for the video
2. **Quality Filtering**: Only selects streams at or below the configured `maxQuality`
3. **Smart Fallback**: If the exact quality isn't available, selects the highest available quality within the limit
4. **Performance Optimization**: Lower quality settings improve playback smoothness

#### Recommended Settings

- **Smooth Playback**: Use `720p` or `1080p` for most scenarios
- **Slow Connections**: Use `480p` or `360p` for better buffering
- **High-End Systems**: Use `1080p` or `1440p` for best quality
- **Avoid 4K**: `2160p`/`4k` may cause stuttering on many systems

### Development

```bash
# Start development server
yarn dev

# Run tests (includes YouTube integration tests)
yarn test

# Run tests in CI mode (skips YouTube integration)
CI=true yarn test

# Build for production
yarn build
```

## CI/CD Pipeline

SafeTube uses GitHub Actions for continuous integration with a reliable test strategy:

- **Local Development**: Full test suite including YouTube API integration
- **CI Environment**: Unit tests + local/DLNA tests only (YouTube tests skipped)
- **Docker Containerization**: Consistent test environment across platforms
- **Test Video Infrastructure**: Sample videos and generation scripts for reliable testing

### Test Strategy

The project implements smart test skipping to prevent flaky CI builds:
- YouTube integration tests run locally but are skipped in CI
- Local video and DLNA tests run in both environments
- Unit tests for all business logic run everywhere

See [Git Workflow Documentation](docs/git-workflow.md) for detailed information.

## Security Notes

- The application uses environment variables for sensitive configuration
- Personal file paths and network IPs have been replaced with placeholders
- Update configuration files with your actual paths and IPs before use

## License

[Add your license here] 