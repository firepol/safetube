# Video Sources and Metadata

This document describes the different video sources supported by SafeTube and their metadata requirements.

## YouTube Videos

YouTube videos provide rich metadata through the YouTube Data API:

### Required Metadata
- `id`: Video ID (e.g., "OGDuutRhN9M")
- `title`: Video title
- `thumbnail`: High-quality thumbnail URL
- `duration`: Video duration in seconds
- `url`: Video URL for embedding

### Additional Metadata
- `description`: Video description
- `channelId`: Channel ID
- `channelTitle`: Channel name
- `definition`: Video quality ("hd" or "sd")
- `dimension`: Video format ("2d" or "3d")
- `madeForKids`: Whether the video is made for kids
- `privacyStatus`: Video privacy status

### Audio Tracks
YouTube videos can have multiple audio tracks (e.g., different languages). The API provides:
- Track information through the `contentDetails` endpoint
- Stream URLs through the `player` endpoint

## Local Files

Local files have limited metadata available:

### Required Metadata
- `id`: Unique identifier
- `title`: File name or custom title
- `url`: File path (e.g., "file:///path/to/video.mp4")
- `duration`: Video duration (if available)

### Challenges
1. **Thumbnails**: Need to generate from video frames
2. **Duration**: Need to read from file metadata
3. **Audio Tracks**: Limited to what's in the file
4. **Format Support**: Depends on browser capabilities

## DLNA Media

DLNA media servers provide basic metadata:

### Required Metadata
- `id`: Unique identifier
- `title`: Media title from server
- `url`: DLNA URL (e.g., "http://server:port/path")
- `server`: DLNA server address
- `port`: DLNA server port
- `path`: Media path on server

### Challenges
1. **Thumbnails**: May not be available
2. **Duration**: May need to be fetched separately
3. **Audio Tracks**: Limited to what's in the file
4. **Format Support**: Depends on server capabilities

## Implementation Notes

### YouTube API
- Use `videos` endpoint for video details
- Use `playlistItems` for playlist videos
- Use `search` endpoint for channel lookup
- Cache responses to avoid rate limits

### Local Files
- Use `ffmpeg` or similar for metadata extraction
- Generate thumbnails on first load
- Cache metadata to avoid repeated extraction

### DLNA
- Use `node-dlna` for server discovery
- Cache server responses
- Handle connection errors gracefully

## Future Improvements

1. **YouTube**:
   - Add support for playlists and channels
   - Implement audio track selection
   - Add video quality selection

2. **Local Files**:
   - Add metadata extraction
   - Generate thumbnails
   - Support more formats

3. **DLNA**:
   - Add server discovery
   - Improve metadata handling
   - Add format support detection 