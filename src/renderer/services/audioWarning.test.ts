import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioWarningService } from './audioWarning';

// Mock console.log for beep testing only
const mockConsoleLog = vi.fn();

describe('AudioWarningService', () => {
  let audioWarningService: AudioWarningService;

  beforeEach(() => {
    vi.useFakeTimers();
    // Only mock the beep calls, not all console.log
    const originalConsoleLog = console.log;
    console.log = vi.fn((...args) => {
      // Only mock beep calls (\x07), pass through other calls
      if (args[0] === '\x07') {
        mockConsoleLog(...args);
      } else {
        originalConsoleLog(...args);
      }
    });
    
    // Remove AudioContext so system beep is used in tests
    // @ts-ignore
    delete (globalThis as any).AudioContext;
    // @ts-ignore
    delete (globalThis as any).webkitAudioContext;
    // Re-instantiate service after mocking
    audioWarningService = new AudioWarningService();
    // Force system beep for tests
    // @ts-ignore
    audioWarningService.config.useSystemBeep = true;
    audioWarningService.resetState();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    audioWarningService.destroy();
    vi.clearAllMocks();
  });

  it('initializes with default configuration', async () => {
    await audioWarningService.initialize({ useSystemBeep: false });
    // Should not throw any errors
    expect(true).toBe(true);
  });

  it('initializes with custom configuration', async () => {
    await audioWarningService.initialize({
      countdownWarningSeconds: 30,
      audioWarningSeconds: 5,
      useSystemBeep: false,
    });
    // Should not throw any errors
    expect(true).toBe(true);
  });

  it('does not trigger warnings when video is paused', () => {
    // Should not trigger any warnings when video is not playing
    audioWarningService.checkAudioWarnings(60, false);
    audioWarningService.checkAudioWarnings(10, false);
    
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('triggers countdown warning at 60 seconds', () => {
    audioWarningService.checkAudioWarnings(60, true);
    vi.advanceTimersByTime(0); // Trigger first beep
    expect(mockConsoleLog).toHaveBeenCalledWith('\x07');
  });

  it('triggers countdown warning between 60-50 seconds', () => {
    audioWarningService.checkAudioWarnings(55, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).toHaveBeenCalledWith('\x07');
  });

  it('does not trigger countdown warning after 50 seconds', () => {
    // Check at 49 seconds (should not trigger countdown warning)
    audioWarningService.checkAudioWarnings(49, true);
    
    // Should not trigger countdown warning
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('does not trigger countdown warning when starting below the configured window', () => {
    // Reset state to simulate fresh start
    audioWarningService.resetState();
    
    // Check at 35 seconds (below 50s window start) - should NOT trigger countdown
    audioWarningService.checkAudioWarnings(35, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('triggers audio warning at 10 seconds', () => {
    audioWarningService.checkAudioWarnings(10, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).toHaveBeenCalledWith('\x07');
  });

  it('triggers audio warning between 10-0 seconds', () => {
    // Check at 5 seconds
    audioWarningService.checkAudioWarnings(5, true);
    
    // Should trigger audio warning
    expect(mockConsoleLog).toHaveBeenCalledWith('\x07');
  });

  it('triggers audio warning at 0 seconds', () => {
    // Check at 0 seconds (should trigger audio warning)
    audioWarningService.checkAudioWarnings(0, true);
    
    // Should trigger audio warning
    expect(mockConsoleLog).toHaveBeenCalledWith('\x07');
  });

  it('only triggers countdown warning once', () => {
    audioWarningService.checkAudioWarnings(60, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    audioWarningService.checkAudioWarnings(59, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
  });

  it('only triggers audio warning once', () => {
    audioWarningService.checkAudioWarnings(10, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    audioWarningService.checkAudioWarnings(9, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
  });

  it('resets state correctly', () => {
    audioWarningService.checkAudioWarnings(60, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    audioWarningService.resetState();
    audioWarningService.checkAudioWarnings(60, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).toHaveBeenCalledTimes(2);
  });

  it('plays countdown warning for 10 beeps', () => {
    audioWarningService.checkAudioWarnings(60, true);
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1000);
    }
    expect(mockConsoleLog).toHaveBeenCalledTimes(10);
  });

  it('stops countdown warning after 10 beeps', () => {
    audioWarningService.checkAudioWarnings(60, true);
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1000);
    }
    vi.advanceTimersByTime(5000);
    expect(mockConsoleLog).toHaveBeenCalledTimes(10);
  });

  it('plays audio warning continuously until time is up', () => {
    audioWarningService.checkAudioWarnings(10, true);
    // First beep is synchronous, then 5 scheduled at 1-second intervals
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(1000);
    }
    expect(mockConsoleLog).toHaveBeenCalledTimes(6);
  });

  it('handles both warnings correctly', () => {
    audioWarningService.checkAudioWarnings(60, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    audioWarningService.resetState();
    audioWarningService.checkAudioWarnings(10, true);
    vi.advanceTimersByTime(0);
    expect(mockConsoleLog).toHaveBeenCalledTimes(2);
  });
}); 