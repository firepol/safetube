interface AudioWarningConfig {
  countdownWarningSeconds: number;
  audioWarningSeconds: number;
  useSystemBeep: boolean;
  customBeepSound?: string;
}

interface AudioWarningState {
  hasPlayedCountdownWarning: boolean;
  hasPlayedAudioWarning: boolean;
  beepCount: number;
  lastBeepTime: number;
  countdownStartTime: number; // Store when countdown warning started
}

class AudioWarningService {
  private config: AudioWarningConfig = {
    countdownWarningSeconds: 60,
    audioWarningSeconds: 10,
    useSystemBeep: true,
  };

  private state: AudioWarningState = {
    hasPlayedCountdownWarning: false,
    hasPlayedAudioWarning: false,
    beepCount: 0,
    lastBeepTime: 0,
    countdownStartTime: 0,
  };

  private audioContext: AudioContext | null = null;
  private beepInterval: any = null;

  /**
   * Initialize the audio warning service with configuration
   */
  async initialize(config: Partial<AudioWarningConfig> = {}): Promise<void> {
    // logVerbose('[AudioWarning] Initializing with config:', config);
    this.config = { ...this.config, ...config };
    // logVerbose('[AudioWarning] Final config:', this.config);
    
    // Initialize audio context for system beep
    if (this.config.useSystemBeep && typeof window !== 'undefined') {
      try {
        // Check if AudioContext is available (not available in test environment)
        if (typeof (window.AudioContext || (window as any).webkitAudioContext) === 'function') {
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          // logVerboseRenderer('[AudioWarning] Audio context initialized');
        } else {
          // AudioContext not available, disable system beep
          this.config.useSystemBeep = false;
          // logVerboseRenderer('[AudioWarning] AudioContext not available, using fallback beep');
        }
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
        this.config.useSystemBeep = false;
      }
    }
  }

  /**
   * Reset the warning state (called when video starts or time limits change)
   */
  resetState(): void {
    this.state = {
      hasPlayedCountdownWarning: false,
      hasPlayedAudioWarning: false,
      beepCount: 0,
      lastBeepTime: 0,
      countdownStartTime: 0,
    };
    this.stopBeeping();
    // logVerboseRenderer('[AudioWarning] State reset');
  }

  /**
   * Check if audio warnings should be triggered based on remaining time
   */
  checkAudioWarnings(timeRemainingSeconds: number, isVideoPlaying: boolean): void {
    // logVerbose('[AudioWarning] Checking warnings - timeRemaining:', timeRemainingSeconds, 'isVideoPlaying:', isVideoPlaying, 'config:', this.config);
    
    if (!isVideoPlaying) {
      // logVerbose('[AudioWarning] Video not playing, skipping warnings');
      return; // Don't play warnings when video is paused
    }

    // Check for countdown warning - trigger only within the configured window (e.g. 60-50 seconds)
    // logVerbose('[AudioWarning] Countdown check - timeRemaining:', timeRemainingSeconds, 'countdownThreshold:', this.config.countdownWarningSeconds, 'range:', this.config.countdownWarningSeconds - 10, 'to', this.config.countdownWarningSeconds);
    if (
      !this.state.hasPlayedCountdownWarning &&
      timeRemainingSeconds <= this.config.countdownWarningSeconds &&
      timeRemainingSeconds > this.config.countdownWarningSeconds - 10
    ) {
      // logVerbose('[AudioWarning] Triggering countdown warning at', timeRemainingSeconds, 'seconds');
      this.playCountdownWarning();
    }

    // Check for audio warning (10 seconds) - trigger when first reaching <= 10 seconds
    // This ensures it triggers even if the check happens at 7 seconds (missed 10)
    // logVerbose('[AudioWarning] Audio warning check - timeRemaining:', timeRemainingSeconds, 'audioThreshold:', this.config.audioWarningSeconds);
    
    if (
      timeRemainingSeconds <= this.config.audioWarningSeconds &&
      timeRemainingSeconds >= 0 &&
      !this.state.hasPlayedAudioWarning
    ) {
      // logVerbose('[AudioWarning] Triggering audio warning at', timeRemainingSeconds, 'seconds (first time reaching <= 10)');
      this.playAudioWarning();
    }
  }

  /**
   * Play countdown warning beeps (10 beeps at 60 seconds remaining)
   */
  private playCountdownWarning(): void {
    this.state.hasPlayedCountdownWarning = true;
    this.state.beepCount = 0;
    this.state.countdownStartTime = Date.now();
    this.startBeeping(1000); // 1 second interval
    // logVerboseRenderer('[AudioWarning] Playing countdown warning beeps');
  }

  /**
   * Play audio warning beeps (continuous beeps at 10 seconds remaining)
   */
  private playAudioWarning(): void {
    this.state.hasPlayedAudioWarning = true;
    this.state.beepCount = 0;
    this.startBeeping(1000); // 1 second interval for consistent timing
    // logVerboseRenderer('[AudioWarning] Playing audio warning beeps');
  }

  /**
   * Start beeping at specified interval
   */
  private startBeeping(intervalMs: number): void {
    this.stopBeeping(); // Clear any existing beep interval

    // Start first beep immediately (synchronously)
    this.playBeep();
    this.state.beepCount++;
    this.state.lastBeepTime = Date.now();

    const beep = () => {
      // Stop countdown warning after exactly 10 beeps (for normal 60-second scenario)
      if (this.state.hasPlayedCountdownWarning && this.state.beepCount >= 10) {
        this.stopBeeping();
        // logVerboseRenderer('[AudioWarning] Countdown warning completed');
        return;
      }
      
      // Play beep and schedule next one
      this.playBeep();
      this.state.beepCount++;
      this.state.lastBeepTime = Date.now();
      
      // Schedule next beep
      this.beepInterval = globalThis.setTimeout(beep, intervalMs);
    };

    // Schedule next beep
    this.beepInterval = globalThis.setTimeout(beep, intervalMs);
  }

  /**
   * Stop beeping
   */
  private stopBeeping(): void {
    if (this.beepInterval) {
      globalThis.clearTimeout(this.beepInterval);
      this.beepInterval = null;
    }
  }

  /**
   * Play a single beep sound
   */
  private async playBeep(): Promise<void> {
    // logVerboseRenderer('[AudioWarning] Playing beep, useSystemBeep:', this.config.useSystemBeep);
    
    // Try Web Audio API first (works better in Electron than system beep)
    const AudioContextClass = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    // Prefer Web Audio when available for reliable beep in Electron; fallback to console bell
    if (AudioContextClass) {
      try {
        if (!this.audioContext) {
          this.audioContext = new AudioContextClass();
        }
        const ctx = this.audioContext;
        if (!ctx) throw new Error('AudioContext not available');
        // Ensure context is running (Electron may start suspended until user gesture)
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch (resumeError) {
            // Fall back to system beep if resume fails
            throw resumeError;
          }
        }
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Fade in and out for better sound
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
        
        oscillator.onended = () => {
          oscillator.disconnect();
          gainNode.disconnect();
        };
        
        // logVerboseRenderer('[AudioWarning] Web Audio API beep played successfully');
        return;
      } catch (e) {
        // logVerboseRenderer('[AudioWarning] Web Audio API beep failed, falling back to system beep:', e);
      }
    }
    
    // Fallback to system beep
    // logVerboseRenderer('[AudioWarning] Using system beep (console.log)');
    // eslint-disable-next-line no-console
    console.log('\x07');
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopBeeping();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export singleton instance
export const audioWarningService = new AudioWarningService();

export { AudioWarningService }; 