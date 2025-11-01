# Implementation Plan

## Overview
This implementation plan breaks down the local HTTP server feature into incremental, testable tasks. Each task includes specific requirements references, definition of done criteria, required tests, and code review requirements to ensure quality and completeness.

## Tasks

- [x] 1. Set up project structure and core type definitions
  - Create `src/shared/types/server.ts` with `ServerConfig`, `ServerInfo`, and `NetworkInfo` interfaces
  - Add new `IPC.SERVER` section to `src/shared/ipc-channels.ts` with `GET_SERVER_INFO` and `GET_NETWORK_INFO` channels
  - **Requirements**: Req 1.2, Req 1.3, Req 4.5
  - **Definition of Done**: Type definitions match design document exactly, IPC channels are properly typed, TypeScript compilation passes with no errors
  - **Tests Required**: Unit tests for type exports and IPC channel constant verification
  - **Code Review**: Architecture review by peer developer, TypeScript type safety review

- [x] 2. Implement NetworkUtils service
  - Create `src/main/services/NetworkUtils.ts` with `getLocalIPAddress()` and `getAllNetworkInterfaces()` methods
  - Implement IPv4 filtering and private network address preference (192.168.x.x, 10.x.x.x, 172.x.x.x)
  - Add fallback to 127.0.0.1 when no suitable network interface found
  - **Requirements**: Req 4.5
  - **Definition of Done**: NetworkUtils correctly identifies local IP on various network configurations, excludes localhost and IPv6, prefers private network addresses
  - **Tests Required**: Unit tests covering multiple network interface scenarios, no network interface scenario, IPv4/IPv6 filtering, private address preference
  - **Code Review**: Logic review by peer developer, edge case handling review

- [x] 2.1 Create unit tests for NetworkUtils
  - Test `getLocalIPAddress()` with mocked network interfaces
  - Test IPv4 vs IPv6 filtering
  - Test private network address preference
  - Test fallback behavior when no network interfaces available
  - **Requirements**: Req 4.5
  - **Definition of Done**: Tests pass with 100% coverage of NetworkUtils methods, all edge cases covered
  - **Tests Required**: At least 5 test cases covering different network configurations
  - **Code Review**: Test coverage review by peer developer

- [x] 3. Implement HttpServerManager service
  - Create `src/main/services/HttpServerManager.ts` with class structure matching design document
  - Implement constructor with `ServerConfig` parameter
  - Implement `isPortAvailable()` private method for port availability checking
  - Implement `findAvailablePort()` with retry logic (3000 → 3001 → 3002 → 3003 → OS-assigned)
  - **Requirements**: Req 1.2, Req 5.1, Req 5.4
  - **Definition of Done**: HttpServerManager class structure complete, port selection logic implements design specification exactly, all private methods functional
  - **Tests Required**: Unit tests for port availability checking, port fallback logic (mock socket binding)
  - **Code Review**: Architecture review by senior developer, error handling review

- [x] 3.1 Implement static file serving in HttpServerManager
  - Implement `handleRequest()` method with MIME type detection
  - Implement `getContentType()` helper function for common file extensions (.html, .js, .css, .json, images, fonts)
  - Add directory traversal protection (path normalization and validation)
  - Add SPA fallback: serve index.html for routes without file extensions or 404 errors
  - **Requirements**: Req 1.1, Req 1.3
  - **Definition of Done**: Static files served correctly with proper MIME types, directory traversal attempts blocked, SPA routing works correctly
  - **Tests Required**: Unit tests for MIME type mapping, directory traversal rejection, SPA fallback behavior, file serving with various extensions
  - **Code Review**: Security review for path traversal protection, performance review

- [x] 3.2 Implement server lifecycle methods in HttpServerManager
  - Implement `start()` method with error handling and port selection logic
  - Implement `stop()` method with graceful shutdown
  - Implement `getInfo()` method to return current server state
  - Add comprehensive error logging throughout lifecycle methods
  - **Requirements**: Req 1.1, Req 1.2, Req 1.5, Req 5.1, Req 5.2, Req 5.3
  - **Definition of Done**: Server starts successfully on available port, stops cleanly releasing resources, getInfo returns accurate state, all errors logged with context
  - **Tests Required**: Unit tests for start/stop lifecycle, error scenarios (port in use, permission denied), state management
  - **Code Review**: Error handling review by senior developer, resource cleanup verification

- [x] 3.3 Create comprehensive unit tests for HttpServerManager
  - Test server starts on preferred port (3000)
  - Test port fallback when 3000 is in use (3001, 3002, 3003, then OS-assigned)
  - Test server stops and releases port correctly
  - Test static file serving with various file types
  - Test 404 handling with SPA fallback to index.html
  - Test directory traversal rejection (../../../etc/passwd attempts)
  - Test MIME type detection for all supported extensions
  - Test error handling for file read failures
  - **Requirements**: All Requirement 1, Requirement 5
  - **Definition of Done**: All HttpServerManager functionality has comprehensive test coverage (>90%), all edge cases covered, tests pass consistently
  - **Tests Required**: Minimum 12 test cases covering happy path, error scenarios, security edge cases
  - **Code Review**: Test coverage review, security test verification

- [x] 4. Integrate HttpServerManager into main process
  - Modify `src/main/main.ts` to import and instantiate HttpServerManager
  - Add server initialization in `app.whenReady()` handler (production mode only)
  - Determine correct distPath (check `dist/renderer/` vs `app.asar/dist/renderer/`)
  - Load `main.remoteAccessEnabled` setting from database to determine host binding (127.0.0.1 vs 0.0.0.0)
  - Start HTTP server and store serverInfo in global variable or module scope
  - Add error handling with fallback to file:// protocol if server fails to start
  - **Requirements**: Req 1.1, Req 1.4, Req 1.5, Req 1.6, Req 2.2, Req 2.3, Req 2.5
  - **Definition of Done**: Server starts correctly in production mode, development mode continues using Vite dev server, settings loaded from database, graceful fallback on errors
  - **Tests Required**: Integration tests for server initialization in production mode, settings loading, error fallback behavior
  - **Code Review**: Main process integration review by senior developer, settings integration verification

- [x] 4.1 Update window loading logic to use HTTP server
  - Modify `createWindow()` in `src/main/main.ts` to check server status
  - Use `mainWindow.loadURL('http://localhost:[port]')` in production when server started successfully
  - Maintain existing `mainWindow.loadURL('http://localhost:5173')` for development mode
  - Implement fallback to `mainWindow.loadFile()` if HTTP server failed to start
  - Add logging for window load URL and any fallback scenarios
  - **Requirements**: Req 1.3, Req 1.6, Req 5.3
  - **Definition of Done**: Window loads from HTTP server in production, loads from Vite in development, fallback works correctly, all scenarios logged
  - **Tests Required**: Integration tests for window loading in production mode, development mode, and fallback scenarios
  - **Code Review**: Window lifecycle review, error handling verification

- [x] 4.2 Add server cleanup on application quit
  - Add `app.on('will-quit')` handler to call `httpServerManager.stop()`
  - Ensure port is properly released before application exits
  - Add logging for cleanup operations
  - **Requirements**: Req 1.5
  - **Definition of Done**: Server stops cleanly on quit, port released, no resource leaks detected
  - **Tests Required**: Integration tests for cleanup on quit event, port release verification
  - **Code Review**: Resource cleanup review, memory leak verification

- [x] 5. Implement server IPC handlers
  - Create `src/main/ipc/serverHandlers.ts` with `registerServerHandlers()` function
  - Implement `IPC.SERVER.GET_SERVER_INFO` handler returning current server state
  - Implement `IPC.SERVER.GET_NETWORK_INFO` handler with conditional logic (only return info if remote access enabled and host is 0.0.0.0)
  - Use NetworkUtils to get local IP address for network info response
  - **Requirements**: Req 4.1, Req 4.2, Req 4.3, Req 4.4, Req 4.5
  - **Definition of Done**: IPC handlers return correct data based on server state and remote access settings, network info only returned when appropriate
  - **Tests Required**: Unit tests for each IPC handler with mocked server manager, test conditional logic for network info
  - **Code Review**: IPC contract review, data flow verification

- [x] 5.1 Register server IPC handlers in main process
  - Call `registerServerHandlers(httpServerManager)` in `src/main/main.ts` after server initialization
  - Ensure handlers registered before window creation
  - Verify handlers are accessible from renderer process
  - **Requirements**: Req 4.1
  - **Definition of Done**: IPC handlers properly registered and accessible from renderer, handler registration order correct
  - **Tests Required**: Integration tests verifying IPC communication from renderer to main for server info
  - **Code Review**: IPC registration order review

- [x] 6. Update Content Security Policy for HTTP server
  - Modify CSP configuration in `src/main/main.ts` to create dynamic CSP based on server port
  - Implement `getCSP(port: number)` function with all required CSP directives
  - Add `connect-src` allowing `http://localhost:[port]`
  - Maintain existing YouTube domain allowances in `media-src`, `script-src`, `frame-src`
  - **Requirements**: Req 6.1, Req 6.2
  - **Definition of Done**: CSP allows localhost HTTP server, all YouTube domains remain allowed, all static resources load correctly
  - **Tests Required**: Manual testing of CSP violations in DevTools, verify YouTube iframes load, verify static assets load
  - **Code Review**: Security review of CSP configuration, YouTube domain coverage verification

- [x] 6.1 Configure Referrer-Policy and CORS headers
  - Implement `configureSecurityHeaders()` function in `src/main/main.ts`
  - Set `Referrer-Policy: strict-origin-when-cross-origin` header for YouTube iframe compatibility
  - Maintain existing CORS headers (`Access-Control-Allow-Origin: *`, etc.)
  - Call `configureSecurityHeaders()` in `createWindow()` with server port parameter
  - **Requirements**: Req 6.3, Req 6.4, Req 7.2
  - **Definition of Done**: Referrer-Policy header set correctly, CORS headers maintained, headers visible in DevTools Network tab
  - **Tests Required**: Manual verification of headers in DevTools, integration test for YouTube iframe loading
  - **Code Review**: Security headers review, YouTube iframe compatibility verification

- [x] 7. Implement NetworkInfoFooter component
  - Create `src/renderer/components/NetworkInfoFooter.tsx` component
  - Implement state management for network info (localIP, port, url)
  - Add useEffect hook to fetch network info via `IPC.SERVER.GET_NETWORK_INFO`
  - Implement 30-second polling interval to refresh network info (handle IP changes)
  - Conditional rendering: only display footer if network info is not null (remote access enabled)
  - **Requirements**: Req 4.1, Req 4.2, Req 4.3, Req 4.4
  - **Definition of Done**: Footer displays when remote access enabled, hides when disabled, shows correct IP and port, refreshes periodically
  - **Tests Required**: React component tests for rendering logic, IPC call mocking, conditional display, polling behavior
  - **Code Review**: React component review, state management verification

- [x] 7.1 Style NetworkInfoFooter component
  - Add CSS for fixed bottom positioning
  - Style with semi-transparent black background (rgba(0, 0, 0, 0.7))
  - Use small gray monospace font for network info text (11px, #999)
  - Ensure footer doesn't interfere with main content (z-index: 1000)
  - Test footer visibility across different screen sizes
  - **Requirements**: Req 4.2, Req 4.3
  - **Definition of Done**: Footer styled according to design, doesn't block UI elements, readable on all backgrounds, responsive
  - **Tests Required**: Visual regression tests (if available), manual testing on different screen sizes
  - **Code Review**: UI/UX review, accessibility review

- [x] 7.2 Integrate NetworkInfoFooter into main App component
  - Import NetworkInfoFooter in `src/renderer/App.tsx` (or main app component)
  - Add `<NetworkInfoFooter />` at root level of app (after main content)
  - Verify footer appears correctly in both main app and admin panel
  - **Requirements**: Req 4.1, Req 4.2
  - **Definition of Done**: Footer integrated into app, visible when appropriate, doesn't cause layout issues
  - **Tests Required**: Integration tests for app component with footer, visual verification
  - **Code Review**: Component integration review

- [x] 8. Add Remote Access control to Admin Panel
  - Modify `src/renderer/components/AdminPanel.tsx` to add Network Settings section
  - Add state for `remoteAccessEnabled` boolean and `restartRequired` flag
  - Load `main.remoteAccessEnabled` setting from database on component mount
  - Implement checkbox control for Remote Access with label and description
  - Add info message explaining remote access when checkbox is checked
  - **Requirements**: Req 2.1, Req 2.2, Req 2.3, Req 2.4, Req 2.5
  - **Definition of Done**: Remote Access checkbox appears in admin panel, loads current setting correctly, displays helpful information
  - **Tests Required**: React component tests for settings loading, checkbox interaction, conditional info display
  - **Code Review**: Admin panel UI review, settings integration verification

- [x] 8.1 Implement Remote Access toggle handler
  - Create `handleRemoteAccessToggle()` function to update setting in database
  - Call `IPC.DB_SETTINGS.SET_SETTING` with 'main.remoteAccessEnabled' key
  - Set `restartRequired` flag to true when setting changes
  - Update local state optimistically
  - **Requirements**: Req 2.4, Req 2.6
  - **Definition of Done**: Setting persisted to database on toggle, restart flag set, optimistic UI update works
  - **Tests Required**: Unit tests for toggle handler with mocked IPC, verify database persistence call
  - **Code Review**: Settings persistence review, error handling verification

- [x] 8.2 Add restart required notification in Admin Panel
  - Display warning message when `restartRequired` is true
  - Add "Restart Now" button that calls `app:restart` IPC handler
  - Style warning message with appropriate visual indicator (warning icon, yellow/orange color)
  - Clear restart flag after successful restart
  - **Requirements**: Req 2.6
  - **Definition of Done**: Restart notification appears when setting changed, restart button functional, visual design clear and noticeable
  - **Tests Required**: Component tests for restart notification display, button click handling
  - **Code Review**: UX review for restart flow, restart handler verification

- [x] 9. Implement app restart IPC handler (if not exists)
  - Check if `app:restart` IPC handler exists in `src/main/ipc/` handlers
  - If missing, implement handler that calls `app.relaunch()` followed by `app.quit()`
  - Register handler in main process IPC setup
  - **Requirements**: Req 2.6
  - **Definition of Done**: App restart handler functional, properly restarts application with new settings
  - **Tests Required**: Integration test for restart flow (if possible), manual testing
  - **Code Review**: Restart lifecycle review, state preservation verification

- [ ] 10. Create integration tests for HTTP server feature
  - Test full server lifecycle: start → serve files → stop
  - Test server URL loading in BrowserWindow
  - Test remote access toggle: localhost (127.0.0.1) ↔ LAN (0.0.0.0)
  - Test settings persistence: remote access setting saved and loaded across restarts
  - Test network info IPC handler returns correct data based on remote access setting
  - **Requirements**: All requirements
  - **Definition of Done**: Integration tests cover full feature workflow, tests pass consistently, all requirements validated
  - **Tests Required**: Minimum 8 integration test scenarios covering end-to-end workflows
  - **Code Review**: Integration test coverage review, test reliability verification

- [ ] 11. Create YouTube iframe functionality tests
  - Test YouTube iframe loads without error 153 (requires production build testing)
  - Verify HTTP Referer header is sent to YouTube iframe
  - Verify YouTube iframe API functions correctly (play, pause, seek)
  - Test with both MediaSource and iframe player modes
  - **Requirements**: Req 7.1, Req 7.2, Req 7.3
  - **Definition of Done**: YouTube iframes work correctly in production build, error 153 eliminated, all iframe API functions operational
  - **Tests Required**: Manual testing with production build, automated tests where possible
  - **Code Review**: YouTube integration verification, player mode compatibility review

- [ ] 12. Test production build with HTTP server
  - Build production version: `yarn build:all`
  - Start packaged app and verify it loads via `http://localhost:3000`
  - Check DevTools Network tab for protocol (should be http:// not file://)
  - Verify all static assets load correctly (JS, CSS, images, fonts)
  - Test YouTube video playback with iframe embed
  - **Requirements**: Req 1.1, Req 1.3, Req 7.1
  - **Definition of Done**: Production build works correctly with HTTP server, all assets load, YouTube videos play
  - **Tests Required**: Manual testing checklist covering all asset types and YouTube playback
  - **Code Review**: Production build verification by peer developer

- [ ] 13. Test remote access functionality end-to-end
  - Enable remote access in admin panel
  - Restart application
  - Verify footer displays local IP and port
  - From another device on same LAN, access `http://[IP]:[PORT]`
  - Verify main app loads correctly from remote device
  - Navigate to `http://[IP]:[PORT]/admin` from remote device
  - Verify admin panel is accessible and functional from remote device
  - Disable remote access and verify footer disappears
  - **Requirements**: Req 2, Req 3, Req 4
  - **Definition of Done**: Remote access works end-to-end, admin panel accessible remotely, settings toggle works correctly
  - **Tests Required**: Manual testing on local network with multiple devices
  - **Code Review**: Remote access feature verification by peer tester

- [ ] 14. Test port conflict handling
  - Start another service on port 3000 (e.g., `python3 -m http.server 3000`)
  - Start SafeTube and verify it uses port 3001
  - Check logs for port conflict messages
  - Occupy ports 3000-3003 and verify SafeTube uses OS-assigned port
  - Verify application still functions correctly on alternative port
  - **Requirements**: Req 5.1, Req 5.2, Req 5.4
  - **Definition of Done**: Port conflict handling works correctly, application remains functional, clear logging for all scenarios
  - **Tests Required**: Manual testing with various port conflict scenarios, log verification
  - **Code Review**: Error handling review, logging completeness verification

- [ ] 15. Test error scenarios and edge cases
  - Test server failure fallback to file:// protocol
  - Test behavior with no network interfaces (airplane mode)
  - Test behavior with VPN active (multiple network interfaces)
  - Test rapid toggle of remote access setting
  - Test server shutdown during active connections
  - Verify proper error messages in all failure scenarios
  - **Requirements**: Req 5.2, Req 5.3, Req 4.5
  - **Definition of Done**: All error scenarios handled gracefully, no crashes, informative error messages, proper fallback behavior
  - **Tests Required**: Manual testing of edge cases, error scenario checklist
  - **Code Review**: Edge case handling review, error message quality review

- [ ] 16. Performance and security review
  - Measure server startup time impact on application launch (<100ms acceptable)
  - Test static file serving performance (should be <10ms per request)
  - Verify directory traversal attempts are blocked and logged
  - Review CSP for security implications
  - Check for any exposed sensitive data in network info
  - Verify CORS configuration doesn't introduce vulnerabilities
  - Test memory usage with HTTP server running (should be <2MB overhead)
  - **Requirements**: Req 6 (Security)
  - **Definition of Done**: Performance meets targets, no security vulnerabilities identified, memory usage acceptable
  - **Tests Required**: Performance benchmarks, security penetration testing (basic), memory profiling
  - **Code Review**: Security review by senior developer, performance review

- [ ] 17. Update documentation
  - Update README.md with HTTP server feature description
  - Add remote access instructions to user documentation
  - Document port configuration and conflict resolution
  - Add troubleshooting section for common server issues
  - Update development guide with HTTP server testing instructions
  - Document CSP and security header configuration
  - **Requirements**: All requirements (documentation support)
  - **Definition of Done**: All documentation updated, clear instructions for users and developers, troubleshooting guide comprehensive
  - **Tests Required**: Documentation review for clarity and completeness
  - **Code Review**: Documentation review by peer developer, technical writing review

- [ ] 18. Final integration and regression testing
  - Run full test suite: `yarn test:all`
  - Verify all existing features still work (video playback, time tracking, admin panel, etc.)
  - Test YouTube API integration still functional
  - Verify local video files still play correctly
  - Test parental controls and time limits still enforce correctly
  - Run linter: `yarn lint`
  - Run type checker: `yarn type-check`
  - Build production: `yarn build:all`
  - **Requirements**: All requirements
  - **Definition of Done**: All tests pass, no regressions detected, build successful, no lint or type errors
  - **Tests Required**: Full test suite execution, regression testing checklist
  - **Code Review**: Final code review by senior developer, regression testing verification

## Testing Checklist

### Unit Tests (Run with `yarn test`)
- [ ] NetworkUtils.test.ts - Network interface detection and IP selection
- [ ] HttpServerManager.test.ts - Server lifecycle, file serving, port management
- [ ] serverHandlers.test.ts - IPC handlers for server info and network info
- [ ] NetworkInfoFooter.test.tsx - React component rendering and IPC integration

### Integration Tests (Run with `yarn test:all`)
- [ ] http-server-integration.test.ts - Full server lifecycle with actual file serving
- [ ] youtube-iframe.test.ts - YouTube iframe loading and Referer header validation
- [ ] remote-access-settings.test.ts - Settings persistence and server reconfiguration

### Manual Testing
- [ ] Production build loads via HTTP server
- [ ] YouTube videos play without error 153
- [ ] Remote access enables/disables correctly
- [ ] Network info footer displays/hides appropriately
- [ ] Port conflicts resolved automatically
- [ ] Admin panel accessible from remote devices (when enabled)
- [ ] All static assets load correctly in production build
- [ ] Server stops cleanly on application quit

## Definition of Done for Complete Feature

The local HTTP server feature is considered complete when:

1. **Functional Requirements**: All acceptance criteria from requirements.md are met and verified
2. **Testing Requirements**: All unit tests pass, integration tests pass, manual testing checklist complete
3. **Code Review Requirements**: All code reviewed and approved by at least one peer developer
4. **Documentation Requirements**: All user and developer documentation updated and reviewed
5. **Performance Requirements**: Server startup <100ms, file serving <10ms, memory overhead <2MB
6. **Security Requirements**: CSP configured correctly, no security vulnerabilities, directory traversal blocked
7. **Quality Requirements**: No lint errors, no type errors, production build successful
8. **Regression Requirements**: All existing features verified functional, no regressions detected

## Notes

- **Incremental Testing**: Run tests after each task completion, not just at the end
- **Code Reviews**: Schedule code review after completing related tasks (e.g., review HttpServerManager after tasks 3.x)
- **Documentation**: Update docs as you implement, not as a final task
- **Error Handling**: Every task involving external resources (network, filesystem) must include comprehensive error handling
- **Logging**: Add detailed logging throughout implementation for production troubleshooting
- **Backwards Compatibility**: Ensure fallback to file:// protocol works if HTTP server fails
