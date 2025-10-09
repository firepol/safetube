# SafeTube

A safe video player application for kids built with Electron, React, and TypeScript.

## Features

- Kid-friendly video interface
- YouTube integration with content filtering
- Local video file support (requires FFmpeg)
- DLNA/UPnP streaming support
- Time tracking and parental controls
- Video history and resume functionality
- Favorites system with star/unstar functionality
- Cross-platform desktop application

## Quick Start (Windows Users)

### 1. Download SafeTube

1. Download `SafeTube-1.0.0.exe` from the [latest release](https://github.com/firepol/safetube/releases/latest)
2. Create a folder for SafeTube (e.g., `C:\SafeTube\`)
3. Place `SafeTube-1.0.0.exe` in this folder

### 2. Install yt-dlp (Required for YouTube features)

1. Download `yt-dlp.exe` from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases/latest)
2. Place `yt-dlp.exe` in the same folder as `SafeTube-1.0.0.exe`

**Note**: SafeTube will automatically download yt-dlp if it's missing (Windows only).

### 3. Install FFmpeg (Required for local video features)

SafeTube uses FFmpeg and FFprobe for local video processing, duration extraction, and video conversion.

#### Option A: Download Pre-built Binaries (Recommended)

1. Go to [FFmpeg Windows builds](https://www.gyan.dev/ffmpeg/builds/)
2. Download the "release" version (e.g., `ffmpeg-release-essentials.zip`)
3. Extract the zip file
4. Copy `ffmpeg.exe` and `ffprobe.exe` from the `bin` folder
5. Place both files in the same folder as `SafeTube-1.0.0.exe`

#### Option B: Using Chocolatey (if you have it installed)

```cmd
choco install ffmpeg
```

#### Option C: Using Scoop (if you have it installed)

```cmd
scoop install ffmpeg
```

**Note**: SafeTube will automatically detect FFmpeg if it's in the same folder or in your system PATH.

### 4. Get YouTube API Key (Optional but Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Under "Enabled APIs & services" > "+ Enable APIs and services" > Enable the YouTube Data API v3
4. Under "YouTube Data API v3" > Manage > Create credentials (API Key)
5. Copy your API key

### 5. Configure SafeTube

1. Run `SafeTube-1.0.0.exe` for the first time
2. Navigate to the admin area (Parent Access button)
3. Edit the configuration files in your user data directory:

#### YouTube API Configuration

**Primary Method (Recommended)**: Use the Main Settings tab in the admin interface to configure your YouTube API key.
1. Run SafeTube and go to Admin area (Parent Access button)
2. Click on "Main Settings" tab
3. Enter your YouTube API key and save
4. The key is securely stored in `mainSettings.json`

**Environment Variable Fallback** (`.env` file) - *for development/testing only*
**Location**: `%APPDATA%\SafeTube\.env` (e.g., `C:\Users\YourName\AppData\Roaming\SafeTube\.env`)
```bash
# Fallback - only used if Main Settings is not configured
YOUTUBE_API_KEY=your_youtube_api_key_here
```

**Priority**: Main Settings tab → YOUTUBE_API_KEY environment variable → Error message

#### Video Sources (`config/videoSources.json`)
**Location**: `%APPDATA%\SafeTube\config\videoSources.json` (e.g., `C:\Users\YourName\AppData\Roaming\SafeTube\config\videoSources.json`)
```json
{
  "sources": [
    {
      "id": "local-videos",
      "type": "local",
      "path": "C:\\path\\to\\your\\videos",
      "title": "Local Videos"
    }
  ]
}
```

#### Time Limits (`config/timeLimits.json`)
**Location**: `%APPDATA%\SafeTube\config\timeLimits.json` (e.g., `C:\Users\YourName\AppData\Roaming\SafeTube\config\timeLimits.json`)
```json
{
  "Monday": 60,
  "Tuesday": 60,
  "Wednesday": 60,
  "Thursday": 60,
  "Friday": 60,
  "Saturday": 120,
  "Sunday": 120,
  "timeUpMessage": "Time's up for today!"
}
```

**Note**: SafeTube automatically creates these directories and files on first run. If they don't exist, run SafeTube once to generate the default configuration files.

### 6. Run SafeTube

Double-click `SafeTube-1.0.0.exe` to start the application!

## Configuration Guide

### YouTube Player Settings

SafeTube supports configurable video quality settings in `config/youtubePlayer.json`:

| Quality | Resolution | Use Case |
|---------|------------|----------|
| `360p` | 640×360 | Basic streaming |
| `480p` | 854×480 | Standard definition |
| `720p` | 1280×720 | High definition (recommended) |
| `1080p` | 1920×1080 | Full HD (default) |

### Time Tracking

Configure daily time limits in `config/timeLimits.json`:
- Set minutes for each day of the week
- Add warning thresholds
- Customize time-up messages

### Video Sources

Add multiple video sources in `config/videoSources.json`:
- **Local folders**: Browse local video files
- **YouTube channels**: Subscribe to specific channels
- **YouTube playlists**: Follow curated playlists
- **DLNA servers**: Stream from network devices

## Development Setup

### Prerequisites

- Node.js 20+ and Yarn
- YouTube API key (optional, for YouTube features)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/firepol/safetube.git
cd safetube
```

2. Install dependencies:
```bash
yarn install
```

**Windows Users**: If you get a "Permission denied (publickey)" error during `yarn install`, run this command first to configure git to use HTTPS instead of SSH:
```bash
git config --global url."https://github.com/".insteadOf ssh://git@github.com/
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your YouTube API key:

**Option A (Recommended)**: Configure via Main Settings tab in the admin interface:
1. Run `yarn electron:dev`
2. Go to Admin area → Main Settings tab
3. Enter your YouTube API key and save

**Option B (Development Only)**: Use environment variables:
```bash
# Fallback for development/testing
YOUTUBE_API_KEY=your_youtube_api_key_here
```

**Priority**: Main Settings → YOUTUBE_API_KEY environment variable → Error

### Development Commands

```bash
# Start development server
yarn dev

# Run tests (includes YouTube integration tests)
yarn test

# Run tests in CI mode (skips YouTube integration)
CI=true yarn test

# Build web assets only (for development)
yarn build

# Start Electron development server (Linux/macOS)
yarn electron:dev

# Start Electron development server (Windows)
yarn electron:dev:win
```

## Database Management

SafeTube uses SQLite for data storage. The database location depends on the environment:

**Development Mode:**
- Database file is located in the project root: `./safetube.db` (same directory as README.md)

**Production Mode:**
- **Windows**: `%APPDATA%/safetube/data/safetube.db`
- **macOS**: `~/Library/Application Support/safetube/data/safetube.db`
- **Linux**: `~/.config/safetube/data/safetube.db`

### Accessing the Database via Command Line

You can interact with the SQLite database directly using the `sqlite3` command-line tool:

```bash
# Development mode - open the database
sqlite3 ./safetube.db

# Production mode - open the database (Linux example)
sqlite3 ~/.config/safetube/data/safetube.db

# Show all tables
.tables

# Show table structure
.schema videos

# View video records
SELECT id, title, source_id, is_available FROM videos LIMIT 10;

# Check favorites
SELECT v.title, f.date_added
FROM favorites f
JOIN videos v ON f.video_id = v.id
ORDER BY f.date_added DESC;

# View recent watching history
SELECT v.title, vr.position, vr.time_watched, vr.last_watched
FROM view_records vr
JOIN videos v ON vr.video_id = v.id
ORDER BY vr.last_watched DESC
LIMIT 10;

# Show sources
SELECT * FROM sources ORDER BY sort_order;

# Exit sqlite3
.quit
```

### Database Tables

- **`videos`**: Video metadata (title, thumbnail, duration, etc.)
- **`view_records`**: Viewing history and resume positions
- **`favorites`**: User bookmarked videos
- **`sources`**: Video source definitions (YouTube channels, local folders)
- **`youtube_api_results`**: Cached YouTube API responses

## Building Executables

### Building for Distribution

To create distributable executables for different platforms:

```bash
# Build for current platform only (recommended)
yarn electron:build

# Build for specific platforms (cross-compilation)
yarn electron:build --win    # Windows only
yarn electron:build --mac    # macOS only  
yarn electron:build --linux  # Linux only
```

**Output Locations:**
- **Windows**: `release/SafeTube-1.0.0.exe` (NSIS installer) + `release/win-unpacked/SafeTube.exe` (portable)
- **macOS**: `release/SafeTube-1.0.0.dmg` (DMG package)
- **Linux**: `release/SafeTube-1.0.0.AppImage` (AppImage) + `release/linux-unpacked/safetube` (portable)

**Platform-Specific Notes:**
- **Windows**: Creates both an NSIS installer and a portable executable
- **macOS**: Creates a DMG file (requires macOS for building)
- **Linux**: Creates both an AppImage and a portable binary

**Cross-Platform Building:**
- **Best Practice**: Build on the target platform for best results
- **Windows**: Build on Windows for proper code signing and optimization
- **macOS**: Build on macOS for DMG creation and code signing
- **Linux**: Build on Linux for AppImage creation

**Prerequisites for Building:**
- All platforms: Node.js 20+ and Yarn
- Windows: No additional requirements
- macOS: Requires macOS system for DMG creation
- Linux: No additional requirements

**Note**: Cross-compilation (building Windows on Linux) may have limitations with code signing and some Windows-specific features.

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
- **Admin Password**: The default admin password is `paren234`.
  - **Strongly Recommended**: Change the admin password immediately upon first login
  - Navigate to the admin area and update the password to ensure application security

## License

[Add your license here]