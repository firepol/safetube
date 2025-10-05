# Dialog Components

This directory contains reusable dialog components for the SafeTube application.

## DenyReasonDialog

A dialog component for entering a reason when denying a wishlist video request.

### Features

- **Text Input**: Multi-line textarea for entering denial reason
- **Character Limit**: 500 character limit with real-time counter
- **Validation**: Input validation with visual feedback
- **Keyboard Shortcuts**: 
  - `Ctrl+Enter` to confirm
  - `Escape` to cancel
- **Loading State**: Disabled state during IPC operations
- **Responsive Design**: Works on all screen sizes

### Usage

```tsx
import { DenyReasonDialog } from './DenyReasonDialog';
import { useWishlistDeny } from '../../hooks/useWishlistDeny';

function MyComponent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { denyVideo, isLoading, error } = useWishlistDeny();

  const handleConfirmDeny = async (reason: string) => {
    const success = await denyVideo(videoId, reason);
    if (success) {
      setIsDialogOpen(false);
    }
  };

  return (
    <DenyReasonDialog
      isOpen={isDialogOpen}
      onClose={() => setIsDialogOpen(false)}
      onConfirm={handleConfirmDeny}
      videoTitle="Video Title"
      isLoading={isLoading}
    />
  );
}
```

### Props

- `isOpen: boolean` - Controls dialog visibility
- `onClose: () => void` - Called when dialog should close
- `onConfirm: (reason: string) => void` - Called when user confirms with reason
- `videoTitle?: string` - Optional video title to display
- `isLoading?: boolean` - Shows loading state and disables interactions

## useWishlistDeny Hook

A custom hook for handling wishlist video denial with IPC integration.

### Features

- **IPC Integration**: Calls `window.electron.wishlistDeny(videoId, reason)`
- **Loading State**: Tracks operation progress
- **Error Handling**: Captures and exposes errors
- **Type Safety**: Fully typed with TypeScript

### Usage

```tsx
import { useWishlistDeny } from '../../hooks/useWishlistDeny';

function MyComponent() {
  const { denyVideo, isLoading, error, clearError } = useWishlistDeny();

  const handleDeny = async () => {
    const success = await denyVideo('video123', 'Inappropriate content');
    if (success) {
      // Handle success
    } else {
      // Handle error (error state is automatically set)
    }
  };

  return (
    <div>
      <button onClick={handleDeny} disabled={isLoading}>
        Deny Video
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### Return Value

- `denyVideo: (videoId: string, reason?: string) => Promise<boolean>` - Deny video function
- `isLoading: boolean` - Loading state
- `error: string | null` - Error message if operation failed
- `clearError: () => void` - Clear error state

## Testing

Both components are fully tested with comprehensive test suites:

- **DenyReasonDialog.test.tsx**: Tests all dialog functionality
- **useWishlistDeny.test.ts**: Tests hook behavior and IPC integration

Run tests with:
```bash
npm test -- --run src/renderer/components/dialogs/DenyReasonDialog.test.tsx src/renderer/hooks/useWishlistDeny.test.ts
```