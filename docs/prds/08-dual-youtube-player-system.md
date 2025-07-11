# Dual YouTube Player System PRD

## Overview

Implement a dual YouTube player system that allows switching between the existing MediaSource-based player and a new YouTube iframe player. This provides flexibility to choose the best playback method for different scenarios while maintaining backward compatibility and allowing easy A/B testing.

## User Stories

- As a parent, I want to choose between different YouTube player types so that I can optimize for smooth playback vs. feature control
- As a developer, I want to test both player implementations so that I can compare performance and reliability
- As a user, I want smooth video playback without stuttering so that I can enjoy videos without interruption
- As a parent, I want to prevent access to related videos so that my child stays within approved content
- As a system administrator, I want to configure player behavior per video or globally so that I can customize the experience

## Success Criteria

- Users can switch between MediaSource and iframe players via configuration
- YouTube iframe player provides smooth adaptive streaming
- Related video access is prevented in iframe mode
- Existing functionality remains unchanged when using MediaSource player
- Configuration system allows per-video or global player selection
- Both players integrate with existing time tracking system
- Performance comparison data can be collected

## Technical Requirements

### Core Components

1. **Player Configuration System**
   - JSON-based configuration for player type selection
   - Per-video and global configuration options
   - TypeScript interfaces for type safety

2. **YouTube iframe Player**
   - YouTube Player API integration
   - Custom end screen overlay
   - Quality control integration
   - Time tracking integration

3. **Player Router**
   - Configuration-based routing logic
   - Seamless switching between players
   - Error handling and fallback mechanisms

4. **Configuration Management**
   - `youtubePlayer.json` configuration file
   - Player type selection (`iframe` | `mediasource`)
   - Player-specific settings

### Dependencies

- YouTube Player API (external)
- Existing MediaSource implementation (unchanged)
- Existing time tracking system
- Existing video data structures

### Performance Criteria

- iframe player should provide smoother playback than MediaSource
- Configuration switching should be instant
- No performance degradation to existing functionality

## UI/UX Requirements

### Configuration Interface

- Simple JSON configuration file for player selection
- No UI changes required for basic functionality
- Future admin interface can be added later

### Player Experience

- iframe player should look and feel similar to existing player
- Custom end screen overlay for iframe mode
- Quality controls accessible through iframe API
- Time tracking display remains consistent

### Error Handling

- Graceful fallback to MediaSource if iframe fails
- Clear error messages for configuration issues
- Automatic recovery from player failures

## Error Handling and Fallbacks

- If a YouTube video has embedding disabled (embedding set to false), the application should detect this condition when attempting to load the video in the iframe player.
- Upon detection, the app must automatically fall back to the standard MediaSource-based player logic for that video, ensuring continuity of playback and a seamless user experience.
- The UI should display a clear message or indicator to inform the user that the fallback occurred due to embedding restrictions.
- All error handling should be logged for diagnostics and future improvements.

## Testing Requirements

### Unit Tests

- Player configuration loading and validation
- Player router logic
- YouTube iframe API integration
- Configuration type safety

### Integration Tests

- End-to-end video playback with both players
- Time tracking integration with both players
- Configuration switching behavior
- Error handling and fallback scenarios

### Performance Tests

- Playback smoothness comparison
- Memory usage comparison
- Network bandwidth usage comparison

### User Acceptance Tests

- Smooth playback verification
- Related video prevention verification
- Configuration switching verification

## Documentation Requirements

### Code Documentation

- TypeScript interfaces for all new types
- JSDoc comments for all new functions
- Architecture documentation for dual player system

### User Documentation

- Configuration file format documentation
- Player selection guidelines
- Troubleshooting guide for player issues

### Configuration Documentation

- `youtubePlayer.json` schema documentation
- Example configurations for different scenarios
- Migration guide from single player to dual player

## Implementation Plan

### Phase 1: Configuration System (1 hour)
- Create `youtubePlayer.json` configuration file
- Implement configuration loading and validation
- Add TypeScript interfaces for configuration

### Phase 2: YouTube iframe Player (3-4 hours)
- Implement YouTube Player API integration
- Create custom end screen overlay
- Integrate with existing time tracking system
- Add quality control functionality

### Phase 3: Player Router (1-2 hours)
- Implement configuration-based routing
- Add error handling and fallback logic
- Integrate with existing navigation system

### Phase 4: Testing and Documentation (2-3 hours)
- Write comprehensive test suite
- Create configuration documentation
- Performance testing and optimization

## Configuration Schema

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

## File Structure

```
src/renderer/
├── pages/
│   ├── PlayerPage.tsx (existing - unchanged)
│   ├── YouTubePlayerPage.tsx (new)
│   └── PlayerRouter.tsx (new)
├── services/
│   ├── youtube.ts (existing - unchanged)
│   ├── youtubeIframe.ts (new)
│   └── playerConfig.ts (new)
└── types/
    └── playerConfig.ts (new)

config/
└── youtubePlayer.json (new)
```

## Risk Assessment

### Low Risk
- Existing functionality remains unchanged
- Configuration-based approach allows easy rollback
- No breaking changes to existing code

### Medium Risk
- YouTube iframe API dependencies
- Browser compatibility for iframe features
- Performance characteristics of iframe vs MediaSource

### Mitigation Strategies
- Comprehensive testing of both players
- Graceful fallback mechanisms
- Configuration-based feature toggling
- Performance monitoring and comparison

## Success Metrics

- Smooth playback achieved in iframe mode
- Zero breaking changes to existing functionality
- Configuration system working reliably
- Related video prevention working in iframe mode
- Time tracking integration working with both players 