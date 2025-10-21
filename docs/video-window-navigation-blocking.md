# Video Window Navigation Blocking

## Overview

When users encounter videos that cannot be embedded (e.g., region-restricted YouTube videos), SafeTube provides a "Watch in Browser" option that opens the video in a separate Electron BrowserWindow. To maintain parental control and prevent children from navigating to related videos, channel pages, or other YouTube content, we implement multi-layered navigation blocking.

## Problem Statement

YouTube's video pages contain numerous clickable elements:
- Related videos sidebar
- Channel name and avatar links
- Video title links
- Comment sections
- YouTube logo and navigation menus
- Suggested content overlays

We need to block all navigation while keeping the video player controls (play, pause, volume, fullscreen, etc.) fully functional.

## Solution Architecture

### Multi-Layered Defense Approach

We use **three complementary layers** of protection, as single-layer approaches can be bypassed:

1. **CSS Layer** - Disables pointer events on UI elements
2. **JavaScript Layer** - Intercepts and prevents click events
3. **Electron Layer** - Blocks navigation at the window level

### Layer 1: CSS Injection

**Location:** `src/main/index.ts:1446-1456`

```typescript
videoWindow.webContents.insertCSS(`
  a, button:not(video *):not(.ytp-button):not([class*="player"]):not([class*="video"]) {
    pointer-events: none !important;
    cursor: default !important;
  }
  /* Allow only video player controls */
  video, video *, .ytp-button, [class*="html5-video-player"] * {
    pointer-events: auto !important;
  }
`)
```

**How it works:**
- Disables `pointer-events` on all `<a>` tags and `<button>` elements
- Excepts video player elements using CSS selectors
- Changes cursor to default to provide visual feedback
- Uses `!important` to override YouTube's styles

**Why it's needed:**
- Provides immediate visual feedback (cursor doesn't change to pointer)
- Prevents most casual clicks without JavaScript execution
- Lightweight performance impact

**Limitations:**
- Can be bypassed via DevTools
- Doesn't prevent keyboard navigation
- Some elements might not be covered by selectors

### Layer 2: JavaScript Click Interception

**Location:** `src/main/index.ts:1458-1472`

```typescript
videoWindow.webContents.executeJavaScript(`
  document.addEventListener('click', (e) => {
    // Allow clicks on video player elements
    if (e.target.closest('video') ||
        e.target.closest('.html5-video-player') ||
        e.target.classList.contains('ytp-button')) {
      return;
    }
    // Block all other clicks
    e.preventDefault();
    e.stopPropagation();
    console.log('[Video Window] Blocked click on:', e.target);
  }, true);
`)
```

**How it works:**
- Adds capture-phase event listener (third parameter `true`)
- Checks if click target is within video player using `closest()`
- Allows player controls, blocks everything else
- Prevents default action and stops propagation
- Logs blocked clicks for debugging

**Why it's needed:**
- Catches clicks that CSS layer might miss
- Capture phase runs before YouTube's handlers
- Provides programmatic control over click behavior
- Enables debugging via console logging

**Limitations:**
- Can be removed if user opens DevTools
- Doesn't prevent programmatic navigation
- Won't catch keyboard-triggered navigation

### Layer 3: Electron Navigation Blocking

**Location:** `src/main/index.ts:1475-1495`

```typescript
// Block ALL navigation after initial load using did-start-navigation
videoWindow.webContents.on('did-start-navigation', (event, navigationUrl) => {
  if (initialLoadComplete) {
    event.preventDefault();
    console.log('[Main] Blocked navigation to:', navigationUrl);
  }
});

// Also block will-navigate as backup
videoWindow.webContents.on('will-navigate', (event, navigationUrl) => {
  if (initialLoadComplete) {
    event.preventDefault();
    console.log('[Main] Blocked will-navigate to:', navigationUrl);
  }
});

// Block new windows from opening
videoWindow.webContents.setWindowOpenHandler(({ url }) => {
  console.log('[Main] Blocked attempt to open new window for:', url);
  return { action: 'deny' };
});
```

**How it works:**
- Uses `did-start-navigation` event (most comprehensive)
- Uses `will-navigate` as backup (catches some edge cases)
- Blocks new window creation via `setWindowOpenHandler`
- Only blocks after initial page load using `initialLoadComplete` flag
- Runs in main process, cannot be bypassed from renderer

**Why it's needed:**
- Final line of defense against all navigation
- Cannot be bypassed by user (runs in main process)
- Catches programmatic navigation (e.g., `window.location.href = ...`)
- Blocks keyboard shortcuts (e.g., clicking links with Enter key)
- Prevents pop-ups and new window creation

**Why both `did-start-navigation` and `will-navigate`:**
- `did-start-navigation` fires for all navigation types (more comprehensive)
- `will-navigate` catches some edge cases that slip through
- Redundancy ensures robust blocking

## Initial Load Handling

**Location:** `src/main/index.ts:1439-1444`

```typescript
let initialLoadComplete = false;

videoWindow.webContents.on('did-finish-load', () => {
  initialLoadComplete = true;
  console.log('[Main] Initial video page load complete');
  // ... CSS and JavaScript injection happens here
});
```

**Why it's needed:**
- Must allow initial YouTube page to load
- Only block navigation after page is ready
- Prevents blocking the video page itself
- Ensures CSS/JavaScript injection happens after DOM is ready

## Event Sequence

1. `videoWindow.loadURL(videoUrl)` - Start loading YouTube video page
2. `did-finish-load` event fires - Page fully loaded
3. Set `initialLoadComplete = true`
4. Inject CSS to disable pointer events
5. Inject JavaScript click interceptor
6. Navigation blocking becomes active
7. Any subsequent navigation attempts are blocked

## Testing

To verify navigation blocking works:

1. Click "Watch in Browser" on region-restricted video
2. Wait for video to load
3. Test these scenarios:
   - ✅ **Should work:** Play/pause, volume, seek, fullscreen, quality settings
   - ❌ **Should be blocked:** Related videos, channel links, YouTube logo, comments
4. Check console for blocked click logs: `[Video Window] Blocked click on:`
5. Check main process logs: `[Main] Blocked navigation to:`

## Security Considerations

**Trust boundary:**
- Layer 1 (CSS) and Layer 2 (JavaScript) run in renderer process (untrusted)
- Layer 3 (Electron events) runs in main process (trusted)
- Renderer layers provide UX, main layer provides security

**Why multiple layers:**
- Defense in depth principle
- Renderer layers can be bypassed by determined users
- Main process layer is the ultimate security boundary
- Multiple layers catch different edge cases

**Not designed to prevent:**
- Determined users with DevTools access
- Screen recording of content
- Browser extension interference
This is a parental control feature, not a DRM system.

## Maintenance

### When YouTube updates their UI

If YouTube changes their class names or structure:

1. Update CSS selectors in Layer 1 (line 1448)
2. Update JavaScript selectors in Layer 2 (line 1462-1464)
3. Test with actual YouTube pages
4. Layer 3 will continue working regardless of UI changes

### When adding features

If you need to allow specific navigation:

1. Add exception to Layer 3 by checking `navigationUrl`
2. Update `initialLoadComplete` logic if needed
3. Consider if Layers 1 and 2 need updates

### Debugging tips

- Check console in video window: `Ctrl+Shift+I` (if DevTools enabled)
- Check main process logs: Look for `[Main] Blocked navigation to:`
- Enable verbose logging: `ELECTRON_LOG_VERBOSE=true yarn electron:dev`
- Test with `console.log` in injected JavaScript

## Related Code

- **IPC Handler:** `src/main/index.ts:1426-1502` - Complete window creation and blocking logic
- **IPC Channel:** `src/shared/ipc-channels.ts` - `IPC.UI.OPEN_VIDEO_IN_WINDOW`
- **Preload API:** `src/preload/index.ts:518` - Exposes `openVideoInWindow` to renderer
- **UI Component:** `src/renderer/components/video/VideoPlayerError.tsx:16-26` - Calls IPC method
- **Type Definitions:** `src/renderer/types.ts` - TypeScript interface

## References

- [Electron BrowserWindow Documentation](https://www.electronjs.org/docs/latest/api/browser-window)
- [Electron WebContents Events](https://www.electronjs.org/docs/latest/api/web-contents#events)
- [CSS pointer-events Property](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)
- [Event Capture Phase](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#usecapture)
