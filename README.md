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

- Node.js 18+ and Yarn
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

### Development

```bash
# Start development server
yarn dev

# Run tests
yarn test

# Build for production
yarn build
```

## Security Notes

- The application uses environment variables for sensitive configuration
- Personal file paths and network IPs have been replaced with placeholders
- Update configuration files with your actual paths and IPs before use

## License

[Add your license here] 