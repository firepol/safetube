# MVP Features – Whitelisted Videos for Kids

This document outlines the MVP (Minimum Viable Product) features for the **Whitelisted Videos for Kids** app. It focuses on the most essential functionality required to make the app usable in a basic form, with JSON-based configuration and minimal UI, suitable for early testing and validation.

---

## 1. Kid Screen – Homepage

**Goal**: Create the main screen where the child can browse and play whitelisted videos.

- YouTube-like UI with horizontal sections:
  - First section: *Resume last video* (if a video was interrupted due to time limits).
  - Next sections: Videos grouped by source (e.g. YouTube channel, playlist, DLNA folder).
- Each video shows:
  - Thumbnail (placeholder for now).
  - Title (from metadata or filename).
  - Watched videos appear visually different (e.g. grayscale overlay).
- Sources:
  - YouTube channels.
  - YouTube playlists.
  - Other sources/channels/lists (future).
  - Local folders (e.g. `C:\KidsMedia` must support Windows, MacOS and Linux).
  - MiniDLNA sources (IP, port, and folder path restricted).

---

## 2. Play Video

**Goal**: Enable video playback in kid screen.

- YouTube/Vimeo: use `<iframe>`.
- Local/DLNA: use `<video>` tag.
- Support playback with:
  - Play/pause buttons.
  - Time tracking callbacks for resumption and time consumption.

---

## 3. Time Tracking (JSON-based)

**Goal**: Enforce daily viewing limits.

- External `timeLimits.json` file contains per-day limits (in minutes).
  ```json
  {
    "Monday": 30,
    "Tuesday": 30,
    "Wednesday": 30,
    "Thursday": 30,
    "Friday": 45,
    "Saturday": 90,
    "Sunday": 90
  }
  ```
- Track watched time per day and save to `usageLog.json`.
- Auto-stop playback when limit is reached.
- Persist current video, position, and usage every few seconds to survive crashes.
- Resume feature:
  - When a video is interrupted due to time, it reappears as "Resume last video" at top of homepage.
  - Resume from saved position (rewind by 15 seconds).

### Time Display and UI

- **Homepage time display**: Show `X / Y [Z minutes left]` format where X is minutes used, Y is daily limit, Z is minutes remaining
- **Real-time updates**: Time display updates in real-time during video playback
- **Warning threshold**: When remaining time ≤ `warningThresholdMinutes` (configurable), display time in red
- **Time format**: Display time in mm:ss format (minutes and seconds) for countdown

### Countdown and Audio Feedback

- **Countdown overlay**: In last 60 seconds of daily limit, show countdown on video (both full-screen and windowed)
- **Countdown appearance**: Large font, gray with opacity, positioned at top of video to avoid disturbing viewing
- **Countdown behavior**: Pauses when video is paused, resumes when video resumes
- **Audio warning**: In last 10 seconds, play system beep (one per second)
- **Audio configuration**: Use system beep by default, optional custom sound file with fallback

### Time's Up Behavior

- **Video interruption**: When time runs out, immediately stop video playback
- **Full-screen handling**: If in full-screen mode, exit full-screen first
- **Navigation**: Automatically navigate to dedicated "Time's Up" page (not homepage)
- **No exceptions**: Same behavior for short videos - no gaming the system

### Time's Up Page

- **Dedicated page**: Separate route/page for time's up state to maintain clean architecture
- **Schedule display**: Show full weekly schedule with current day in bold and red
- **Time's up message**: Configurable message explaining time limit reached
- **Navigation**: Redirect to this page from any part of app when time is exhausted

### Additional Configuration

```json
{
  "timeUpMessage": "Time's up for today! Here's your schedule:",
  "countdownWarningSeconds": 60,
  "audioWarningSeconds": 10,
  "warningThresholdMinutes": 3,
  "useSystemBeep": true,
  "customBeepSound": ""
}
```

---

## 4. Video History (Kid View)

**Goal**: Track and display which videos were already watched.

- Maintain a lightweight history file (e.g., `watched.json`) with:
  - Video ID/source
  - Last watched time
  - Time watched (seconds)
- Each source UI (channel/folder) displays:
  - Unwatched videos first.
  - Watched section at the bottom (e.g. "Already watched").
- Style watched videos differently (grayscale, overlay).

---

## 5. Configuration via JSON Files

- No admin UI at this stage.
- Parents edit configuration manually in the following files:
  - `config.json`: contains whitelisted sources and sort order.
  - `timeLimits.json`: time allowed per weekday.
  - `usageLog.json`: written by app with time usage.
  - `watched.json`: video history.
- No password protection or admin area yet.

---

## 6. Placeholder Thumbnails

- For local and MiniDLNA videos, display generic placeholder image.
- Use filename as title.
- No ffmpeg integration yet.

---

## Non-MVP Features (Excluded for Now)

- Admin area
- Vacation mode
- Activity-based rewards
- SQLite
- API key management
- History browsing for parents

---

## Notes

- UI will be built with **React** and **Shadcn UI** components using **Tailwind CSS**.
- Electron-based desktop app.
- Initial platform: Linux (others later).