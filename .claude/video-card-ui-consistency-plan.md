# Video Card UI Consistency Plan

## Analysis Summary

After analyzing the current video card implementations across all pages, I've identified significant inconsistencies in design, layout, and code organization that need to be addressed.

## Current Issues Identified

### 1. Inconsistent Video Card Implementations
- **VideoCardBase component** (src/renderer/components/video/VideoCardBase.tsx): Well-structured base component with proper props, thumbnails, duration display, progress bars, resume functionality
- **HistoryPage video cards** (src/renderer/pages/HistoryPage.tsx): Custom implementation with inline JSX, different styling, missing duration display, has borders
- **WatchedVideosPage video cards** (src/renderer/components/video/WatchedVideosPage.tsx): Similar to HistoryPage but slightly different styling
- **SourceGrid component** (src/renderer/components/layout/SourceGrid.tsx): Different card style for source thumbnails

### 2. Grid Layout Inconsistencies
- **KidScreen (SourceGrid)**: 3 columns on full screen (md:grid-cols-2 lg:grid-cols-3)
- **SourcePage**: 4 columns maximum (md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4)
- **HistoryPage**: 4 columns maximum (md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4)
- **WatchedVideosPage**: 4 columns maximum (md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4)

### 3. Missing Features Across Pages
- **Duration display**: Missing in HistoryPage and WatchedVideosPage video cards
- **Progress bars**: Missing in HistoryPage and WatchedVideosPage
- **Resume functionality**: Missing in HistoryPage and WatchedVideosPage
- **Watched status visual indicators**: Missing consistent checkmark overlays
- **Clicked status visual indicators**: Missing violet highlighting mentioned by user

### 4. Navigation Issues
- **Top navigation**: Only available at bottom of some pages, missing from top level
- **Inconsistent back button styling**: Different implementations across pages

### 5. Code Duplication
- Multiple inline video card implementations instead of using VideoCardBase
- Similar but slightly different styling patterns repeated
- No shared navigation component

## Proposed Solution

### Phase 1: Standardize Video Card Component

#### 1.1 Enhance VideoCardBase Component
- Add support for `isClicked` prop to show violet highlighting
- Improve watched video styling with checkmark overlay (restore previous implementation)
- Add configuration for showing/hiding duration, progress bar, resume info
- Ensure consistent hover effects and transitions

#### 1.2 Update CSS Classes for Video Status
```css
.watched {
  opacity: 0.8;
  position: relative;
}

.watched::after {
  content: '✓';
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 255, 0, 0.8);
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
}

.clicked {
  border: 2px solid #8b5cf6;
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.2);
}
```

### Phase 2: Standardize Grid Layouts with Responsive Card Sizing

#### 2.1 Create Responsive Grid with Scaling Cards
- Replace fixed column count with responsive card sizing
- Use CSS Grid with `auto-fit` and `minmax()` for optimal card distribution
- Cards grow larger on bigger screens up to a maximum size
- Target grid layout: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`
- Set maximum card width to prevent oversized cards on very large screens

#### 2.2 Responsive Card Container
```css
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  max-width: 100%;
}

.video-card {
  max-width: 400px; /* Prevent cards from becoming too large */
  width: 100%;
  justify-self: center;
}

@media (min-width: 1920px) {
  .video-grid {
    grid-template-columns: repeat(auto-fit, minmax(320px, 380px));
  }
}
```

#### 2.3 Update All Pages to Use Responsive Grid
- Replace fixed column grid classes with responsive auto-fit grid
- Ensure cards scale appropriately on different screen sizes
- Test on various screen sizes to optimize minimum and maximum card sizes

### Phase 3: Refactor Pages to Use VideoCardBase

#### 3.1 HistoryPage Refactoring
- Replace inline video card JSX with VideoCardBase component
- Add duration display from video data
- Remove custom borders and styling
- Apply .watched and .clicked CSS classes

#### 3.2 WatchedVideosPage Refactoring
- Replace inline video card JSX with VideoCardBase component
- Add duration display from video data
- Apply consistent styling

#### 3.3 SourcePage Enhancement
- Ensure consistent use of VideoCardBase
- Apply .watched and .clicked status classes based on video status

### Phase 4: Standardize Navigation

#### 4.1 Create Shared Navigation Component
```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBackClick: () => void;
  backButtonText?: string;
  rightContent?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  onBackClick,
  backButtonText = "← Back",
  rightContent
}) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center space-x-4">
      <button
        onClick={onBackClick}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200"
      >
        {backButtonText}
      </button>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>
    </div>
    {rightContent}
  </div>
);
```

#### 4.2 Update All Pages to Use PageHeader
- HistoryPage: Add navigation to top using PageHeader
- WatchedVideosPage: Add navigation to top using PageHeader
- SourcePage: Update to use PageHeader for consistency

### Phase 5: Code Organization Improvements

#### 5.1 Extract Video Status Logic
- Create `useVideoStatus` hook for consistent status checking
- Centralize watched/clicked status determination
- Ensure consistent status application across all pages

#### 5.2 Create Video Grid Pages Base Component
- Extract common pagination logic
- Standardize loading and error states
- Create reusable video grid page template

### Phase 6: Local Video Thumbnail Handling

#### 6.1 Improve Local Video Support
- Add placeholder thumbnail generation for local videos
- Ensure consistent fallback thumbnails
- Handle missing thumbnails gracefully in VideoCardBase

## Implementation Order

1. **Phase 1**: Enhance VideoCardBase and add CSS classes
2. **Phase 2**: Implement responsive grid layouts with scaling cards
3. **Phase 3**: Refactor all pages to use VideoCardBase
4. **Phase 4**: Add standardized navigation
5. **Phase 5**: Code organization improvements
6. **Phase 6**: Local video thumbnail improvements

## Expected Benefits

### User Experience
- Consistent visual design across all pages
- Proper video status indicators (watched checkmarks, clicked highlighting)
- Standardized navigation available at top of all pages
- Responsive card sizing that maximizes screen space utilization
- Fewer or no scrolling required on larger screens

### Developer Experience
- Reduced code duplication
- Easier maintenance with shared components
- Consistent patterns across codebase
- Better separation of concerns

### Performance
- Smaller bundle size due to code deduplication
- Consistent component reuse
- Optimized rendering with standardized components

## Testing Strategy

1. **Visual Testing**: Verify consistent appearance across all pages
2. **Functionality Testing**: Ensure all video card features work consistently
3. **Responsive Testing**: Verify grid layouts and card scaling work on all screen sizes (mobile, tablet, desktop, large desktop, ultrawide)
4. **Navigation Testing**: Ensure navigation works consistently across pages
5. **Status Testing**: Verify watched/clicked status displays correctly

## Risk Mitigation

1. **Backward Compatibility**: Ensure existing functionality is preserved
2. **Gradual Migration**: Implement changes incrementally to avoid breaking changes
3. **Fallback Support**: Maintain fallbacks for edge cases (missing thumbnails, etc.)
4. **Testing Coverage**: Comprehensive testing before each phase rollout
5. **Screen Size Testing**: Test card sizing and grid behavior across various screen resolutions