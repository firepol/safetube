---
title: Product Vision
description: "Defines the project's core purpose, target users, and main features."
inclusion: always
---

# SafeTube Product Vision

## Core Purpose

SafeTube is a kid-friendly video player application that provides a safe, controlled video viewing environment for children. It combines YouTube content, local video files, and DLNA streaming with comprehensive parental controls and time tracking to ensure safe and limited screen time.

## Target Users

### Primary Users (Kids)
- **Age Range**: 3-12 years old
- **Needs**: Simple, distraction-free video browsing and playback
- **Constraints**: Limited technical knowledge, need safety guardrails
- **Goals**: Watch approved videos within time limits set by parents

### Secondary Users (Parents)
- **Role**: Content curators and time limit administrators
- **Needs**: Complete control over content and viewing time
- **Goals**: Provide safe entertainment while maintaining healthy screen time limits
- **Technical Level**: Varying - from basic to advanced users

## Core Value Propositions

1. **Safety First**: Only whitelisted content is accessible - no accidental exposure to inappropriate material
2. **Time Management**: Automatic enforcement of daily viewing limits with visual and audio warnings
3. **Offline Capability**: Support for local video files removes dependency on internet connection
4. **Unified Experience**: Single interface for YouTube, local files, and DLNA streaming
5. **Resume Functionality**: Never lose progress - videos resume from where they left off
6. **Parental Control**: Complete oversight without constant supervision

## Key Features

### Video Sources
- **YouTube Integration**: Whitelisted channels and playlists only
- **Local Video Files**: Support for personal video collections
- **DLNA Streaming**: Network-attached video servers
- **Downloaded Content**: Offline copies of YouTube videos for uninterrupted viewing

### Time Management System
- **Daily Limits**: Configurable per-day viewing limits (weekdays vs weekends)
- **Real-time Tracking**: Second-precision time tracking during playback
- **Warning System**: Visual countdown and audio alerts before time expires
- **Automatic Enforcement**: Video stops when time limit reached, no exceptions
- **Resume on Next Day**: Interrupted videos appear at top of homepage

### User Experience Features
- **Kid-Friendly Interface**: Large thumbnails, simple navigation, minimal text
- **Video History**: Visual distinction between watched/unwatched content
- **Progress Tracking**: Resume videos from exact stopping point
- **Source Organization**: Videos grouped by source with clear visual hierarchy
- **Breadcrumb Navigation**: Clear path navigation for local folder hierarchies

### Content Management
- **JSON Configuration**: Simple file-based configuration system
- **Source Validation**: Automatic validation of YouTube URLs and local paths
- **Caching System**: Efficient YouTube API usage with intelligent caching
- **Download Management**: Background video downloads with progress tracking

## User Stories

### Kid User Stories
- As a kid, I want to see big video thumbnails so I can easily find videos I want to watch
- As a kid, I want videos to resume where I left off so I don't lose my place
- As a kid, I want to see how much time I have left so I can choose videos accordingly
- As a kid, I want to browse different video sources easily without getting lost
- As a kid, I want clear warnings before my time runs out so I can finish my video

### Parent User Stories
- As a parent, I want to set different time limits for weekdays and weekends
- As a parent, I want to whitelist only specific YouTube channels and playlists
- As a parent, I want to add my own video files to the system
- As a parent, I want time limits enforced automatically without my intervention
- As a parent, I want a simple way to configure the system through files
- As a parent, I want to see what my child has watched and when
- As a parent, I want to download YouTube videos for offline viewing

## Success Criteria

### Safety Metrics
- 100% content control - only whitelisted sources accessible
- Zero unauthorized external navigation from embedded content
- No exposure to related videos or recommendations outside parent control

### Time Management Metrics
- Accurate time tracking within 1-second precision
- 100% enforcement of daily limits across all video types
- Seamless resume functionality with position accuracy
- Clear warning system preventing surprise time-outs

### Usability Metrics
- Kid can navigate independently within 2 clicks to desired video
- Parent can configure new video source in under 5 minutes
- System works reliably offline with local content
- Video playback starts within 3 seconds for local content

### Technical Metrics
- Application starts within 10 seconds on target hardware
- Supports all major video formats through HTML5 and conversion
- Maintains responsive UI during video playback
- Survives system crashes without data loss

## Feature Roadmap Priority

### MVP Features (Completed)
1. Kid Screen with video grid layout
2. Video playback for YouTube, local, and DLNA sources
3. Time tracking with daily limits and enforcement
4. Video history and resume functionality
5. JSON-based configuration system
6. Dual YouTube player system (iframe + MediaSource)
7. Advanced video sources with folder navigation
8. YouTube video download system

### Future Features (Planned)
1. Favorites system with star/unstar functionality
2. Custom playlists (KidLists) and Watch Later
3. Placeholder thumbnail generation
4. Enhanced admin interface
5. Activity rewards system
6. Vacation mode for temporary limit adjustments

## Business Rules

### Time Management Rules
- Time tracking counts actual playback time, not pause time
- Fast forward/rewind counts as real-time (prevents gaming)
- Daily limits reset at midnight local time
- No rollover of unused time between days
- Time limits enforced across all video sources equally

### Content Access Rules
- Only explicitly whitelisted sources are accessible
- No external navigation allowed from embedded content
- Downloaded videos follow same time limit rules as streamed
- Local videos must be in configured directories only

### Data Management Rules
- All configuration stored in human-readable JSON files
- Video progress saved every few seconds during playback
- History maintained indefinitely unless manually cleared
- Backup copies created before configuration changes

## Platform Strategy

### Current Platform Support
- **Primary**: Linux (Electron + React + TypeScript)
- **Secondary**: Windows (with special handling for path formats)
- **Future**: macOS support planned

### Technology Constraints
- Desktop-only application (no mobile/web versions planned)
- Local-first architecture (no cloud dependencies)
- Offline capability required for local content
- YouTube integration requires API key but gracefully degrades

### Security Considerations
- No direct file system access from renderer process
- All file operations through secure IPC channels
- YouTube iframe navigation completely blocked
- Input validation on all configuration files