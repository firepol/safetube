# Configuration Setup

This folder contains example configuration files for SafeTube.

## Setup Instructions

1. Copy all files from `config.example/` to `config/`:
   ```bash
   cp -r config.example/* config/
   ```

2. The `config/` folder is gitignored, so your personal data won't be tracked.

## Configuration Files

- `timeLimits.json` - Daily time limits for video watching
- `usageLog.json` - Daily usage tracking data
- `videoSources.json` - Video source configurations
- `watched.json` - History of watched videos with resume positions

## Example Data

The example files contain sample data to show the expected format. You can modify these files according to your preferences after copying them to the `config/` folder. 