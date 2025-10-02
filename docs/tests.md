# SafeTube Manual Testing Guide

## Video Playback

### Player - Resume Playback
Play a video, navigate back, then reopen the same video.
**Expected**: Video resumes from the last watched position.

### Player - Completion Tracking
Watch a video to completion (or near the end).
**Expected**: Video marked as watched, shows watched styling.

## Video Library UI

### Clicked Style
Click on a video thumbnail.
**Expected**: Thumbnail shows clicked/selected visual state.

### Watched Style
Play a video until completion.
**Expected**: Watched videos display distinct styling (e.g., checkmark, opacity change).

### Pagination
Scroll through a source with many videos.
**Expected**: Videos load in pages, pagination controls work correctly.

## Favorites

### Add to Favorites
Click the favorite/star button on a video.
**Expected**: Video added to favorites, button shows active state.

### Remove from Favorites
Click the favorite button on an already favorited video.
**Expected**: Video removed from favorites, button shows inactive state.

### Favorites List
Navigate to the Favorites section.
**Expected**: All favorited videos appear, list updates when favorites change.

## History

### History Recording
Watch several videos.
**Expected**: Videos appear in History section in chronological order.

### History Navigation
Click a video from the History list.
**Expected**: Video plays from last watched position.

### History Persistence
Close and reopen the app.
**Expected**: Watch history persists across sessions.

## Parent Access

### PIN Entry
Navigate to Parent Access, enter correct PIN.
**Expected**: Access granted to admin panel.

### PIN Incorrect
Enter incorrect PIN.
**Expected**: Access denied, error message shown.

### Time Limits Configuration
In Parent Access, modify daily time limits.
**Expected**: New limits saved and enforced.

### Source Management
Add/remove/edit video sources in Parent Access.
**Expected**: Changes reflected in main video library.

## Time Tracking

### Daily Limit Enforcement
Watch videos until daily limit reached.
**Expected**: Playback blocked, limit message displayed.

### Time Counter Display
Play a video, observe time counter.
**Expected**: Counter updates in real-time, shows remaining time.

### Reset at Midnight
Test time limit reset (may require date manipulation).
**Expected**: Time limit resets to configured value at midnight.

## Video Sources

### YouTube Source Display
Navigate to a YouTube channel/playlist source.
**Expected**: Videos load and display correctly with thumbnails.

### Local Video Source
Navigate to a local video folder source.
**Expected**: Local videos appear with generated thumbnails.

### Source Switching
Switch between different sources.
**Expected**: Smooth navigation, correct videos for each source.

## Error Handling

### Network Offline
Disable network, attempt to load YouTube videos.
**Expected**: Graceful error message, app remains functional.

### Missing Local Video
Delete a local video file, attempt to play it.
**Expected**: Error message shown, app doesn't crash.

### Corrupted Config
Manually corrupt a config file, restart app.
**Expected**: App recovers with defaults or shows helpful error.
