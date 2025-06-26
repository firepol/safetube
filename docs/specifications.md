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


