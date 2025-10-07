---
inclusion: always
---

# IPC System and Build Process

## Critical Information for Development

### Auto-Generated Files

**IMPORTANT**: The file `src/preload/index.ts` is partially auto-generated and should not be manually edited in certain sections.

- **Auto-Generated Section**: The IPC channel constants at the top of the file are automatically synchronized from `src/shared/ipc-channels.ts`
- **Manual Section**: The actual preload API implementation and contextBridge.exposeInMainWorld calls are manually maintained
- **Sync Command**: Run `yarn sync-ipc` to update the IPC constants section

### IPC Channel Management

1. **Adding New IPC Channels**:
   - Define new channels in `src/shared/ipc-channels.ts`
   - Run `yarn sync-ipc` to update the preload constants
   - Add the handler implementation in the appropriate main process file
   - Add the method to the contextBridge.exposeInMainWorld object in `src/preload/index.ts`
   - Update the ElectronAPI interface in `src/renderer/types.ts`

2. **Contract Testing**:
   - Run `yarn test:contract` to verify IPC interface consistency
   - If new channels are added, update snapshots with `yarn test:contract -u`
   - The contract test ensures all defined channels have registered handlers

### Build Process Dependencies

1. **IPC Synchronization**: The build process automatically runs `yarn sync-ipc` before building main and preload processes
2. **Type Safety**: All IPC communication must be properly typed in the ElectronAPI interface
3. **Contract Validation**: The contract test validates that all IPC channels are properly implemented

### Common Issues and Solutions

1. **Build Errors Related to Missing IPC Methods**:
   - Check if `yarn sync-ipc` has been run recently
   - Verify the method exists in both the preload contextBridge and the ElectronAPI interface
   - Ensure the main process handler is registered

2. **Contract Test Failures**:
   - Usually indicates new IPC channels were added without updating snapshots
   - Run `yarn test:contract -u` to update snapshots after adding new channels
   - Review the changes to ensure they are intentional

3. **Type Errors in Renderer**:
   - Ensure the ElectronAPI interface in `src/renderer/types.ts` includes all exposed methods
   - Check that return types match between preload and renderer expectations

### Development Workflow

When adding new IPC functionality:

1. Define the channel in `src/shared/ipc-channels.ts`
2. Run `yarn sync-ipc`
3. Implement the handler in the main process
4. Add the method to preload's contextBridge
5. Update the ElectronAPI interface in renderer types
6. Run `yarn test:contract` to verify everything is connected
7. Update contract snapshots if needed with `yarn test:contract -u`

This ensures type safety and consistency across the entire IPC interface.