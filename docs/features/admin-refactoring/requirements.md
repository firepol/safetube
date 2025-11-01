# Requirements Document

## Introduction

SafeTube currently has two separate admin interfaces serving different access modes: AdminPage.tsx (887 lines) for local Electron IPC-based access at `/admin`, and parentAccessPage.html (275 lines) for remote HTTP-based access at `/parent-access`. This creates significant code duplication (~600+ lines), maintenance burden, inconsistent user experiences, and feature gaps. This refactoring unifies both implementations into a single React component system with an abstraction layer that seamlessly handles both IPC and HTTP data access, eliminating duplication while maintaining feature parity for core functionality and gracefully degrading for mode-specific features.

## Problem Statement

**Current Issues**:
- **Code Duplication**: 600+ lines duplicated between AdminPage.tsx and parentAccessPage.html
- **Inconsistent UI**: React (AdminPage) vs vanilla HTML/JS (parent access page) creates divergent user experiences
- **Feature Gaps**: Remote parent access lacks tabs, settings, and advanced features available in Electron admin
- **Maintenance Burden**: Changes must be replicated across two codebases with different technology stacks
- **Technical Debt**: Different patterns for data access (IPC vs HTTP) create cognitive overhead

**User Impact**:
- Parents accessing remotely have inferior experience compared to local access
- Confusion from different layouts and capabilities between access modes
- Potential for bugs due to manual synchronization of logic

## User Personas

### Persona 1: Local Parent Administrator
**Context**: Parent accessing admin panel directly within Electron app at `/admin` route
**Goals**: Manage all aspects of SafeTube (time limits, video sources, settings, moderation)
**Needs**: Full feature access including database-dependent features (search history, wishlist moderation)

### Persona 2: Remote Parent Administrator
**Context**: Parent accessing admin panel via HTTP from phone/tablet at `/parent-access` route
**Goals**: Check time usage, extend time limits, adjust core settings while away from the device
**Needs**: Core time management and settings features, graceful indication of unavailable features

## Requirements

### Requirement 1: Unified Component Architecture
**User Story:** As a developer, I want a single React component tree for both admin access modes, so that I only maintain one UI codebase and ensure consistent user experience.

#### Acceptance Criteria
1. WHEN rendering admin UI for Electron access THEN the system SHALL use shared React components from a unified component tree
2. WHEN rendering admin UI for remote HTTP access THEN the system SHALL use the same shared React components as Electron access
3. WHEN the component tree is modified THEN the system SHALL automatically apply changes to both access modes
4. WHEN comparing visual design between access modes THEN both modes SHALL display identical layouts, colors, typography, and spacing
5. IF a feature is unavailable in remote mode THEN the system SHALL hide or disable the UI element gracefully without breaking the layout

### Requirement 2: Data Access Abstraction Layer
**User Story:** As a developer, I want an abstraction layer that hides IPC vs HTTP differences from components, so that components remain data-source agnostic and maintainable.

#### Acceptance Criteria
1. WHEN a component needs data THEN it SHALL access data through an `IAdminDataAccess` interface
2. WHEN running in Electron mode THEN the system SHALL provide an `IPCAdminDataAccess` implementation using `window.electron.*` calls
3. WHEN running in remote HTTP mode THEN the system SHALL provide an `HTTPAdminDataAccess` implementation using `/api/*` fetch calls
4. WHEN switching between access modes THEN components SHALL NOT require code changes to function correctly
5. WHEN adding a new data operation THEN the developer SHALL implement it once in the interface and twice in the concrete implementations

### Requirement 3: Feature Parity for Core Features
**User Story:** As a parent administrator, I want core time management features to work identically in both local and remote access modes, so that I can manage my child's screen time from anywhere.

#### Acceptance Criteria
1. WHEN accessing Time Management tab THEN both access modes SHALL display identical UI with quick time extension and daily limits forms
2. WHEN adding extra time THEN both access modes SHALL update time state immediately and reflect changes in the UI
3. WHEN modifying daily time limits THEN both access modes SHALL save changes and provide confirmation feedback
4. WHEN viewing current time state THEN both access modes SHALL display time used, time remaining, and limit status
5. WHEN accessing Main Settings tab THEN both access modes SHALL allow editing of all non-database-dependent settings

### Requirement 4: Graceful Feature Degradation
**User Story:** As a remote parent administrator, I want to clearly understand which features are unavailable in remote mode, so that I'm not confused by missing functionality.

#### Acceptance Criteria
1. WHEN accessing remote mode THEN database-dependent tabs (Video Sources, Search History, Wishlist Moderation) SHALL be hidden from navigation
2. WHEN a feature is mode-specific THEN the tab navigation SHALL only show tabs available in the current access mode
3. WHEN attempting to access a remote-unavailable feature THEN the system SHALL NOT show error messages or broken UI elements
4. WHEN viewing feature availability THEN the system SHALL use feature flags to determine visibility and functionality
5. IF a shared component has mode-specific behavior THEN it SHALL detect the access mode via context and adapt gracefully

### Requirement 5: Authentication and Session Management
**User Story:** As a parent administrator, I want secure authentication for both local and remote access, so that only authorized users can access admin features.

#### Acceptance Criteria
1. WHEN accessing admin panel THEN both access modes SHALL require password authentication before showing admin content
2. WHEN authenticating in Electron mode THEN the system SHALL verify password via IPC handler against stored hash
3. WHEN authenticating in remote HTTP mode THEN the system SHALL verify password via POST request to `/api/admin/auth`
4. WHEN authentication fails THEN both modes SHALL display identical error messages and retry mechanisms
5. WHEN authenticated successfully THEN the session SHALL persist until explicit logout or window close

### Requirement 6: Styling and Theme Consistency
**User Story:** As a parent administrator, I want both access modes to look identical, so that I have a consistent and familiar experience regardless of how I access the admin panel.

#### Acceptance Criteria
1. WHEN comparing layouts between modes THEN the system SHALL use identical Tailwind CSS classes for all components
2. WHEN rendering tab navigation THEN both modes SHALL display the same purple gradient header with consistent spacing
3. WHEN displaying forms THEN both modes SHALL use the same input styles, button styles, and spacing
4. WHEN showing messages (errors, success) THEN both modes SHALL use identical styling and positioning
5. WHEN viewing responsive behavior THEN both modes SHALL adapt to screen sizes identically

### Requirement 7: Component State Management
**User Story:** As a developer, I want consistent state management patterns across all admin components, so that state updates are predictable and bugs are minimized.

#### Acceptance Criteria
1. WHEN managing time limits THEN the system SHALL use a `useTimeLimits` custom hook for all CRUD operations
2. WHEN managing time tracking state THEN the system SHALL use a `useTimeTracking` custom hook for fetching and updating state
3. WHEN managing main settings THEN the system SHALL use a `useMainSettings` custom hook for all settings operations
4. WHEN managing authentication THEN the system SHALL use a `useAdminAuth` custom hook for login/logout flows
5. WHEN sharing global state THEN the system SHALL use AdminContext for activeTab, messages, and feature flags

### Requirement 8: Error Handling and User Feedback
**User Story:** As a parent administrator, I want clear error messages and feedback when operations fail, so that I know what went wrong and how to fix it.

#### Acceptance Criteria
1. WHEN a data operation fails THEN the system SHALL display a user-friendly error message in the UI
2. WHEN saving changes THEN the system SHALL show a loading indicator during the operation
3. WHEN an operation succeeds THEN the system SHALL display a success message with auto-dismiss after 3 seconds
4. WHEN network errors occur in HTTP mode THEN the system SHALL show "Connection lost" message with retry option
5. WHEN IPC errors occur in Electron mode THEN the system SHALL log detailed error and show generic user message

### Requirement 9: Testing and Quality Assurance
**User Story:** As a developer, I want comprehensive tests for the refactored admin system, so that regressions are caught early and both access modes work reliably.

#### Acceptance Criteria
1. WHEN running unit tests THEN all custom hooks SHALL have tests covering success and error scenarios
2. WHEN running component tests THEN all tab components SHALL have tests for rendering, data loading, and user interactions
3. WHEN running integration tests THEN both IPC and HTTP data access implementations SHALL have tests against their respective backends
4. WHEN running end-to-end tests THEN critical user flows (login, add time, save settings) SHALL be tested in both modes
5. WHEN code coverage is measured THEN the admin refactoring SHALL achieve >85% coverage

### Requirement 10: Backward Compatibility
**User Story:** As a SafeTube user, I want the admin refactoring to not break any existing functionality, so that my experience remains uninterrupted during the transition.

#### Acceptance Criteria
1. WHEN the refactoring is deployed THEN the `/admin` Electron route SHALL continue to function exactly as before
2. WHEN accessing `/parent-access` HTTP route THEN it SHALL continue to work without breaking changes
3. WHEN using existing IPC handlers THEN they SHALL remain functional and maintain their contracts
4. WHEN using existing HTTP API endpoints THEN they SHALL remain functional and maintain their response formats
5. WHEN time tracking, limits, or settings are modified THEN existing data formats and storage mechanisms SHALL remain unchanged

## Non-Functional Requirements

### Performance
- Component initial render time: <100ms for both access modes
- Data fetch operations: <500ms for IPC calls, <1000ms for HTTP calls
- Tab switching: <50ms transition time
- Form submissions: <200ms response time for IPC, <500ms for HTTP

### Accessibility
- All form inputs must have proper labels and ARIA attributes
- Tab navigation must be keyboard accessible (Tab, Shift+Tab, Arrow keys)
- Error messages must be announced to screen readers
- Color contrast must meet WCAG 2.1 AA standards

### Security
- Authentication state must not leak between components
- HTTP API calls must include proper authentication headers
- Sensitive data (passwords, API keys) must not be logged
- Input validation must occur on both client and server sides

### Maintainability
- Component responsibilities must follow Single Responsibility Principle
- Abstraction layer interfaces must be well-documented with JSDoc
- Code duplication must be eliminated (DRY principle)
- TypeScript must enforce full type safety (no `any` types)

### Scalability
- Adding new tabs must require minimal code changes (<20 lines)
- Adding new settings must not require component restructuring
- Adding new data access methods must only require interface updates

## Constraints and Limitations

### Technical Constraints
- Must use existing React and TypeScript stack
- Must maintain compatibility with existing Electron IPC architecture
- Must maintain compatibility with existing HTTP API architecture
- Cannot modify database schema or data formats
- Cannot break existing admin functionality during transition

### Feature Limitations
- Remote HTTP mode will NOT support database-dependent features:
  - Video Sources tab (requires DatabaseService)
  - Search History tab (requires database queries)
  - Wishlist Moderation tab (requires database queries)
- Remote HTTP mode will NOT support features requiring Electron APIs:
  - File system access (download path selection)
  - App restart functionality
  - Desktop notifications

### Implementation Constraints
- Refactoring must be incremental to allow testing at each phase
- Must maintain existing URL routes (`/admin`, `/parent-access`)
- Must not require database migrations
- Must not break existing tests

## Success Criteria

The admin refactoring is considered successful when:

1. **Code Duplication Eliminated**: <50 lines of duplicated logic between access modes (down from 600+)
2. **Visual Consistency**: Both access modes render identically (verified by visual regression tests)
3. **Feature Parity**: Core features (time management, main settings) work identically in both modes
4. **Test Coverage**: >85% code coverage for all new components and abstraction layer
5. **No Regressions**: All existing admin functionality passes regression tests
6. **Performance**: No degradation in load times or interaction responsiveness
7. **Maintainability**: Adding a new tab requires <20 lines of code across all files
8. **Developer Satisfaction**: Team agrees refactoring improves code clarity and reduces maintenance burden

## Out of Scope

The following are explicitly out of scope for this refactoring:

- Redesigning admin panel UI/UX (visual design remains unchanged)
- Adding new admin features beyond unification
- Modifying database schema or storage mechanisms
- Implementing real-time synchronization between access modes
- Adding authentication tokens or session persistence beyond current implementation
- Implementing HTTPS for remote access
- Adding user roles or permission levels
- Implementing audit logging for admin actions
- Creating a mobile-optimized responsive design (current design is maintained)
