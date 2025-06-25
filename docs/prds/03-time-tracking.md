# Time Tracking PRD

## Overview
The Time Tracking feature manages and enforces daily viewing time limits for children, with persistent storage of usage data and automatic enforcement of limits across different video sources. Includes real-time countdown, audio feedback, and dedicated time's up page.

## User Stories
- As a parent, I want to set different time limits for each day of the week
- As a parent, I want to know how much time my child has spent watching videos
- As a child, I want to know how much time I have left to watch videos
- As a parent, I want the app to automatically stop videos when time limit is reached
- As a child, I want to see a countdown when my time is almost up
- As a child, I want to hear audio warnings when time is running out
- As a child, I want to see my weekly schedule when time is up

## Success Criteria
- Time limits are properly enforced per day
- Usage data is accurately tracked and persisted
- Time remaining is clearly displayed in X/Y [Z minutes left] format
- Videos stop automatically when limit is reached
- Time tracking survives app crashes/restarts
- Different limits work correctly for different days
- Usage history is maintained accurately
- Fast-forwarding and rewinding time is tracked based on actual elapsed time, not skipped content duration
- Countdown overlay appears in last 60 seconds of daily limit
- Audio warnings play in last 10 seconds
- Dedicated time's up page shows weekly schedule
- Time display updates in real-time during video playback
- Warning threshold triggers red display when time is low

## Technical Requirements
- JSON-based time limit configuration
- Persistent storage of usage data
- Real-time time tracking with mm:ss format for countdown
- Crash recovery mechanism
- Time synchronization between main and renderer processes
- Data validation and error handling
- Backup mechanism for usage data
- Fast-forward and rewind time tracking based on actual elapsed time (e.g., 5 seconds of fast-forwarding counts as 5 seconds of screen time, regardless of how much content was skipped)
- System beep integration with fallback to custom audio files
- Countdown overlay system for video player
- Dedicated time's up page routing
- Configuration for warning thresholds and audio settings

## UI/UX Requirements
- Clear display of time remaining in X/Y [Z minutes left] format
- Visual warning when time is running low (red display when ≤ warningThresholdMinutes)
- Smooth transition when time limit is reached
- Easy-to-read time format (mm:ss for countdown)
- Non-intrusive time display
- Clear messaging when time limit is reached
- Countdown overlay in last 60 seconds (large font, gray with opacity, top of video)
- Audio feedback in last 10 seconds (system beep, one per second)
- Dedicated time's up page with weekly schedule display
- Current day highlighted in bold and red in schedule
- Real-time time updates during video playback
- Full-screen and windowed mode countdown support

## Testing Requirements
- Unit tests for time tracking logic
- Integration tests for limit enforcement
- E2E tests for time tracking scenarios
- Crash recovery testing
- Data persistence testing
- Cross-day transition testing
- Edge case testing (timezone changes, etc.)
- Countdown overlay testing in different video modes
- Audio feedback testing
- Time's up page navigation testing
- Warning threshold display testing
- Real-time update performance testing

## Documentation Requirements
- Time limit configuration guide
- Usage data format documentation
- Time tracking implementation details
- Recovery mechanism documentation
- Troubleshooting guide for time tracking issues
- Countdown and audio feedback configuration
- Time's up page design and navigation
- Warning threshold configuration guide 