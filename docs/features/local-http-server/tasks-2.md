# Remote Parent Access Implementation Plan

## Overview

Implement a remote-accessible parent access page without rebuilding the admin panel from scratch. The strategy is to extract business logic into reusable services and add a thin HTTP API layer.

## Refactoring Strategy: Extract Business Logic + Add HTTP Layer

### Architecture

```
Current:
React Component → IPC Handler → Business Logic

New:
React Component → IPC Handler ┐
                               └→ Shared Business Logic
React Component → HTTP Handler ┘
```

## Phase 1: Minimal Changes (Extract Logic & Add HTTP Layer)

**Goal:** Get parent access page working remotely with minimal changes to existing admin panel.

### 1.1 Extract Business Logic into Services

**What:** Move all business logic out of IPC handlers into pure service functions in `/src/main/services/`

**Examples:**
- `saveVideoSources(sources)` - Add/update video sources
- `getVideoSources()` - Retrieve video sources
- `setTimeLimits(limits)` - Update daily time limits
- `getTimeLimits()` - Retrieve time limit settings
- `getUsageStats()` - Get current usage data

**Impact:**
- Time: ~2-4 hours (10-30 min per handler)
- Risk: Very low
- Changes to admin panel: None (IPC still works exactly the same)

### 1.2 Update IPC Handlers

**What:** Refactor existing IPC handlers to call the new service functions instead of containing logic

**Pattern:**
```typescript
// Before: Logic in handler
ipcMain.handle('save-video-sources', async (event, sources) => {
  // Business logic here
  const db = await getDatabase();
  await db.updateVideoSources(sources);
  // ...
});

// After: Handler calls service
ipcMain.handle('save-video-sources', async (event, sources) => {
  return await saveVideoSources(sources);
});
```

**Impact:**
- Time: ~1-2 hours
- Risk: Low (IPC contract unchanged)
- Benefit: Admin panel continues working without changes

### 1.3 Add HTTP Endpoints

**What:** Create HTTP endpoint wrappers that call the same service functions

**Pattern:**
```typescript
app.post('/api/video-sources', async (req, res) => {
  try {
    const result = await saveVideoSources(req.body.sources);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

**Endpoints needed:**
- POST `/api/video-sources` - Save video sources
- GET `/api/video-sources` - Get video sources
- POST `/api/time-limits` - Set time limits
- GET `/api/time-limits` - Get time limits
- GET `/api/usage-stats` - Get usage statistics
- POST `/api/remote-unlock` - Unlock parent controls temporarily

**Impact:**
- Time: ~1-2 hours (15 min per endpoint)
- Risk: Very low (new code, not touching existing)
- Benefit: Clean separation between IPC and HTTP APIs

### 1.4 Create Parent Access Page

**What:** New React page that calls HTTP endpoints instead of IPC

**Components:**
- Time limits management form
- Usage statistics view
- Temporary unlock controls
- Video source management (view only or edit)

**Reuse from admin panel:**
- All CSS/styling (100%)
- Type definitions (100%)
- Component UI patterns (80-90%)
- Form handling logic (70-80%)

**What's new:**
- HTTP call handlers instead of IPC
- Authentication/token validation
- Read-only or restricted access controls

**Impact:**
- Time: ~2-3 hours
- Risk: Low (isolated new feature)
- Code duplication: Minimal if components well-designed

## Phase 2: Reuse Components (Optional)

**Goal:** Eliminate UI code duplication between admin panel and parent access page

### 2.1 Extract Admin Panel Components

**What:** Create reusable component library for common UI patterns

**Examples:**
- `<TimeLimitForm />` - Form for setting daily limits
- `<VideoSourceManager />` - Video source management UI
- `<UsageStatsChart />` - Usage statistics visualization

**How:**
```typescript
// Generic component that accepts a data source
<TimeLimitForm
  data={limits}
  onSave={handleSave}
  readOnly={isParentAccess}
/>
```

**Impact:**
- Time: ~2-3 hours additional
- Risk: Medium (requires careful component abstraction)
- Benefit: True code reuse, single source of truth for UI

### 2.2 Update Admin Panel

**What:** Migrate admin panel to use reusable components

**Impact:**
- Time: ~1-2 hours
- Risk: Low (admin still functions the same)

## Reuse Analysis

### ✅ 100% Reusable
- Business logic functions (all services)
- Type definitions (`shared/types/`)
- CSS/styling modules
- Validation functions

### ⚠️ 75-85% Reusable
- UI components (with adapters for IPC vs HTTP)
- Form handling logic
- Error handling patterns

### 🆕 New Code
- HTTP endpoint wrappers (~300-500 lines)
- Parent access page UI (~400-600 lines)
- Authentication/security layer (~200-400 lines)

## Implementation Order

1. **Extract business logic** (Phase 1.1) - Creates foundation
2. **Update IPC handlers** (Phase 1.2) - Maintains admin panel compatibility
3. **Add HTTP endpoints** (Phase 1.3) - Enables remote access
4. **Create parent access page** (Phase 1.4) - Delivers feature
5. **(Optional) Refactor components** (Phase 2) - Eliminates duplication

## Security Considerations

### Authentication for Parent Access
- Add token-based auth (JWT or session cookies)
- Parent must authenticate before accessing remote page
- Rate limiting on HTTP endpoints
- Validation of all input data

### Access Control
- Parent access page can be read-only or edit-restricted
- Certain dangerous operations (delete video sources) may be admin-only
- Session timeout to prevent unauthorized access

## Time Estimates

**Phase 1 (Recommended):** 5-8 hours total
- Extract logic: 2-4 hours
- Update handlers: 1-2 hours
- Add HTTP endpoints: 1-2 hours
- Create parent page: 2-3 hours

**Phase 2 (Optional):** 4-6 hours additional
- Extract components: 2-3 hours
- Refactor admin panel: 1-2 hours

**Total:** 5-8 hours (Phase 1 only) or 9-14 hours (both phases)

## Risk Assessment

**Overall risk: LOW**

- Phase 1: Minimal risk (new code doesn't touch existing)
- Phase 2: Low risk (admin panel refactoring is optional)
- Rollback: Can be skipped if HTTP layer works well

## Success Criteria

- ✅ Admin panel continues to work exactly as before (Electron)
- ✅ Parent can access time limits and usage from remote page
- ✅ Remote page loads from `http://192.168.x.x:3000/parent-access`
- ✅ No code duplication between admin and parent page
- ✅ Security: Authentication required for remote access
- ✅ All business logic tested via both IPC and HTTP
