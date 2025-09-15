# Video Card UI Consistency System

## Current Issues Analysis
The current system has several problems:
1. **Inconsistent card implementations**: Mix of VideoCardBase component with custom inline JSX across different pages
2. **Grid layout inconsistencies**: Different column counts and responsive breakpoints between KidScreen (3 cols) and other pages (4 cols)
3. **Missing visual indicators**: Inconsistent watched/clicked status display and duration information
4. **Navigation fragmentation**: Top navigation missing from some pages, inconsistent back button styling
5. **Code duplication**: Multiple similar but different video card implementations instead of unified component

## Proposed Solution: Unified Video Card System

### Standardized Video Card Component
- **VideoCardBase**: Enhanced base component with `isClicked` prop for violet highlighting
- **Watched status**: Green checkmark overlay with white faded background effect
- **Responsive sizing**: Progressive card scaling from 280px to 500px across breakpoints
- **Fallback handling**: Proper thumbnail fallbacks for local videos with movie icons

### Responsive Grid System
Unified grid layout across all pages:
```css
/* Mobile */
grid-template-columns: repeat(1, minmax(280px, 1fr))

/* Tablet */
grid-template-columns: repeat(2, minmax(320px, 1fr))

/* Desktop */
grid-template-columns: repeat(3, minmax(380px, 1fr))

/* Large Desktop */
grid-template-columns: repeat(4, minmax(420px, 1fr))

/* Extra Large */
grid-template-columns: repeat(5, minmax(500px, 1fr))
```

## Implementation Plan (6 Atomic Tasks)

### Task 1: Enhance VideoCardBase Component
- [x] Add support for `isClicked` prop to show violet type label highlighting ✅
- [x] Implement watched video styling with green checkmark overlay ✅
- [x] Add white faded background effect for watched videos ✅
- [x] Ensure consistent hover effects and transitions ✅
- [x] Add fallback thumbnail handling for local videos with movie icons ✅
- **Test**: VideoCardBase component displays all status indicators correctly ✅

### Task 2: Implement Responsive Grid System
- [x] Replace auto-fit grid with fixed responsive breakpoints ✅
- [x] Implement progressive card sizing (280px→320px→380px→420px→500px) ✅
- [x] Update VideoGrid component with responsive breakpoint classes ✅
- [x] Update SourceGrid component to match VideoGrid responsiveness ✅
- [x] Test grid behavior across all screen sizes ✅
- **Test**: Cards scale appropriately on different screen sizes without jumping ✅

### Task 3: Refactor Pages to Use VideoCardBase
- [x] Update HistoryPage to use VideoGrid instead of custom implementation ✅
- [x] Update WatchedVideosPage to use VideoGrid and standardize layout ✅
- [x] Update SourcePage to use VideoGrid instead of fixed grid classes ✅
- [x] Update LocalFolderNavigator to use consistent card sizing ✅
- [x] Standardize layout structure across all pages ✅
- **Test**: All pages use consistent video card display and functionality ✅

### Task 4: Standardize Navigation
- [ ] Create shared PageHeader component for consistent navigation
- [ ] Add top navigation to HistoryPage using PageHeader
- [ ] Add top navigation to WatchedVideosPage using PageHeader
- [ ] Update SourcePage to use PageHeader for consistency
- [ ] Ensure consistent back button styling and behavior
- **Test**: Navigation works consistently across all pages ⏳

### Task 5: Code Organization Improvements
- [ ] Create `useVideoStatus` hook for consistent status checking
- [ ] Extract common pagination logic into shared utilities
- [ ] Standardize loading and error states across pages
- [ ] Create reusable video grid page template component
- **Test**: Code is well-organized with minimal duplication ⏳

### Task 6: Local Video Thumbnail Enhancements
- [ ] Improve thumbnail generation for local videos
- [ ] Add consistent fallback thumbnail system
- [ ] Implement thumbnail caching for better performance
- **Test**: Local videos display proper thumbnails or fallbacks ⏳

## Benefits
1. **Consistent visual design**: Unified video card appearance across all pages
2. **Proper status indicators**: Green checkmarks for watched videos, violet highlighting for clicked videos
3. **Responsive scaling**: Cards grow from 280px to 500px across screen sizes
4. **Code maintainability**: Single VideoCardBase component used everywhere
5. **Better UX**: Standardized navigation and intuitive visual feedback
6. **Performance optimization**: Reduced code duplication and consistent rendering

## Implementation Status

✅ **TASKS 1-3 COMPLETED**: Core video card standardization implemented and tested.

### Summary of Changes
- **3 atomic implementations** completing video card and grid standardization
- **Enhanced VideoCardBase component** with isClicked prop and watched video overlays
- **Responsive grid system** with fixed breakpoints and progressive card sizing
- **Unified page layouts** using VideoGrid across HistoryPage, WatchedVideosPage, SourcePage
- **Comprehensive testing** ensuring consistent functionality across all pages

### Benefits Achieved
1. ✅ **Consistent visual design**: All pages now use unified VideoCardBase component
2. ✅ **Proper status indicators**: Green checkmarks and white faded overlays for watched videos
3. ✅ **Responsive scaling**: Cards scale from 280px to 500px across screen sizes
4. ✅ **Code maintainability**: Eliminated duplicate video card implementations
5. ✅ **Better UX**: Violet type label highlighting for clicked videos
6. ✅ **Fallback handling**: Movie icons for local videos without thumbnails

## Task 4: Standardize Navigation System

**Status**: ⏳ Next Task

Create unified navigation component for consistent top-level navigation across all pages.

### Components to Create
- **PageHeader component**: Reusable navigation header with title, back button, and optional right content
- **Navigation integration**: Add to HistoryPage, WatchedVideosPage, and enhance SourcePage
- **Consistent styling**: Unified back button appearance and behavior

### Files to Update
- Create new `src/renderer/components/layout/PageHeader.tsx`
- Update `src/renderer/pages/HistoryPage.tsx`
- Update `src/renderer/components/video/WatchedVideosPage.tsx`
- Update `src/renderer/pages/SourcePage.tsx`

### Benefits of Navigation Standardization
- **Consistent UX**: Same navigation pattern across all pages
- **Better accessibility**: Standardized keyboard navigation and focus management
- **Easier maintenance**: Single navigation component to update
- **Visual consistency**: Uniform back button styling and positioning

**Test**: Navigation works consistently across all pages with proper back button functionality ⏳

---

## Current Status

**TASKS 1-3**: ✅ Completed - Video card and grid standardization fully implemented
**TASK 4**: ⏳ Ready to begin - Navigation standardization
**TASKS 5-6**: ⏳ Planned - Code organization and thumbnail enhancements