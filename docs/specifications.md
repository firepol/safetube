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
- On crash/reboot, the app resumes tracking without loss.
- Videos are blocked once the daily quota is reached.

timeUsed.json (example)
{
  "2025-06-02": 24,
  "2025-06-01": 33
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


