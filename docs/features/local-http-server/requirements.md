# Requirements Document

## Introduction

SafeTube currently loads the renderer process using the `file://` protocol in production builds. This causes YouTube iframe embeds to fail with error 153 because YouTube requires HTTP Referer headers, which are not sent with `file://` protocol requests. This feature implements a local HTTP server in the main process to serve the renderer application via `http://localhost`, enabling proper YouTube iframe functionality while maintaining security and optionally allowing remote access from the local network.

## Requirements

### Requirement 1: Local HTTP Server in Main Process
**User Story:** As a SafeTube user, I want the app to load via a local HTTP server instead of file:// protocol, so that YouTube iframe embeds work correctly without error 153.

#### Acceptance Criteria
1. WHEN the application starts in production mode THEN the main process SHALL create an HTTP server to serve static files from `dist/renderer/`
2. WHEN the HTTP server is created THEN the system SHALL determine an available port (either fixed or dynamically selected)
3. WHEN the browser window is created THEN the system SHALL load the renderer using `mainWindow.loadURL('http://localhost:[port]')` instead of `mainWindow.loadFile()`
4. WHEN the HTTP server starts THEN it SHALL bind to `127.0.0.1` by default (localhost only)
5. WHEN the application quits THEN the system SHALL properly close the HTTP server and release the port
6. WHEN in development mode THEN the system SHALL continue using the Vite dev server at `http://localhost:5173`

### Requirement 2: Remote Access Configuration
**User Story:** As a parent administrator, I want to optionally enable remote access to SafeTube from other devices on my local network, so that I can manage the app and access the admin panel from my phone or tablet.

#### Acceptance Criteria
1. WHEN the admin panel Main Settings tab is loaded THEN the system SHALL display a "Remote Access" checkbox control
2. WHEN the "Remote Access" checkbox is unchecked THEN the HTTP server SHALL bind to `127.0.0.1` (localhost only)
3. WHEN the "Remote Access" checkbox is checked THEN the HTTP server SHALL bind to `0.0.0.0` (accessible from LAN)
4. WHEN the remote access setting is changed THEN the system SHALL persist the setting to the database in the 'main' namespace
5. WHEN the application starts THEN the system SHALL load the remote access setting from the database and configure the HTTP server accordingly
6. WHEN the remote access setting is changed THEN the system SHALL require an application restart to apply the new binding

### Requirement 3: Admin Panel Remote Accessibility
**User Story:** As a parent administrator, I want to access the parent control panel remotely via the `/admin` route, so that I can manage settings from any device on my network when remote access is enabled.

#### Acceptance Criteria
1. WHEN the HTTP server is running THEN the admin panel SHALL be accessible at the `/admin` route
2. WHEN a user navigates to `/admin` THEN the system SHALL display the password-protected admin panel
3. WHEN remote access is enabled THEN the admin panel SHALL be accessible from other devices on the LAN at `http://[device-ip]:[port]/admin`
4. WHEN remote access is disabled THEN the admin panel SHALL only be accessible from localhost at `http://localhost:[port]/admin`

### Requirement 4: Network Information Display
**User Story:** As a parent administrator, I want to see the local IP address and port when remote access is enabled, so that I know how to connect from other devices on my network.

#### Acceptance Criteria
1. WHEN remote access is enabled THEN the application SHALL display a footer with network information
2. WHEN the footer is displayed THEN it SHALL show the local IP address and port in small gray text
3. WHEN remote access is disabled THEN the footer SHALL not be displayed
4. WHEN the remote access setting changes THEN the footer display SHALL update accordingly without requiring a full app restart
5. WHEN the system has multiple network interfaces THEN the footer SHALL display the primary local network IP address (e.g., 192.168.x.x, not 127.0.0.1)

### Requirement 5: Error Handling and Port Conflicts
**User Story:** As a SafeTube user, I want the application to handle port conflicts gracefully, so that the app can still start even if the preferred port is in use.

#### Acceptance Criteria
1. WHEN the preferred port is already in use THEN the system SHALL attempt to use an alternative port
2. WHEN the HTTP server fails to start THEN the system SHALL log a clear error message with troubleshooting information
3. WHEN the HTTP server fails to start THEN the application SHALL either fall back to file:// protocol OR display a user-friendly error message
4. WHEN a port conflict is resolved by using an alternative port THEN the system SHALL log the new port number

### Requirement 6: Security and CSP Updates
**User Story:** As a SafeTube developer, I want the Content Security Policy to be updated for the localhost server, so that all resources load correctly while maintaining security.

#### Acceptance Criteria
1. WHEN the renderer is served via HTTP THEN the CSP SHALL allow connections to `http://localhost:[port]`
2. WHEN the CSP is updated THEN it SHALL continue to allow all existing YouTube domains and local file access
3. WHEN serving via HTTP THEN the system SHALL set appropriate Referrer-Policy headers for YouTube iframe compatibility
4. WHEN serving via HTTP THEN the system SHALL maintain the existing CORS headers for cross-origin requests

### Requirement 7: YouTube Iframe Functionality
**User Story:** As a SafeTube user, I want YouTube videos to play correctly in iframe embeds, so that I can watch YouTube content without errors.

#### Acceptance Criteria
1. WHEN a YouTube video is loaded in an iframe embed THEN it SHALL play without error 153
2. WHEN the HTTP server is running THEN YouTube iframes SHALL receive proper HTTP Referer headers
3. WHEN a YouTube video is played THEN all existing YouTube iframe API functionality SHALL continue to work correctly
