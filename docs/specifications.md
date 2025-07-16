# Project Specifications – Whitelisted Videos for Kids

This is the central reference document for the architecture, goals, and design choices of the MVP version of the app.

---

## Purpose

A minimal, local-only Electron app with a React frontend that allows kids to browse and watch only videos manually whitelisted by the parent. Videos can be local, served via DLNA, or streamed from specific YouTube channels or playlists. Daily time limits restrict usage, and all configurations are editable manually at first (no admin UI).

---

## Key Principles

- Build UI-first, working MVP before database or full business logic.
- Use clear, minimal JSON files for config and logging.
- Browser-based (Electron), no server, no ffmpeg.
- Kid-focused UX: simple, distraction-free, safe.

---

## Technologies

- **Electron + React**
- **UI Components:** [shadcn/ui](https://ui.shadcn.com) — used for all UI elements (inputs, lists, buttons, etc.)
- Local storage with **JSON files**
- No backend / no database
- No authentication for now (admin area will use hardcoded password)

---

## DevOps / Git Workflow

### CI/CD Pipeline
- **GitHub Actions** for automated testing on each push
- **Custom Docker image** with Node.js and yt-dlp dependencies
- **Test execution** using `yarn test` command
- **Automatic commits** after each code change (see git_operations rule)

### Testing Requirements
- **Unit tests** for all components and utilities
- **Integration tests** for video playback and time tracking
- **Sample video files** included in source control for CI testing
- **Test coverage** reporting and monitoring

### Docker Environment
- **Base image**: Node.js 18+ LTS
- **Dependencies**: yt-dlp, Yarn, Git
- **Build process**: Multi-stage Dockerfile for optimization
- **Caching**: Dependencies cached to speed up builds

---

## Core Screens

### ✅ Kid Screen

- Inspired by the YouTube homepage layout.
- Top row: **Resume last video** if any was interrupted due to time limits.
- Next section(s): **Selected highlights** (e.g. latest from favorite sources – to be defined).
- Then: **List of allowed sources** (e.g. DLNA folder, local folder, YouTube channel or playlist).
- Clicking a source shows its videos:
  - Unwatched videos shown first (sorted as defined per source)
  - Then watched videos (with thumbnails styled differently, e.g. grayed out overlay)
  - Optional toggle to include all videos in a single list, visually distinguishing watched ones.

### 🛠️ Admin Screen (later)

- Password-protected
- Tabbed UI (e.g. Sources, Time Settings, Activities)
- Live form validation

### 📺 Video Player

- Built-in HTML5 video player
- Resume support per video
- Automatically pauses and blocks when daily time is exhausted

### 📆 Activities (planned)

- View for the kid to see daily/weekly educational or physical activities
- Managed via admin panel in future version

---

## Video Sources

Videos are loaded from:

1. **Local folders**
2. **DLNA servers**
3. **YouTube channels**
4. **YouTube playlists**

Each source is defined in the `videoSources.json` config like:

{id: "yt1", type: "youtube_channel", url: "https://www.youtube.com/channel/UCxxxxx", title: "Science For Kids", sortOrder: "newestFirst"}

{id: "ytpl1", type: "youtube_playlist", url: "https://www.youtube.com/playlist?list=PLxxxxxx", title: "My Curated Playlist", sortOrder: "manual"}

{id: "dlna1", type: "dlna", url: "http://192.168.1.3:8200", allowedFolder: "/Kids/Movies", title: "Kids Movies", sortOrder: "alphabetical"}

{id: "local1", type: "local", path: "/Users/paolo/Videos/Kids", title: "Offline Cartoons", sortOrder: "alphabetical"}

- The `sortOrder` key controls display order for that source.
- Only the specified `allowedFolder` or `path` is shown — nothing outside is accessible.

---

## Time Management

- Allowed viewing time per day is defined in `timeLimits.json`, in minutes per weekday:

{monday: 30, tuesday: 30, wednesday: 30, thursday: 30, friday: 30, saturday: 60, sunday: 60}

- Tracked time is saved regularly (every few seconds) to avoid data loss.
- Fast forward and rewind should count toward the daily quota just like normal playback.
  If a child fast-forwards or rewinds a video, the time that elapses during these actions is considered as "watched" and should be added to their daily total.
  Pausing, by contrast, should not contribute to the daily quota.
  For example: if the child fast-forwards 20 minutes of video in 5 seconds, only those 5 seconds should be added to their daily quota — not the 20-minute segment that was skipped.
  Pausing, by contrast, should not contribute to the daily quota.
- On crash/reboot, the app resumes tracking without loss.
- Videos are blocked once the daily quota is reached.

### Time Display

- **Homepage**: Show time remaining in format `X / Y [Z minutes left]` where X is minutes used, Y is daily limit, Z is minutes remaining
- **Real-time updates**: Time display updates in real-time during video playback
- **Warning threshold**: When `Z <= warningThresholdMinutes` (configurable), display time in red
- **Time format**: Display time in mm:ss format (minutes and seconds) for countdown

### Countdown and Audio Feedback

- **Countdown display**: In the last 60 seconds of daily limit, show countdown overlay on video (both full-screen and windowed mode)
- **Countdown appearance**: Large font, gray with opacity, positioned at top of video to avoid disturbing viewing experience
- **Countdown behavior**: Pauses when video is paused, resumes when video resumes
- **Audio warning**: In the last 10 seconds, play system beep (one per second)
- **Audio configuration**: 
  - Use system beep by default
  - Optional custom beep sound file (falls back to system beep if empty/undefined)
  - Configurable via `useSystemBeep` and `customBeepSound` settings

### Time's Up Behavior

- **Video interruption**: When time runs out, immediately stop video playback
- **Full-screen handling**: If in full-screen mode, exit full-screen first
- **Navigation**: Automatically navigate to dedicated "Time's Up" page (not homepage)
- **No exceptions**: Same behavior for short videos - no gaming the system by watching infinite short videos

### Time's Up Page

- **Dedicated page**: Separate route/page for time's up state to maintain clean architecture
- **Schedule display**: Show full weekly schedule with current day in bold and red
- **Time's up message**: Configurable message explaining time limit reached
- **Navigation**: Redirect to this page from any part of app when time is exhausted
- **Future feature**: Snooze option for parents (requires password, specify extra minutes) - not in MVP

### Configuration

timeLimits.json (example)
{
  "monday": 30,
  "tuesday": 30,
  "wednesday": 30,
  "thursday": 30,
  "friday": 30,
  "saturday": 60,
  "sunday": 60
}

timeUsed.json (example)
{
  "2025-06-02": 24,
  "2025-06-01": 33
}

Additional time tracking configuration:
{
  "timeUpMessage": "Time's up for today! Here's your schedule:",
  "countdownWarningSeconds": 60,
  "audioWarningSeconds": 10,
  "warningThresholdMinutes": 3,
  "useSystemBeep": true,
  "customBeepSound": ""
}

---

## JSON Configuration Files

The application uses a simple JSON-based configuration system for all settings and data persistence. All configuration files are stored in the `config/` directory with example files provided in `config.example/`.

### ✅ Implemented Configuration Files

#### Time Limits (`timeLimits.json`)
Defines daily viewing time limits in minutes for each day of the week:

```json
{
  "Monday": 30,
  "Tuesday": 30,
  "Wednesday": 30,
  "Thursday": 30,
  "Friday": 30,
  "Saturday": 90,
  "Sunday": 90
}
```

#### Usage Log (`usageLog.json`)
Tracks daily video watching time in seconds with ISO date strings as keys:

```json
{
  "2025-06-26": 1801.8220000000001,
  "2025-06-25": 123.84300000000003,
  "2024-01-15": 1800
}
```

#### Watch History (`watched.json`)
Records video watching progress and history for resume functionality:

```json
[
  {
    "videoId": "f2_3sQu7lA4",
    "position": 81.739554,
    "lastWatched": "2025-06-26T22:56:40.209Z",
    "timeWatched": 346.31499999999994
  }
]
```

#### Video Sources (`videoSources.json`)
Defines available video sources (YouTube channels, playlists, DLNA servers, local folders):

```json
[
  {
    "id": "yt1",
    "type": "youtube_channel",
    "url": "https://www.youtube.com/channel/UCxxxxx",
    "title": "Science For Kids",
    "sortOrder": "newestFirst"
  },
  {
    "id": "dlna1",
    "type": "dlna",
    "url": "http://192.168.1.100:8200",
    "allowedFolder": "/Kids/Movies",
    "title": "Kids Movies",
    "sortOrder": "alphabetical"
  }
]
```

### Configuration Management

- **File Structure**: All config files use TypeScript interfaces for type safety
- **Error Handling**: Robust file reading/writing with backup mechanisms
- **Example Files**: `config.example/` directory provides templates for new installations
- **Validation**: Configuration validation functions ensure data integrity
- **Backup**: Automatic backup creation before file modifications
- **Persistence**: All data survives app crashes and restarts

### Future Configuration Enhancements

- **Countdown Settings**: Configuration for countdown warning seconds and audio feedback
- **Warning Thresholds**: Configurable time remaining thresholds for UI warnings
- **Custom Messages**: Configurable Time's Up messages and notifications
- **Admin UI**: Future web-based configuration interface (not in MVP)

---

## Dual YouTube Player System

The application supports two different YouTube player implementations to provide flexibility and optimal performance for different scenarios.

### Player Types

#### MediaSource Player (Existing)
- **Technology**: Custom MediaSource API implementation
- **Advantages**: Full control over video experience, no external dependencies
- **Disadvantages**: Manual buffering, potential stuttering, complex implementation
- **Use Case**: When maximum control over the video experience is required

#### YouTube iframe Player (New)
- **Technology**: YouTube Player API with iframe embedding
- **Advantages**: Smooth adaptive streaming, optimized buffering, reliable playback
- **Disadvantages**: Limited control over related videos, external API dependency
- **Use Case**: When smooth playback is prioritized over feature control

### Configuration

#### YouTube Player Configuration (`youtubePlayer.json`)
Controls which player type to use for YouTube videos:

```json
{
  "youtubePlayerType": "iframe",
  "youtubePlayerConfig": {
    "iframe": {
      "showRelatedVideos": false,
      "customEndScreen": true,
      "qualityControls": true,
      "autoplay": true,
      "controls": true
    },
    "mediasource": {
      "maxQuality": "1080p",
      "preferredLanguages": ["en"],
      "fallbackToLowerQuality": true
    }
  },
  "perVideoOverrides": {
    "videoId1": {
      "youtubePlayerType": "mediasource"
    }
  }
}
```

#### Configuration Options

- **`youtubePlayerType`**: Global player selection (`iframe` | `mediasource`)
- **`iframe.showRelatedVideos`**: Disable related videos at end of video
- **`iframe.customEndScreen`**: Use custom end screen overlay
- **`iframe.qualityControls`**: Enable YouTube quality selection controls
- **`mediasource.maxQuality`**: Maximum quality for MediaSource player
- **`mediasource.preferredLanguages`**: Preferred audio languages
- **`perVideoOverrides`**: Override global settings for specific videos

### Player Selection Logic

1. **Global Configuration**: Default player type for all YouTube videos
2. **Per-Video Override**: Specific videos can override global setting
3. **Fallback Mechanism**: If iframe fails, automatically fallback to MediaSource
4. **Error Handling**: Graceful degradation when player initialization fails

### Integration with Existing Systems

#### Time Tracking
- Both players integrate with existing time tracking system
- Real-time updates during video playback
- Resume functionality works with both players

#### Video History
- Watch history and progress tracking work with both players
- Resume positions saved regardless of player type

#### Configuration Management
- Player configuration follows existing JSON file patterns
- TypeScript interfaces ensure type safety
- Backup and validation mechanisms apply to player config

### Performance Characteristics

#### MediaSource Player
- **Loading**: Slower initial load due to stream analysis
- **Playback**: May stutter on high-quality streams
- **Memory**: Lower memory usage
- **Network**: Direct stream access, no external dependencies

#### YouTube iframe Player
- **Loading**: Faster initial load with adaptive streaming
- **Playback**: Smooth playback with quality adaptation
- **Memory**: Higher memory usage due to iframe overhead
- **Network**: YouTube's optimized CDN and adaptive streaming

### Related Video Prevention

#### iframe Player Strategy
- **`rel=0` Parameter**: Disables related videos at end
- **Custom End Screen**: Overlay prevents interaction with YouTube end screen
- **Event Handling**: Detect video end and show custom interface
- **Navigation Control**: Prevent navigation to related videos

#### MediaSource Player Strategy
- **Full Control**: Complete control over video experience
- **Custom Interface**: No YouTube interface elements
- **Navigation Prevention**: No external navigation possible

### Technical Limitation: YouTube iframe Navigation Control

**Important Security Limitation:**

Due to browser security boundaries (the Same-Origin Policy), Electron and all browsers cannot intercept, log, or block navigation or link clicks that occur inside a cross-origin iframe (such as YouTube), except for links that explicitly open a new window or tab (e.g., `target="_blank"` or `window.open`).

- **What this means:**
  - The app cannot track or reroute most in-iframe navigation, such as clicking related videos, channel links, or other YouTube UI elements inside the embedded player.
  - Only new window/tab attempts can be intercepted and handled by Electron’s `setWindowOpenHandler`.
  - This is a fundamental browser security boundary and cannot be bypassed by Electron or any web technology.

- **Implication for SafeTube:**
  - Most navigation within the YouTube iframe (e.g., clicking related videos) cannot be tracked or rerouted internally by the app.
  - Only links that open a new window/tab can be intercepted and handled (e.g., to play a new video internally or block external navigation).
  - This limitation is inherent to all Electron and web-based apps embedding YouTube or other cross-origin content.

- **Workarounds:**
  - The app uses YouTube Player API options (e.g., `rel=0`) and custom overlays to discourage or block related video navigation where possible, but cannot guarantee full prevention due to the above limitation.

### Migration and Testing

#### A/B Testing Support
- Easy switching between players via configuration
- Performance comparison capabilities
- User experience evaluation tools

#### Rollback Strategy
- Configuration-based feature toggling
- No breaking changes to existing functionality
- Immediate fallback to MediaSource if needed

---

## Watch History

- Local history saved in `watchHistory.json`
- Each source tracks watched video IDs/URLs
- Recent watched videos shown on the homepage
- Resume functionality per video
- In source views:
  - Unwatched videos shown first
  - Watched videos shown at the bottom in a distinct section
  - Option to mix watched/unwatched with visual distinction (e.g. grayed-out thumbnails)


watchHistory.json (example)
[
  {
    "videoId": "dlna1:/Movies/ToyStory.mp4",
    "position": 123,
    "lastWatched": "2025-06-02T10:33:00"
  }
]


