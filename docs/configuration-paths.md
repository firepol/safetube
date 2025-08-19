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

### Linux (AppImage, DEB, RPM)
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

## First Run Setup

When you first run a production build of SafeTube:

1. **Create the config directory** in your user data location
2. **Copy your configuration files** from the development `config/` folder
3. **Create a `.env` file** with your API keys and other environment variables

### Example Linux Setup
```bash
# Create config directory
mkdir -p ~/.config/SafeTube/config

# Copy config files from development
cp -r /path/to/safetube/config/* ~/.config/SafeTube/config/

# Create .env file
cp /path/to/safetube/.env ~/.config/SafeTube/
```

### Example Windows Setup
```cmd
# Create config directory
mkdir "%APPDATA%\SafeTube\config"

# Copy config files from development
xcopy "C:\path\to\safetube\config\*" "%APPDATA%\SafeTube\config\" /E /I

# Create .env file
copy "C:\path\to\safetube\.env" "%APPDATA%\SafeTube\"
```

## Environment Variables

The `.env` file should contain:
- `VITE_YOUTUBE_API_KEY`: Your YouTube API key
- `ADMIN_PASSWORD`: Admin access password
- `ELECTRON_LOG_VERBOSE`: Set to `true` for verbose logging

## Automatic Directory Creation

SafeTube will automatically create the necessary directories on first run, but you need to provide the configuration files.

## Troubleshooting

If configuration files are not found:

1. **Check the console output** for the actual path being used
2. **Verify the config directory exists** in the correct location
3. **Ensure file permissions** allow SafeTube to read the files
4. **Check file format** - JSON files must be valid JSON

## Development vs Production Detection

SafeTube automatically detects the environment:
- **Development**: `NODE_ENV=development` (uses project root paths)
- **Production**: Any other value (uses user data directory paths)

You can override this by setting `NODE_ENV` in your environment.
