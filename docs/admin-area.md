# Admin Area

This document describes the admin area functionality for parents to manage SafeTube's core features and provide emergency time extensions.

## Overview

The admin area provides password-protected access to parental controls, allowing quick time extensions and configuration management without disrupting the child's experience.

## Authentication

### Password Protection
- Admin access is protected by a password stored in the `.env` file
- Environment variable: `ADMIN_PASSWORD=your_secure_password`
- Password is required for all admin functions
- No session persistence - password must be entered each time

### Security Considerations
- Password is stored as plain text in `.env` file
- No brute force protection implemented
- Password should be changed regularly
- `.env` file should not be committed to version control

## Core Features

### 1. Quick Time Extension
**Purpose**: Allow parents to quickly add or remove extra viewing time for emergencies

**Interface**:
- Numeric input field starting at 10 minutes
- Plus/minus buttons to adjust in 10-minute increments
- Range: -120 to +120 minutes (configurable)
- Support for negative numbers to remove previously added time or reduce daily limits
- Immediate application after confirmation

**Implementation**:
- Extra time is stored in `timeExtra.json`
- Format: `{ "2025-01-15": 15 }` (date -> minutes added/removed)
- Negative values are supported and properly handled
- Time is immediately available for current session
- No restart required

### 2. Time Limits Configuration
**Purpose**: Edit daily viewing limits for each day of the week

**Interface**:
- Form with all weekday time limits
- Input validation (0-1440 minutes per day)
- Save button with confirmation
- Backup creation before changes

**File**: `timeLimits.json`
```json
{
  "Monday": 20,
  "Tuesday": 120,
  "Wednesday": 120,
  "Thursday": 120,
  "Friday": 120,
  "Saturday": 30,
  "Sunday": 20
}
```

**Important**: When editing time limits, only the daily values are updated. Other configuration properties like `timeUpMessage`, `countdownWarningSeconds`, `audioWarningSeconds`, etc. are preserved and not affected by the edit operation.

### 3. Video Sources Management
**Purpose**: Add, edit, and remove video sources

**Interface**:
- List of current sources with edit/delete options
- Add new source form
- Source type selection (YouTube, Local, DLNA)
- Configuration options per source type

**File**: `videoSources.json`
```json
[
  {
    "id": "yt1",
    "type": "youtube_channel",
    "url": "https://www.youtube.com/channel/UCxxxxx",
    "title": "Science For Kids"
  }
]
```

## Time Calculation Logic

### Base Time Limit
- Primary limit from `timeLimits.json` for current day of week
- Stored in minutes, converted to seconds for tracking

### Extra Time Addition
- Additional minutes from `timeExtra.json` for current date
- Added to base limit before conversion to seconds
- Formula: `(baseLimit + extraTime) * 60 = totalSecondsAllowed`

### Usage Tracking
- Current usage from `usageLog.json` in seconds
- Remaining time: `totalSecondsAllowed - timeUsedToday`
- Limit reached when remaining time ≤ 0

## File Structure

### Configuration Files
```
config/
├── timeLimits.json      # Daily time limits per weekday
├── timeExtra.json       # Extra time added per date
├── videoSources.json    # Video source definitions
├── usageLog.json        # Daily usage tracking (auto-generated)
└── watched.json         # Video history (auto-generated)
```

### Example timeExtra.json
```json
{
  "2025-01-15": 15,
  "2025-01-16": 30,
  "2025-01-20": 45
}
```

### Smart Navigation

The admin area includes intelligent exit functionality that automatically returns users to their last watched video location:

- **Last Video Detection**: System reads `watched.json` to find the most recently watched video
- **Source Identification**: Automatically determines which video source contains the video
- **Smart Routing**: Navigates to the appropriate source page and locates the video
- **Fallback Behavior**: If no recent video is found, returns to the homepage
- **Seamless Experience**: No manual navigation required - parent exits and child can immediately continue

This ensures that when a parent adds extra time and exits the admin area, the child can seamlessly continue watching from where they left off.

#### Implementation Details

The smart navigation system works by:

1. **Reading Watch History**: Accesses `watched.json` to find the most recent video entry
2. **Video Source Mapping**: Determines which source (YouTube channel, local folder, DLNA) contains the video
3. **Intelligent Routing**: 
   - For YouTube videos: Identifies by video ID length and finds matching YouTube sources
   - For local files: Parses file paths to determine source folders
   - For DLNA: Maps server information to source configuration
4. **Navigation**: Routes to the appropriate source page (`/source/{sourceId}`)
5. **Fallback**: Returns to homepage if source cannot be determined

#### Current Limitations

- **YouTube Detection**: Currently uses simple heuristics (11-character IDs) for YouTube videos
- **Local File Mapping**: Basic path parsing for local video sources
- **DLNA Support**: Limited to configured DLNA sources in `videoSources.json`

#### Future Enhancements

- **Enhanced Source Mapping**: Create a comprehensive mapping table for video-to-source relationships
- **Smart Page Detection**: Navigate to the specific page within a source where the video is located
- **Resume Position**: Automatically resume video playback from the last watched position
- **Source Validation**: Verify that the detected source still exists and is accessible

## User Experience

### Access Points
- **Primary**: Link from TimeUpPage when time limit is reached
- **Secondary**: Admin button in app header (if implemented)
- **Emergency**: Direct navigation to `/admin` route

### Workflow
1. Parent clicks admin access link
2. Password prompt appears
3. Admin dashboard loads after successful authentication
4. Parent can quickly add time or modify settings
5. Changes take effect immediately
6. Parent clicks the "X" (exit) button to close admin area
7. System intelligently navigates back to the last watched video location
8. Child can continue watching if time was added

### Visual Design
- Clean, professional interface
- Large, easy-to-use controls
- Clear labeling and instructions
- Responsive design for different screen sizes
- Consistent with SafeTube's design language

## Implementation Notes

### Technical Requirements
- React-based admin interface
- Password validation in renderer process
- IPC communication for file operations
- Real-time updates for time extensions
- Error handling and user feedback

### Data Flow
1. Admin interface sends password to main process
2. Main process validates against environment variable
3. On success, admin functions are enabled
4. File operations go through main process IPC handlers
5. Changes are immediately reflected in time tracking

### Error Handling
- Invalid password feedback
- File operation failures
- Validation errors for configuration changes
- Network errors for YouTube operations
- Graceful fallbacks for missing files

## Future Enhancements

### Planned Features
- Session management for admin access
- Audit log of admin actions
- Backup and restore functionality
- Bulk configuration import/export
- Advanced time scheduling (vacation mode)

### Security Improvements
- Password hashing and salting
- Rate limiting for login attempts
- Two-factor authentication
- Admin activity monitoring
- Secure configuration storage

## Configuration Examples

### Environment Variables
```bash
# Admin password (required)
ADMIN_PASSWORD=your_secure_password_here

# Optional: Admin session timeout (minutes)
ADMIN_SESSION_TIMEOUT=30
```

### Time Extension Limits
```json
{
  "maxExtraTimePerDay": 120,
  "maxExtraTimePerWeek": 300,
  "requireReason": false
}
```

## Troubleshooting

### Common Issues
- **Password not working**: Check `.env` file and restart app
- **Changes not taking effect**: Verify file permissions and app restart
- **Time not updating**: Check time tracking service and refresh UI
- **Configuration errors**: Validate JSON syntax and required fields

### Debug Mode
Enable verbose logging to troubleshoot admin operations:
```bash
ELECTRON_LOG_VERBOSE=true yarn electron:dev
```