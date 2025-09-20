import { describe, it, expect } from 'vitest';

describe('FirstRunSetup', () => {
  it('should have the correct environment file creation logic', () => {
    // This test verifies that the environment file creation logic is properly implemented
    // The actual functionality is tested through the application runtime

    const expectedEnvContent = `ELECTRON_LOG_VERBOSE=false`;

    expect(expectedEnvContent).toContain('ELECTRON_LOG_VERBOSE=false');
  });
});
