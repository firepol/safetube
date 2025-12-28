# Requirements Document: Source-Level Time Limits

## Introduction

The Source-Level Time Limits feature extends SafeTube's existing time control system by allowing parents to set and enforce daily time limits on individual video sources (YouTube channels, playlists, and local folders) in addition to global daily time limits. When a child reaches a source's daily time limit, playback from that source is blocked, while other sources remain accessible. Parents can grant temporary extensions for individual sources, enabling flexible time management (e.g., "2 extra minutes for this channel").

This feature maintains backward compatibility with the global time limit system while providing granular parental control over content consumption patterns.

## Requirements

### Requirement 1: Per-Source Daily Time Limit Configuration
**User Story:** As a parent, I want to set daily time limits for specific sources so that I can control my child's access to particular channels or folders

#### Acceptance Criteria
1. WHEN viewing the Admin Settings panel THEN the system SHALL display a list of all configured sources
2. WHEN viewing each source THEN the system SHALL display a daily time limit field (in minutes, nullable)
3. WHEN parent enters a time limit value THEN the system SHALL accept values from 0 to 1440 minutes (24 hours)
4. WHEN parent sets limit to 0 or NULL THEN the system SHALL interpret as "no limit for this source"
5. WHEN parent saves source settings THEN the system SHALL persist the daily time limit to the database

### Requirement 2: Source-Level Time Tracking
**User Story:** As the system, I need to accurately track daily watch time for each source so that limits can be enforced

#### Acceptance Criteria
1. WHEN a video from a source is being watched THEN the system SHALL increment that source's daily watch time
2. WHEN watch time is recorded THEN the system SHALL also increment the global daily watch time
3. WHEN daily watch time is calculated THEN the system SHALL round to nearest second for both source and global
4. WHEN a new day begins (midnight local time) THEN the system SHALL reset all source daily watch times
5. WHEN tracking watch time THEN the system SHALL maintain accuracy to within 1 second

### Requirement 3: Dual-Limit Enforcement (Source and Global)
**User Story:** As a parent, I want both source and global limits to be enforced so that I have control at multiple levels

#### Acceptance Criteria
1. WHEN source daily limit is reached THEN the system SHALL block ONLY that source (other sources playable)
2. WHEN global daily limit is reached THEN the system SHALL block ALL sources (source limits still apply)
3. WHEN a video counts toward both limits THEN the system SHALL count it as 1 unit of time for both
4. WHEN enforcing limits THEN the system SHALL pause video and navigate to a "time limit reached" screen
5. WHEN multiple limits block access THEN the system SHALL display which limit was exceeded (source or global)

### Requirement 4: Parent Time Extensions for Sources
**User Story:** As a parent, I want to grant temporary time extensions to specific sources when my child requests more time

#### Acceptance Criteria
1. WHEN a source limit is exceeded THEN the system SHALL display an extension request interface
2. WHEN parent uses the Admin panel THEN the system SHALL provide quick time extension controls per source
3. WHEN parent grants extension THEN the system SHALL accept 1-60 minute increments
4. WHEN extension is granted THEN the system SHALL temporarily increase the daily limit for that source
5. WHEN extension is granted THEN the system SHALL log the extension in the audit trail (date, time, amount, parent name)

### Requirement 5: Visual Feedback and Indicators
**User Story:** As a parent, I want to see clear status of time consumption for each source

#### Acceptance Criteria
1. WHEN viewing the Admin panel source list THEN the system SHALL display remaining time for each source with a limit
2. WHEN source time is used THEN the system SHALL show progress indicator (percentage of daily limit used)
3. WHEN source limit is within 5 minutes THEN the system SHALL display a warning indicator
4. WHEN source has no limit THEN the system SHALL show "Unlimited" status
5. WHEN hovering over time display THEN the system SHALL show timestamp of last reset and limit details

### Requirement 6: Audio Warning at 5 Seconds
**User Story:** As a parent, I want audio notification when a source limit is about to be exceeded

#### Acceptance Criteria
1. WHEN source time remaining equals 5 seconds THEN the system SHALL play a beep sound
2. WHEN beep sounds THEN the system SHALL use the configured system beep (not countdown overlay)
3. WHEN beep plays THEN there SHALL be no visual countdown overlay
4. WHEN source has no limit THEN the system SHALL not play warning beep
5. WHEN beep preference is disabled THEN the system SHALL respect user's audio settings

### Requirement 7: Time Limit Display on Player Page
**User Story:** As a parent, I want to see current time status for the source being watched on the player page

#### Acceptance Criteria
1. WHEN watching a video THEN the system SHALL display source time remaining in player UI
2. WHEN viewing time remaining THEN the system SHALL show format: "X minutes Y seconds remaining"
3. WHEN source has no limit THEN the system SHALL show "Unlimited" instead of time
4. WHEN time remaining changes THEN the system SHALL update display every second
5. WHEN switching between sources THEN the system SHALL update displayed source time correctly

### Requirement 8: Database Persistence and Reliability
**User Story:** As the system, I need to reliably persist source time limits and usage data

#### Acceptance Criteria
1. WHEN source time limit is set THEN the system SHALL store it in the `sources` table `daily_time_limit_minutes` column
2. WHEN daily source usage is tracked THEN the system SHALL store it in the `usage_logs` table or equivalent
3. WHEN source limit data is corrupted THEN the system SHALL recover gracefully (reset to NULL/unlimited)
4. WHEN system restarts THEN the system SHALL restore source limits and current-day usage correctly
5. WHEN database schema is updated THEN the system SHALL perform migration without data loss

### Requirement 9: Integration with Existing Time Systems
**User Story:** As a parent, I want source limits to work seamlessly with existing global limits and features

#### Acceptance Criteria
1. WHEN global and source limits both apply THEN the system SHALL enforce both correctly
2. WHEN source time is tracked THEN the system SHALL integrate with existing watch history
3. WHEN source limit blocks access THEN the system SHALL use same enforcement mechanism as global limits
4. WHEN resuming a blocked source THEN the system SHALL maintain state correctly
5. WHEN exporting usage data THEN the system SHALL include per-source usage information

### Requirement 10: Admin Interface for Source Time Management
**User Story:** As a parent, I want an intuitive interface to manage source time limits and extensions

#### Acceptance Criteria
1. WHEN viewing the Video Sources admin section THEN the system SHALL display daily time limit field for each source
2. WHEN parent clicks "Edit Source" THEN the system SHALL show current limit and allow modification
3. WHEN parent clicks "Grant Extension" THEN the system SHALL display quick extension options (5, 10, 15 min)
4. WHEN extension is granted THEN the system SHALL confirm action and show new time limit temporarily
5. WHEN saving changes THEN the system SHALL validate time limit format before persisting

### Requirement 11: Enforcement Behavior on Limit Reached
**User Story:** As a parent, I want predictable and consistent enforcement when source limits are exceeded

#### Acceptance Criteria
1. WHEN source daily limit is reached THEN the system SHALL immediately pause the current video
2. WHEN limit is reached THEN the system SHALL navigate to /time-up page
3. WHEN /time-up page displays THEN the system SHALL indicate which source/limit was exceeded
4. WHEN child returns to player THEN the system SHALL prevent resuming from that source
5. WHEN extension is granted THEN the system SHALL allow resuming if within extension time

### Requirement 12: Scope Boundaries and Exclusions
**User Story:** As a parent, I understand what is NOT included in this feature

#### Acceptance Criteria
1. WHEN using per-source limits THEN the system SHALL NOT apply different limits by time-of-day (use global for that)
2. WHEN sources are deleted THEN the system SHALL NOT carry over limits to replacement sources
3. WHEN child switches between sources \THEN the system SHALL NOT pause between sources (only when limit reached)
4. WHEN global limit is reached \THEN source extensions SHALL NOT override the global block
5. WHEN calculating usage \THEN the system SHALL NOT include partial-second fractions (round to second level)

## Technical Notes

- Source-level time limits are stored in database `sources.daily_time_limit_minutes` column (nullable INTEGER)
- Daily usage is tracked per source in the `usage_logs` table with source_id association
- Enforcement uses existing /time-up navigation and pause mechanism from global limit system
- Time resets happen daily at midnight local time (same as global limits)
- Watch time is recorded with second-level precision but rounded for comparison
