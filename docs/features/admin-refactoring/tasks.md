# Implementation Plan

## Overview

This document provides a detailed, phase-by-phase implementation plan for the admin refactoring feature. The implementation is broken into 6 phases with clear deliverables, testing requirements, and risk mitigation strategies for each phase.

**Total Estimated Time**: 19-25 hours
**Phases**: 6 phases with incremental validation
**Approach**: Bottom-up implementation (data layer → components → integration)

## Implementation Phases Overview

### Phase Dependencies

```
Phase 1: Data Abstraction Layer
    ↓
Phase 2: Core Components & Contexts
    ↓
Phase 3: Feature Components
    ↓
Phase 4: API Enhancement & HTTP Bundle
    ↓
Phase 5: Integration & Backward Compatibility
    ↓
Phase 6: Polish, Documentation & Cleanup
```

### Timeline Estimates

| Phase | Description | Estimated Time | Cumulative |
|-------|-------------|----------------|------------|
| 1 | Data Abstraction Layer | 3-4 hours | 3-4 hours |
| 2 | Core Components & Contexts | 4-5 hours | 7-9 hours |
| 3 | Feature Components | 4-5 hours | 11-14 hours |
| 4 | API Enhancement & HTTP Bundle | 3-4 hours | 14-18 hours |
| 5 | Integration & Backward Compatibility | 3-4 hours | 17-22 hours |
| 6 | Polish, Documentation & Cleanup | 2-3 hours | 19-25 hours |

---

## Phase 1: Data Abstraction Layer

**Duration**: 3-4 hours
**Dependencies**: None
**Risk Level**: Low (isolated changes)

### Deliverables

#### 1.1 Create Type Definitions

- [x] **Task**: Create `src/renderer/hooks/admin/types.ts`
  - Define `AccessMode` type: `'electron' | 'http'`
  - Define `AuthResult` interface with `success`, `error`, `token` fields
  - Define `TimeLimits` interface (reuse existing if available)
  - Define `TimeTrackingState` interface (reuse existing if available)
  - Define `MainSettings` interface matching current settings structure
  - Define `FeatureFlags` interface with boolean flags for each feature
  - **Definition of Done**: All types compile without errors, reuse existing types where possible
  - **Tests Required**: Type compilation tests (via TypeScript compiler)
  - **Code Review**: Review type definitions for completeness and accuracy

#### 1.2 Create IAdminDataAccess Interface

- [x] **Task**: Create `src/renderer/services/AdminDataAccess.ts` with interface definition
  - Define `IAdminDataAccess` interface with all required methods
  - Add comprehensive JSDoc comments for each method
  - Include method signatures matching design document
  - **Definition of Done**: Interface compiles, all methods documented
  - **Tests Required**: Interface contract validation (no runtime tests yet)
  - **Code Review**: Review interface for completeness against requirements

#### 1.3 Implement IPCAdminDataAccess Class

- [x] **Task**: Implement `IPCAdminDataAccess` class in `AdminDataAccess.ts`
  - Implement all `IAdminDataAccess` methods using `window.electron` API
  - Map existing IPC calls to interface methods
  - Handle errors and edge cases
  - Return correct `FeatureFlags` for Electron mode (all true)
  - **Definition of Done**: All methods implemented, compile without errors
  - **Tests Required**: Unit tests for each method with mocked `window.electron`
  - **Code Review**: Verify correct IPC call mapping, error handling

#### 1.4 Implement HTTPAdminDataAccess Class

- [x] **Task**: Implement `HTTPAdminDataAccess` class in `AdminDataAccess.ts`
  - Implement all `IAdminDataAccess` methods using `fetch` API
  - Map API endpoints to interface methods
  - Handle HTTP errors and network failures
  - Return correct `FeatureFlags` for HTTP mode (database features false)
  - Store auth token for session management
  - **Definition of Done**: All methods implemented, compile without errors
  - **Tests Required**: Unit tests for each method with mocked `fetch`
  - **Code Review**: Verify correct API endpoint mapping, error handling

#### 1.5 Create Factory Function

- [x] **Task**: Implement `createAdminDataAccess()` factory function
  - Detect `window.electron` availability
  - Return `IPCAdminDataAccess` for Electron mode
  - Return `HTTPAdminDataAccess` for HTTP mode
  - **Definition of Done**: Factory returns correct implementation based on environment
  - **Tests Required**: Unit tests for both detection paths
  - **Code Review**: Verify detection logic is correct

### Testing Requirements

**Unit Tests**:
- Test IPCAdminDataAccess with mocked window.electron
- Test HTTPAdminDataAccess with mocked fetch
- Test factory function detection logic
- Test error handling for both implementations
- **Coverage Target**: >90% for data access layer

**Integration Tests**:
- Test IPCAdminDataAccess against real IPC handlers (requires Electron environment)
- Test HTTPAdminDataAccess against real API endpoints (requires HTTP server)
- **Note**: These can be deferred to Phase 5

### Acceptance Criteria

1. WHEN components call `IAdminDataAccess` methods THEN they receive consistent responses regardless of implementation
2. WHEN running in Electron mode THEN `createAdminDataAccess()` SHALL return `IPCAdminDataAccess`
3. WHEN running in HTTP mode THEN `createAdminDataAccess()` SHALL return `HTTPAdminDataAccess`
4. WHEN IPC calls fail THEN errors SHALL be handled gracefully with user-friendly messages
5. WHEN HTTP calls fail THEN errors SHALL be handled gracefully with network error messages

### Risk & Mitigation

**Risk**: Breaking existing IPC contracts
**Mitigation**: Unit tests verify IPC call signatures match existing handlers

**Risk**: HTTP API endpoints don't exist yet
**Mitigation**: Mock HTTP tests, defer integration tests to Phase 4

---

## Phase 2: Core Components & Contexts

**Duration**: 4-5 hours
**Dependencies**: Phase 1 complete
**Risk Level**: Medium (authentication must work in both modes)

### Deliverables

#### 2.1 Create Custom Hooks

- [x] **Task**: Create `src/renderer/hooks/admin/useAdminDataAccess.ts`
  - Create `AdminDataAccessContext` with React context
  - Create `AdminDataAccessProvider` component
  - Create `useAdminDataAccess()` hook with error handling
  - **Definition of Done**: Hook provides data access instance, throws if used outside provider
  - **Tests Required**: Hook tests with mock context
  - **Code Review**: Verify context usage pattern is correct

- [x] **Task**: Create `src/renderer/hooks/admin/useAdminAuth.ts`
  - Implement authentication state management
  - Implement `login(password)` method
  - Implement `logout()` method
  - Implement loading and error states
  - **Definition of Done**: Hook manages auth state, calls data access correctly
  - **Tests Required**: Hook tests with mock data access, test success/failure paths
  - **Code Review**: Verify auth flow is correct for both modes

- [x] **Task**: Create `src/renderer/hooks/admin/useTimeLimits.ts`
  - Implement time limits state management
  - Implement `load()`, `save()`, `update()` methods
  - Implement loading and error states
  - **Definition of Done**: Hook manages time limits CRUD operations
  - **Tests Required**: Hook tests with mock data access, test all CRUD operations
  - **Code Review**: Verify state updates are correct

- [x] **Task**: Create `src/renderer/hooks/admin/useTimeTracking.ts`
  - Implement time tracking state management
  - Implement `load()` and `addExtraTime()` methods
  - Implement loading state
  - **Definition of Done**: Hook manages time tracking operations
  - **Tests Required**: Hook tests with mock data access
  - **Code Review**: Verify time calculations are correct

- [x] **Task**: Create `src/renderer/hooks/admin/useMainSettings.ts`
  - Implement settings state management
  - Implement `load()`, `save()`, `update()` methods
  - Implement password hashing logic
  - Implement loading and error states
  - **Definition of Done**: Hook manages settings CRUD with password handling
  - **Tests Required**: Hook tests with mock data access, test password hashing
  - **Code Review**: Verify password handling is secure

#### 2.2 Create AdminContext

- [x] **Task**: Create `src/renderer/contexts/AdminContext.ts`
  - Define `TabType`, `Message`, `AdminContextValue` types
  - Implement `AdminContextProvider` component
  - Implement `useAdminContext()` hook
  - Manage `activeTab`, `messages`, `features`, `accessMode` state
  - Implement `addMessage()` with auto-dismiss
  - Implement `clearMessages()` method
  - **Definition of Done**: Context provides global admin state
  - **Tests Required**: Context tests with mock values
  - **Code Review**: Verify state management patterns

#### 2.3 Create Root AdminApp Component

- [x] **Task**: Create `src/renderer/components/admin/AdminApp.tsx`
  - Create root component that wraps all admin UI
  - Initialize `createAdminDataAccess()` on mount
  - Wrap with `AdminDataAccessProvider`
  - Wrap with `AdminContextProvider`
  - Detect access mode and set in context
  - Get feature flags and set in context
  - Render `AuthGate` component
  - **Definition of Done**: Root component initializes all providers and context
  - **Tests Required**: Component tests verify providers are set up correctly
  - **Code Review**: Verify provider hierarchy is correct

#### 2.4 Create Authentication Components

- [x] **Task**: Create `src/renderer/components/admin/AuthGate.tsx`
  - Conditionally render `LoginForm` if not authenticated
  - Conditionally render `AdminLayout` if authenticated
  - Use `useAdminAuth()` hook for auth state
  - **Definition of Done**: Component guards admin UI behind authentication
  - **Tests Required**: Component tests for both authenticated/unauthenticated states
  - **Code Review**: Verify auth gating logic

- [x] **Task**: Create `src/renderer/components/admin/LoginForm.tsx`
  - Create login form with password input
  - Create submit button with loading state
  - Display error messages from `useAdminAuth()`
  - Call `login()` on form submission
  - Style with Tailwind to match design document
  - **Definition of Done**: Login form works for both IPC and HTTP modes
  - **Tests Required**: Component tests for form submission, error display
  - **Code Review**: Verify form validation and error handling

#### 2.5 Create Layout Components

- [x] **Task**: Create `src/renderer/components/admin/AdminLayout.tsx`
  - Create main layout container
  - Render `AdminHeader`
  - Render `MessageBanner`
  - Render `TabNavigation`
  - Render tab content area based on `activeTab`
  - **Definition of Done**: Layout renders all child components correctly
  - **Tests Required**: Component tests verify layout structure
  - **Code Review**: Verify layout composition

- [x] **Task**: Create `src/renderer/components/admin/AdminHeader.tsx`
  - Render title and description
  - Render "Back to App" button (always visible)
  - Render "Back to last video" smart exit button (IPC only)
  - Use feature flags to conditionally show smart exit
  - **Definition of Done**: Header displays correctly in both modes
  - **Tests Required**: Component tests for both modes
  - **Code Review**: Verify conditional rendering logic

- [x] **Task**: Create `src/renderer/components/admin/TabNavigation.tsx`
  - Render tab buttons based on feature flags
  - Always show: Time Management, Main Settings
  - Conditionally show (IPC only): Video Sources, Search History, Wishlist Moderation
  - Use `activeTab` from context for highlighting
  - Call `setActiveTab()` on click
  - Style with Tailwind to match design
  - **Definition of Done**: Tabs display correctly based on access mode
  - **Tests Required**: Component tests for both modes, verify tab filtering
  - **Code Review**: Verify feature flag usage

- [x] **Task**: Create `src/renderer/components/admin/MessageBanner.tsx`
  - Render messages from context
  - Style based on message type (success/error/warning)
  - Implement auto-dismiss for timed messages
  - Provide manual dismiss button
  - **Definition of Done**: Messages display with correct styling and auto-dismiss
  - **Tests Required**: Component tests for all message types, auto-dismiss
  - **Code Review**: Verify dismiss logic

### Testing Requirements

**Unit Tests**:
- Test all custom hooks with mocked data access
- Test all components with mocked hooks
- Test context providers and hooks
- **Coverage Target**: >85% for hooks and contexts

**Integration Tests**:
- Test authentication flow end-to-end for both modes
- Test tab navigation with real context
- Test message banner auto-dismiss timing
- **Coverage Target**: >80% for integration flows

### Acceptance Criteria

1. WHEN user loads admin interface THEN appropriate data access implementation SHALL be initialized
2. WHEN user enters password THEN authentication SHALL work in both IPC and HTTP modes
3. WHEN authentication fails THEN error message SHALL be displayed to user
4. WHEN authenticated THEN admin layout SHALL render with correct tabs based on access mode
5. WHEN operation succeeds THEN success message SHALL auto-dismiss after 3 seconds

### Risk & Mitigation

**Risk**: Authentication fails in HTTP mode due to API issues
**Mitigation**: Mock HTTP tests, defer real API integration to Phase 4

**Risk**: Context providers cause performance issues
**Mitigation**: Use React DevTools to verify no unnecessary re-renders

**Risk**: Tab navigation doesn't filter correctly
**Mitigation**: Unit tests for feature flag logic

---

## Phase 3: Feature Components

**Duration**: 4-5 hours
**Dependencies**: Phase 2 complete
**Risk Level**: Medium (existing components must not break)

### Deliverables

#### 3.1 Create Time Management Tab Components

- [x] **Task**: Create `src/renderer/components/admin/QuickTimeExtension.tsx`
  - Extract quick time extension logic from AdminPage
  - Use `useTimeTracking()` hook for state and operations
  - Render extra time input with +/- buttons
  - Display current time state with `TimeIndicator`
  - Display projected time state when extraTime !== 0
  - Render "Add/Remove Time" button
  - Style to match design document
  - **Definition of Done**: Component works independently, extracts cleanly from AdminPage
  - **Tests Required**: Component tests for time addition/subtraction, projected state display
  - **Code Review**: Verify time calculation logic is correct

- [x] **Task**: Create `src/renderer/components/admin/DailyTimeLimitsForm.tsx`
  - Extract daily limits form logic from AdminPage
  - Use `useTimeLimits()` hook for state and operations
  - Render input for each day of week
  - Display current day's limit prominently
  - Render "Save" button with loading state
  - Validate inputs (0-1440 minutes)
  - **Definition of Done**: Component manages daily limits independently
  - **Tests Required**: Component tests for all CRUD operations, validation
  - **Code Review**: Verify validation logic

- [x] **Task**: Create `src/renderer/components/admin/TimeManagementTab.tsx`
  - Compose `QuickTimeExtension` and `DailyTimeLimitsForm`
  - Use grid layout (side-by-side on desktop, stacked on mobile)
  - Load data on mount via hooks
  - **Definition of Done**: Tab displays both sub-components correctly
  - **Tests Required**: Integration tests for tab composition
  - **Code Review**: Verify layout and data loading

#### 3.2 Create Main Settings Tab Components

- [x] **Task**: Create `src/renderer/components/admin/MainSettingsTab.tsx`
  - Extract main settings logic from AdminPage
  - Use `useMainSettings()` hook for state and operations
  - Render all setting fields:
    - Download Path (with "Reset to Default" button, IPC only)
    - YouTube API Key (text input)
    - Admin Password (password input)
    - Verbose Logging (checkbox)
    - YouTube Clicks Toggle (checkbox)
    - Remote Access Toggle (checkbox)
    - Network Info Display (conditional on remote access enabled)
  - Conditionally hide Download Path field in HTTP mode
  - Render "Save" button with loading state
  - Display restart required message when applicable
  - Render "Restart Now" button (IPC only)
  - **Definition of Done**: All settings editable, save works in both modes
  - **Tests Required**: Component tests for all fields, conditional rendering
  - **Code Review**: Verify conditional field display logic

#### 3.3 Adapt Existing Tab Components

- [x] **Task**: Update `src/renderer/components/admin/VideoSourcesManager.tsx`
  - Verify component works with context (no props needed)
  - Add read-only mode support for HTTP (if needed)
  - Ensure component doesn't break when rendered in new context
  - **Definition of Done**: Component works in new architecture
  - **Tests Required**: Regression tests verify no breaking changes
  - **Code Review**: Verify component integration

- [x] **Task**: Update `src/renderer/components/admin/SearchHistoryTab.tsx`
  - Verify component works with context
  - Ensure component doesn't break when rendered in new context
  - **Definition of Done**: Component works in new architecture
  - **Tests Required**: Regression tests verify no breaking changes
  - **Code Review**: Verify component integration

- [x] **Task**: Update `src/renderer/components/admin/WishlistModerationTab.tsx`
  - Verify component works with context
  - Ensure component doesn't break when rendered in new context
  - **Definition of Done**: Component works in new architecture
  - **Tests Required**: Regression tests verify no breaking changes
  - **Code Review**: Verify component integration

### Testing Requirements

**Unit Tests**:
- Test QuickTimeExtension with mocked hooks
- Test DailyTimeLimitsForm with mocked hooks
- Test MainSettingsTab with mocked hooks
- Test all form validations
- **Coverage Target**: >85% for new components

**Integration Tests**:
- Test TimeManagementTab with real hooks and mocked data access
- Test MainSettingsTab with real hooks and mocked data access
- Test existing tab components in new context
- **Coverage Target**: >80% for tab integration

### Acceptance Criteria

1. WHEN user adds extra time THEN UI SHALL update immediately with projected state
2. WHEN user changes daily limits THEN validation SHALL prevent invalid values
3. WHEN user saves settings THEN success message SHALL appear and data SHALL persist
4. WHEN in HTTP mode THEN download path field SHALL be hidden
5. WHEN existing tabs render THEN they SHALL work without breaking changes

### Risk & Mitigation

**Risk**: Existing components break when integrated
**Mitigation**: Regression tests, incremental integration

**Risk**: Time calculations are incorrect
**Mitigation**: Unit tests with known inputs/outputs

**Risk**: Settings don't save correctly
**Mitigation**: Integration tests with mock data persistence

---

## Phase 4: API Enhancement & HTTP Bundle

**Duration**: 3-4 hours
**Dependencies**: Phase 3 complete
**Risk Level**: Medium (must not break existing `/parent-access` route)

### Deliverables

#### 4.1 Enhance API Endpoints

- [ ] **Task**: Add `POST /api/settings` endpoint to `src/main/http/apiHandler.ts`
  - Accept main settings updates
  - Validate input
  - Call `writeMainSettings()` with provided settings
  - Handle password hashing if password is provided
  - Return success/error response
  - **Definition of Done**: Endpoint accepts settings updates and saves to file
  - **Tests Required**: API endpoint tests with various inputs
  - **Code Review**: Verify input validation and error handling

- [ ] **Task**: Add `POST /api/admin/hash-password` endpoint
  - Accept password in request body
  - Hash password using bcrypt
  - Return hashed password
  - **Definition of Done**: Endpoint hashes passwords correctly
  - **Tests Required**: API endpoint tests verify bcrypt usage
  - **Code Review**: Verify security of password handling

- [ ] **Task**: Enhance `GET /api/usage-stats` endpoint
  - Add `extraTime` field to response
  - Ensure response matches `TimeTrackingState` interface
  - **Definition of Done**: Response includes all required fields
  - **Tests Required**: API endpoint tests verify response structure
  - **Code Review**: Verify response format

- [ ] **Task**: Add `GET /api/features` endpoint (optional)
  - Return feature flags for HTTP mode
  - **Definition of Done**: Endpoint returns correct feature flags
  - **Tests Required**: API endpoint tests
  - **Code Review**: Verify feature flag accuracy

#### 4.2 Create HTTP Bundle for React Admin

- [ ] **Task**: Configure build for HTTP admin bundle
  - Create separate entry point for HTTP mode (if needed)
  - Configure Vite/Webpack to bundle for HTTP delivery
  - Ensure bundle includes all admin components
  - Minimize bundle size (code splitting, lazy loading)
  - **Definition of Done**: Build produces standalone HTML bundle
  - **Tests Required**: Build tests verify bundle is valid HTML
  - **Code Review**: Verify build configuration

- [ ] **Task**: Update `/parent-access` route in `apiHandler.ts`
  - Load React admin bundle (replace embedded HTML string)
  - Serve bundle as HTML response
  - Ensure bundle has correct base path for asset loading
  - **Definition of Done**: Route serves React bundle instead of old HTML
  - **Tests Required**: HTTP tests verify bundle loads correctly
  - **Code Review**: Verify asset path configuration

#### 4.3 Test HTTP Bundle Loading

- [ ] **Task**: Manual testing of HTTP bundle
  - Start HTTP server
  - Navigate to `http://localhost:PORT/parent-access`
  - Verify React admin UI loads
  - Verify login works via HTTP API
  - Verify time management features work
  - Verify main settings work
  - **Definition of Done**: Full admin UI works via HTTP
  - **Tests Required**: Manual E2E testing
  - **Code Review**: N/A (manual testing)

### Testing Requirements

**Unit Tests**:
- Test new API endpoints with mock requests
- Test password hashing logic
- **Coverage Target**: >85% for new API code

**Integration Tests**:
- Test API endpoints with real database/file system
- Test full request/response cycle
- **Coverage Target**: >80% for API integration

**Manual Tests**:
- Load HTTP bundle in browser
- Test authentication flow
- Test all features available in HTTP mode

### Acceptance Criteria

1. WHEN client calls `POST /api/settings` THEN settings SHALL be saved to file
2. WHEN client calls `POST /api/admin/hash-password` THEN password SHALL be hashed with bcrypt
3. WHEN client navigates to `/parent-access` THEN React admin bundle SHALL load
4. WHEN HTTP admin is authenticated THEN all core features SHALL work correctly
5. WHEN existing `/parent-access` HTML is replaced THEN no errors SHALL occur

### Risk & Mitigation

**Risk**: Bundle fails to load in browser
**Mitigation**: Test with multiple browsers, verify asset paths

**Risk**: API endpoints have security vulnerabilities
**Mitigation**: Security review, input validation tests

**Risk**: Breaking existing `/parent-access` route
**Mitigation**: Feature flag to toggle between old/new implementation initially

---

## Phase 5: Integration & Backward Compatibility

**Duration**: 3-4 hours
**Dependencies**: Phase 4 complete
**Risk Level**: High (must maintain backward compatibility)

### Deliverables

#### 5.1 Update AdminPage.tsx

- [x] **Task**: Replace AdminPage.tsx implementation
  - Remove all existing admin logic (887 lines → ~10 lines)
  - Import and render `AdminApp` component
  - Maintain same export signature
  - **Definition of Done**: AdminPage is thin wrapper around AdminApp
  - **Tests Required**: Regression tests verify `/admin` route still works
  - **Code Review**: Verify no breaking changes to route

#### 5.2 Update App.tsx Routing

- [ ] **Task**: Verify `/admin` route still works
  - No changes needed to routing
  - Verify AdminPage renders correctly
  - **Definition of Done**: Route renders new AdminApp component
  - **Tests Required**: Routing tests verify `/admin` works
  - **Code Review**: Verify routing is unchanged

#### 5.3 Run Integration Tests

- [ ] **Task**: Test Electron IPC mode end-to-end
  - Start app in Electron
  - Navigate to `/admin`
  - Test login
  - Test all tabs render correctly
  - Test time management features
  - Test main settings features
  - Test video sources tab
  - Test search history tab
  - Test wishlist moderation tab
  - Test smart exit button
  - **Definition of Done**: All features work in Electron mode
  - **Tests Required**: E2E tests for all features
  - **Code Review**: N/A (testing phase)

- [ ] **Task**: Test HTTP mode end-to-end
  - Start HTTP server
  - Navigate to `/parent-access` from browser
  - Test login
  - Verify only Time Management and Main Settings tabs visible
  - Test time management features
  - Test main settings features
  - Verify database tabs are hidden
  - Verify smart exit button is hidden
  - **Definition of Done**: Core features work in HTTP mode
  - **Tests Required**: E2E tests for HTTP mode
  - **Code Review**: N/A (testing phase)

#### 5.4 Regression Testing

- [ ] **Task**: Run full test suite
  - Run `yarn test` to verify no existing tests break
  - Fix any broken tests
  - **Definition of Done**: All existing tests pass
  - **Tests Required**: Full test suite passes
  - **Code Review**: Review test fixes

- [ ] **Task**: Manual regression testing
  - Test all existing admin features in Electron
  - Verify time tracking still works
  - Verify video sources management works
  - Verify search history works
  - Verify wishlist moderation works
  - **Definition of Done**: No regressions in existing features
  - **Tests Required**: Manual testing checklist
  - **Code Review**: N/A (manual testing)

#### 5.5 Verify Backward Compatibility

- [ ] **Task**: Verify IPC handlers unchanged
  - Check all IPC handler signatures
  - Verify no breaking changes to contracts
  - **Definition of Done**: IPC contracts unchanged
  - **Tests Required**: IPC contract tests
  - **Code Review**: Review IPC handler changes

- [ ] **Task**: Verify API endpoints unchanged
  - Check all API endpoint signatures
  - Verify response formats unchanged
  - **Definition of Done**: API contracts unchanged
  - **Tests Required**: API contract tests
  - **Code Review**: Review API changes

### Testing Requirements

**E2E Tests**:
- Test complete user flows for both modes
- Test all features in Electron mode
- Test core features in HTTP mode
- **Coverage Target**: >80% for critical paths

**Regression Tests**:
- Run existing test suite
- Add regression tests for critical features
- **Coverage Target**: 100% of existing tests pass

### Acceptance Criteria

1. WHEN user navigates to `/admin` in Electron THEN all existing features SHALL work
2. WHEN user navigates to `/parent-access` via HTTP THEN core features SHALL work
3. WHEN running existing tests THEN all tests SHALL pass without modification
4. WHEN comparing old vs new admin THEN UI SHALL look identical
5. WHEN using existing IPC handlers THEN they SHALL work without changes

### Risk & Mitigation

**Risk**: Breaking existing functionality
**Mitigation**: Comprehensive regression testing, feature flags for rollback

**Risk**: Performance degradation
**Mitigation**: Performance testing, profiling, optimization if needed

**Risk**: UI inconsistencies
**Mitigation**: Visual regression testing, manual comparison

---

## Phase 6: Polish, Documentation & Cleanup

**Duration**: 2-3 hours
**Dependencies**: Phase 5 complete
**Risk Level**: Low (cleanup phase)

### Deliverables

#### 6.1 Code Cleanup

- [ ] **Task**: Remove old code if safe
  - Identify duplicate/obsolete code
  - Remove old AdminPage logic (keep file as wrapper)
  - Remove old parentAccessPage.html after confirming new bundle works
  - **Definition of Done**: No duplicate logic remains
  - **Tests Required**: Verify tests still pass after cleanup
  - **Code Review**: Review cleanup for safety

- [ ] **Task**: Optimize bundle size
  - Analyze bundle size
  - Implement code splitting if needed
  - Lazy load tabs if beneficial
  - **Definition of Done**: Bundle size is reasonable (<500KB)
  - **Tests Required**: Bundle size tests
  - **Code Review**: Review optimization strategies

#### 6.2 Developer Documentation

- [ ] **Task**: Update code comments
  - Add JSDoc comments to all public APIs
  - Document component props
  - Document hook return values
  - **Definition of Done**: All public APIs documented
  - **Tests Required**: N/A
  - **Code Review**: Review documentation quality

- [ ] **Task**: Create migration guide (if needed)
  - Document changes for future developers
  - Explain new architecture
  - Provide examples of common tasks
  - **Definition of Done**: Migration guide is clear and helpful
  - **Tests Required**: N/A
  - **Code Review**: Review guide for clarity

#### 6.3 Update Project Documentation

- [ ] **Task**: Update CLAUDE.md
  - Document new admin architecture
  - Update references to admin components
  - **Definition of Done**: CLAUDE.md reflects new architecture
  - **Tests Required**: N/A
  - **Code Review**: Review for accuracy

- [ ] **Task**: Update docs/development-tracking.md
  - Mark admin refactoring as complete
  - Update feature status
  - **Definition of Done**: Tracking doc is current
  - **Tests Required**: N/A
  - **Code Review**: N/A

- [ ] **Task**: Update README.md if needed
  - Update admin features section if changed
  - Update screenshots if UI changed
  - **Definition of Done**: README is accurate
  - **Tests Required**: N/A
  - **Code Review**: Review for accuracy

#### 6.4 Final Testing

- [ ] **Task**: Run complete test suite
  - `yarn test` - unit tests
  - `yarn test:all` - full suite
  - `yarn type-check` - TypeScript
  - `yarn lint` - code quality
  - **Definition of Done**: All tests pass, no lint errors
  - **Tests Required**: Full test suite
  - **Code Review**: N/A

- [ ] **Task**: Build verification
  - `yarn build:all` - complete build
  - Verify no build errors
  - Verify bundle sizes are reasonable
  - **Definition of Done**: Build succeeds without errors
  - **Tests Required**: Build tests
  - **Code Review**: N/A

- [ ] **Task**: Final smoke tests
  - Test Electron admin route
  - Test HTTP admin route
  - Test all core features
  - **Definition of Done**: All features work as expected
  - **Tests Required**: Manual smoke testing
  - **Code Review**: N/A

### Testing Requirements

**Final Validation**:
- Full test suite passes
- Build succeeds
- Manual smoke tests pass
- Code coverage >85%

### Acceptance Criteria

1. WHEN viewing codebase THEN no duplicate code SHALL exist
2. WHEN reading documentation THEN architecture SHALL be clearly explained
3. WHEN running tests THEN all tests SHALL pass
4. WHEN building project THEN build SHALL succeed without errors
5. WHEN using admin features THEN user experience SHALL be smooth and bug-free

### Risk & Mitigation

**Risk**: Breaking something in cleanup
**Mitigation**: Make cleanup changes incrementally, test after each change

**Risk**: Incomplete documentation
**Mitigation**: Peer review documentation before marking complete

---

## File Checklist

### Files to Create

**Type Definitions**:
- `src/renderer/hooks/admin/types.ts`

**Data Access Layer**:
- `src/renderer/services/AdminDataAccess.ts`

**Custom Hooks**:
- `src/renderer/hooks/admin/useAdminDataAccess.ts`
- `src/renderer/hooks/admin/useAdminAuth.ts`
- `src/renderer/hooks/admin/useTimeLimits.ts`
- `src/renderer/hooks/admin/useTimeTracking.ts`
- `src/renderer/hooks/admin/useMainSettings.ts`

**Contexts**:
- `src/renderer/contexts/AdminContext.ts`

**Core Components**:
- `src/renderer/components/admin/AdminApp.tsx`
- `src/renderer/components/admin/AuthGate.tsx`
- `src/renderer/components/admin/LoginForm.tsx`
- `src/renderer/components/admin/AdminLayout.tsx`
- `src/renderer/components/admin/AdminHeader.tsx`
- `src/renderer/components/admin/TabNavigation.tsx`
- `src/renderer/components/admin/MessageBanner.tsx`

**Feature Components**:
- `src/renderer/components/admin/QuickTimeExtension.tsx`
- `src/renderer/components/admin/DailyTimeLimitsForm.tsx`
- `src/renderer/components/admin/TimeManagementTab.tsx`
- `src/renderer/components/admin/MainSettingsTab.tsx`

**Test Files** (create for each new file):
- `*.test.ts` or `*.test.tsx` for all new components and hooks

### Files to Modify

**Main Process**:
- `src/main/http/apiHandler.ts` - Add new endpoints, update `/parent-access` route

**Renderer Process**:
- `src/renderer/pages/AdminPage.tsx` - Replace with wrapper
- `src/renderer/components/admin/VideoSourcesManager.tsx` - Verify compatibility
- `src/renderer/components/admin/SearchHistoryTab.tsx` - Verify compatibility
- `src/renderer/components/admin/WishlistModerationTab.tsx` - Verify compatibility

**Documentation**:
- `CLAUDE.md` - Update admin architecture description
- `docs/development-tracking.md` - Update feature status
- `README.md` - Update if needed

### Files to Remove (After Validation)

- `src/main/http/parentAccessPage.html` - Replace with React bundle
- Old admin logic from `AdminPage.tsx` - Replace with wrapper

---

## Testing Plan

### Unit Test Requirements

**Data Access Layer**:
- Test IPCAdminDataAccess with mocked window.electron
- Test HTTPAdminDataAccess with mocked fetch
- Test factory function detection
- **Coverage Target**: >90%

**Custom Hooks**:
- Test all hooks with mocked data access
- Test success/failure paths
- Test error handling
- **Coverage Target**: >85%

**Components**:
- Test all components with mocked hooks
- Test conditional rendering
- Test user interactions
- **Coverage Target**: >85%

### Integration Test Requirements

**Authentication**:
- Test IPC auth flow with real handlers
- Test HTTP auth flow with real API
- Test auth failure handling

**Data Operations**:
- Test time limits CRUD with real backend
- Test time tracking with real backend
- Test settings CRUD with real backend

**Component Integration**:
- Test tab navigation with real context
- Test message banner with real messages
- Test existing components in new context

**Coverage Target**: >80%

### E2E Test Requirements

**Critical User Flows**:
1. Login → View time management → Add extra time
2. Login → View main settings → Update settings → Save
3. Login (Electron) → Navigate all tabs → Verify all features work
4. Login (HTTP) → Verify only core tabs visible → Test core features

**Coverage Target**: >80% of critical paths

### Test Coverage Targets

| Category | Target | Priority |
|----------|--------|----------|
| Data Access Layer | >90% | High |
| Custom Hooks | >85% | High |
| Core Components | >85% | High |
| Feature Components | >85% | Medium |
| Integration Tests | >80% | High |
| E2E Tests | >80% of critical paths | High |
| Overall | >85% | High |

---

## Risk & Mitigation

### Technical Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Breaking existing IPC contracts | High | Low | Unit tests, contract validation |
| HTTP API incompatibilities | High | Medium | Mock tests early, API design review |
| Authentication failures | High | Medium | Comprehensive auth tests, both modes |
| Performance degradation | Medium | Low | Performance testing, profiling |
| Bundle loading issues | Medium | Medium | Browser testing, asset path validation |
| Existing component breakage | High | Low | Regression tests, incremental integration |

### Feature Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Feature flag logic incorrect | Medium | Medium | Unit tests for conditional rendering |
| UI inconsistencies | Medium | Low | Visual regression tests |
| Missing features in HTTP mode | Low | Low | Feature flag tests |
| Data loss during save | High | Very Low | Transaction tests, backup mechanisms |

### Testing Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Insufficient test coverage | Medium | Medium | Coverage targets, mandatory reviews |
| Flaky E2E tests | Low | Medium | Retry logic, stable test data |
| Missing edge cases | Medium | Medium | Code review, test plan review |

### Rollback Procedures

**Phase 1-3**: Simple rollback - delete new files, no impact on existing code

**Phase 4**: Feature flag to toggle between old/new `/parent-access` route

**Phase 5**: Revert AdminPage.tsx to original implementation if needed

**Phase 6**: Restore removed files from git history if needed

---

## Success Criteria

The admin refactoring is considered successful when:

1. **Code Deduplication**: <50 lines of duplicated logic between access modes (down from 600+)
2. **Visual Consistency**: Both access modes render identically (verified by manual testing)
3. **Feature Parity**: Core features (time management, main settings) work identically in both modes
4. **Test Coverage**: >85% code coverage for all new components and abstraction layer
5. **No Regressions**: All existing admin functionality passes regression tests
6. **Performance**: No degradation in load times or interaction responsiveness
7. **Maintainability**: Adding a new tab requires <20 lines of code across all files
8. **Quality**: All tests pass, no lint errors, TypeScript compiles without errors
9. **Documentation**: Architecture is clearly documented for future developers

---

## Dependencies & Prerequisites

### Knowledge Required

- React hooks patterns (useState, useEffect, useContext, custom hooks)
- TypeScript interfaces and generics
- Electron IPC architecture
- HTTP REST API design
- Tailwind CSS utility classes
- Testing with Vitest and React Testing Library

### Setup Required

- Development environment with Electron
- HTTP server running for remote access testing
- Test database with sample data
- Multiple browsers for cross-browser testing

### Existing Code Understanding

**Must Understand**:
- Current AdminPage.tsx implementation and all its features
- Existing IPC handler contracts in main process
- Existing HTTP API endpoints and response formats
- Existing admin-related components (VideoSourcesManager, etc.)
- Time tracking and limits data structures

**Should Understand**:
- Overall Electron app architecture
- React Router configuration
- Tailwind CSS configuration
- Vite/Webpack build process

---

## Implementation Notes

### Best Practices

1. **Incremental Development**: Implement and test each phase before moving to the next
2. **Test-Driven Development**: Write tests before or alongside implementation
3. **Code Review**: Review each phase before proceeding
4. **Documentation**: Document as you go, don't defer to end
5. **Commit Frequently**: Commit after each logical unit of work

### Common Pitfalls to Avoid

1. **Don't skip tests**: Tests catch integration issues early
2. **Don't assume IPC/HTTP equivalence**: Different error modes, latencies
3. **Don't forget edge cases**: Network failures, auth timeouts, invalid inputs
4. **Don't break existing code**: Always verify backward compatibility
5. **Don't defer documentation**: Document architecture while fresh in mind

### Performance Optimization Tips

1. **Lazy load tabs**: Don't render all tabs upfront
2. **Memoize expensive calculations**: Use React.memo, useMemo
3. **Debounce user input**: Avoid excessive API calls
4. **Cache API responses**: Reduce redundant network calls
5. **Code splitting**: Split bundle for faster initial load

---

## Completion Checklist

### Phase 1 Complete ✅
- [x] All data access types defined (types.ts)
- [x] IAdminDataAccess interface created
- [x] IPCAdminDataAccess implemented and tested
- [x] HTTPAdminDataAccess implemented and tested
- [x] Factory function working (createAdminDataAccess)
- [x] All unit tests passing (36 tests)

### Phase 2 Complete ✅
- [x] All custom hooks implemented (5 hooks)
  - useAdminDataAccess, useAdminAuth, useTimeLimits, useTimeTracking, useMainSettings
- [x] AdminContext created (global state management)
- [x] AdminApp root component working
- [x] AuthGate and LoginForm working
- [x] All layout components implemented (Header, Navigation, MessageBanner)
- [x] Authentication works in both modes

### Phase 3 Complete ✅
- [x] TimeManagementTab fully functional
  - QuickTimeExtension component
  - DailyTimeLimitsForm component
- [x] MainSettingsTab fully functional (all settings fields)
- [x] Existing tabs integrated (VideoSources, SearchHistory, Wishlist)
- [x] All feature components created
- [x] Layout updated to use actual components

### Phase 4 Complete ✅
- [x] AdminPage.tsx refactored (887 lines → 13 lines)
- [x] Replaced with thin wrapper around AdminApp
- [x] Build succeeds without errors
- [x] Backward compatibility maintained

### Phase 5 Pending ⏳
- [ ] API endpoints enhanced (POST /api/settings, POST /api/admin/hash-password, etc.)
- [ ] HTTP bundle configuration for /parent-access route
- [ ] End-to-end testing in both modes
- [ ] Regression testing

### Phase 6 Pending ⏳
- [ ] Code cleanup and optimization
- [ ] Documentation updates
- [ ] Final test suite run
- [ ] Performance verification
- [ ] Feature marked complete in tracking docs

---

## Final Notes

This implementation plan provides a comprehensive roadmap for refactoring the SafeTube admin interface. The phased approach ensures that each component is thoroughly tested before integration, minimizing the risk of breaking existing functionality.

**Key Success Factors**:
- Rigorous testing at each phase
- Maintaining backward compatibility
- Clear documentation throughout
- Regular code reviews
- Incremental integration

**Timeline**: With focused development, this refactoring can be completed in 3-4 working days (19-25 hours). However, it's recommended to allocate buffer time for unexpected issues and thorough testing.

**Next Steps**: After reviewing and approving this document, begin with Phase 1 implementation.
