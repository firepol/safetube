# YouTube Player Configuration

This document explains the configuration options for the YouTube player system in SafeTube.

## Configuration File: `youtubePlayer.json`

The YouTube player configuration controls which player type to use and their respective settings.

## Quality Settings

The `maxQuality` setting in the MediaSource configuration controls the maximum video resolution:

### Supported Quality Values

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

### Quality Selection Logic

1. **Available Quality**: The system checks what qualities are available for the video
2. **Quality Filtering**: Only selects streams at or below the configured `maxQuality`
3. **Smart Fallback**: If the exact quality isn't available, selects the highest available quality within the limit
4. **Performance Optimization**: Lower quality settings improve playback smoothness

### Recommended Settings

- **Smooth Playback**: Use `720p` or `1080p` for most scenarios
- **Slow Connections**: Use `480p` or `360p` for better buffering
- **High-End Systems**: Use `1080p` or `1440p` for best quality
- **Avoid 4K**: `2160p`/`4k` may cause stuttering on many systems

## Configuration Options

### MediaSource Player Settings

- `maxQuality`: Maximum video quality (see table above)
- `preferredLanguages`: Array of preferred audio languages (e.g., `["en", "es"]`)
- `fallbackToLowerQuality`: Whether to fallback to lower quality if preferred isn't available
- `bufferSize`: Buffer size in seconds (default: 30)

### iframe Player Settings

- `showRelatedVideos`: Whether to show related videos at the end
- `customEndScreen`: Whether to use custom end screen overlay
- `qualityControls`: Whether to show YouTube quality controls
- `autoplay`: Whether to autoplay videos
- `controls`: Whether to show YouTube controls
- `modestbranding`: Whether to use modest branding
- `rel`: Related videos parameter (0 = disabled, 1 = enabled)
- `fs`: Fullscreen parameter (0 = disabled, 1 = enabled)

### Per-Video Overrides

You can override the global player type for specific videos:

```json
{
  "perVideoOverrides": {
    "videoId1": {
      "youtubePlayerType": "mediasource",
      "reason": "This video works better with MediaSource"
    },
    "videoId2": {
      "youtubePlayerType": "iframe",
      "reason": "This video needs iframe for special features"
    }
  }
}
```

## Example Configuration

```json
{
  "youtubePlayerType": "mediasource",
  "youtubePlayerConfig": {
    "iframe": {
      "showRelatedVideos": false,
      "customEndScreen": false,
      "qualityControls": true,
      "autoplay": true,
      "controls": true,
      "modestbranding": true,
      "rel": 0,
      "fs": 1
    },
    "mediasource": {
      "maxQuality": "1080p",
      "preferredLanguages": ["en"],
      "fallbackToLowerQuality": true,
      "bufferSize": 30
    }
  },
  "perVideoOverrides": {}
}
```

## Troubleshooting

### Stuttering Issues
- Try lowering the `maxQuality` setting
- Start with `720p` and increase if needed
- Avoid `2160p`/`4k` unless you have a high-end system

### Audio Issues
- Check the `preferredLanguages` setting
- Ensure your preferred language is available for the video
- Try different language codes (e.g., `["en", "en-US", "en-GB"]`)

### Performance Issues
- Reduce `bufferSize` for lower memory usage
- Use `fallbackToLowerQuality: true` for better compatibility
- Consider switching to iframe player for better performance 