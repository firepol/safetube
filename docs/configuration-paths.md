# Configuration File Locations

This document explains where SafeTube looks for configuration files in different environments.

## Development Mode

When running SafeTube in development mode (`yarn electron:dev`), configuration files are expected in the project root:

```
safetube/
├── config/
│   ├── timeLimits.json
│   ├── usageLog.json
│   ├── videoSources.json
│   ├── youtubePlayer.json
│   └── ...
├── .env
└── ...
```

## Production Builds (AppImage, Windows Installer, macOS DMG)

When running SafeTube as a built application, configuration files are stored in the user's data directory:

### Linux (AppImage)
- **Config files**: `~/.config/SafeTube/config/`
- **Cache**: `~/.cache/SafeTube/`
- **Logs**: `~/.local/share/SafeTube/logs/`
- **Environment file**: `~/.config/SafeTube/.env`

### Windows (NSIS Installer)
- **Config files**: `%APPDATA%\SafeTube\config\`
- **Cache**: `%APPDATA%\SafeTube\cache\`
- **Logs**: `%APPDATA%\SafeTube\logs\`
- **Environment file**: `%APPDATA%\SafeTube\.env`

### macOS (DMG)
- **Config files**: `~/Library/Application Support/SafeTube/config/`
- **Cache**: `~/Library/Caches/SafeTube/`
- **Logs**: `~/Library/Logs/SafeTube/`
- **Environment file**: `~/Library/Application Support/SafeTube/.env`

## 🚀 **Automatic First-Run Setup (NEW!)**

SafeTube now automatically handles first-time setup! When you first run a production build:

1. **Automatic Directory Creation**: Creates all necessary directories automatically
2. **Config File Copying**: Copies default configuration files from `config.example/` to your user data directory
3. **Environment Setup**: Creates a `.env` file with placeholder values for you to customize
4. **Zero Manual Setup**: No need to manually create directories or copy files!

### What Gets Set Up Automatically

The following configuration files are automatically copied:
- `timeLimits.json` - Time limit settings
- `usageLog.json` - Usage tracking configuration
- `videoSources.json` - Video source definitions
- `youtubePlayer.json` - YouTube player settings
- `watched.json` - Watch history tracking
- `timeExtra.json` - Extra time allowances
- `pagination.json` - Pagination settings

### Environment File

A `.env` file is automatically created with:
- Placeholder for YouTube API key
- Placeholder for admin password
- Default logging settings
- Production mode configuration

## Manual Setup (Legacy - No Longer Required)

> **Note**: Manual setup is no longer required thanks to automatic first-run setup!

If you prefer to manually manage your configuration:

### Linux Users
```bash
# Create config directory
mkdir -p ~/.config/SafeTube/config

# Copy config files from development
cp -r /path/to/safetube/config/* ~/.config/SafeTube/config/

# Create environment file
cp /path/to/safetube/.env ~/.config/SafeTube/
```

### Windows Users
```cmd
# Create config directory
mkdir "%APPDATA%\SafeTube\config"

# Copy config files from development
xcopy "C:\path\to\safetube\config\*" "%APPDATA%\SafeTube\config\" /E /I

# Create environment file
copy "C:\path\to\safetube\.env" "%APPDATA%\SafeTube\"
```

## Environment Variables

The `.env` file should contain:
- `VITE_YOUTUBE_API_KEY`: Your YouTube API key
- `ADMIN_PASSWORD`: Admin access password
- `ELECTRON_LOG_VERBOSE`: Set to `true` for verbose logging

## Automatic Directory Creation

SafeTube automatically creates the necessary directories on first run, so you don't need to provide the configuration files manually.

## Troubleshooting

If configuration files are not found:

1. **Check the console output** for the actual path being used
2. **Verify the config directory exists** in the correct location
3. **Ensure file permissions** allow SafeTube to read the files
4. **Check file format** - JSON files must be valid JSON
5. **Look for FirstRunSetup logs** in the console output

## Development vs Production Detection

SafeTube automatically detects the environment:
- **Development**: `NODE_ENV=development` (uses project root paths)
- **Production**: Any other value (uses user data directory paths)

You can override this by setting `NODE_ENV` in your environment.

## Testing the Setup

You can test the FirstRunSetup functionality using the provided test script:

```bash
node scripts/test-first-run-setup.js
```

This will show you exactly what directories and files would be created in production mode.
