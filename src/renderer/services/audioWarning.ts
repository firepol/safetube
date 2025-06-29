import { logVerbose } from '@/shared/logging';

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
  };

  private audioContext: AudioContext | null = null;
  private beepInterval: any = null;

  /**
   * Initialize the audio warning service with configuration
   */
  async initialize(config: Partial<AudioWarningConfig> = {}): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Initialize audio context for system beep
    if (this.config.useSystemBeep && typeof window !== 'undefined') {
      try {
        // Check if AudioContext is available (not available in test environment)
        if (typeof (window.AudioContext || (window as any).webkitAudioContext) === 'function') {
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          logVerbose('[AudioWarning] Audio context initialized');
        } else {
          // AudioContext not available, disable system beep
          this.config.useSystemBeep = false;
          logVerbose('[AudioWarning] AudioContext not available, using fallback beep');
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
    };
    this.stopBeeping();
    logVerbose('[AudioWarning] State reset');
  }

  /**
   * Check if audio warnings should be triggered based on remaining time
   */
  checkAudioWarnings(timeRemainingSeconds: number, isVideoPlaying: boolean): void {
    const roundedTime = Math.round(timeRemainingSeconds * 10) / 10;
    logVerbose('[AudioWarning] Checking warnings - timeRemaining:', roundedTime, 'isVideoPlaying:', isVideoPlaying);
    
    if (!isVideoPlaying) {
      logVerbose('[AudioWarning] Video not playing, skipping warnings');
      return; // Don't play warnings when video is paused
    }

    // Check for countdown warning (60 seconds) - trigger between 60-50 seconds
    if (
      timeRemainingSeconds <= this.config.countdownWarningSeconds &&
      timeRemainingSeconds > this.config.countdownWarningSeconds - 10 &&
      !this.state.hasPlayedCountdownWarning
    ) {
      logVerbose('[AudioWarning] Triggering countdown warning at', roundedTime, 'seconds');
      this.playCountdownWarning();
    }

    // Check for audio warning (10 seconds) - trigger when first reaching <= 10 seconds
    // This ensures it triggers even if the check happens at 7 seconds (missed 10)
    if (
      timeRemainingSeconds <= this.config.audioWarningSeconds &&
      timeRemainingSeconds >= 0 &&
      !this.state.hasPlayedAudioWarning
    ) {
      logVerbose('[AudioWarning] Triggering audio warning at', roundedTime, 'seconds (first time reaching <= 10)');
      this.playAudioWarning();
    }
  }

  /**
   * Play countdown warning beeps (10 beeps at 60 seconds remaining)
   */
  private playCountdownWarning(): void {
    this.state.hasPlayedCountdownWarning = true;
    this.state.beepCount = 0;
    this.startBeeping(1000); // 1 second interval
    logVerbose('[AudioWarning] Playing countdown warning beeps');
  }

  /**
   * Play audio warning beeps (continuous beeps at 10 seconds remaining)
   */
  private playAudioWarning(): void {
    this.state.hasPlayedAudioWarning = true;
    this.state.beepCount = 0;
    this.startBeeping(1000); // 1 second interval for consistent timing
    logVerbose('[AudioWarning] Playing audio warning beeps');
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
      // Stop countdown warning after exactly 10 beeps
      if (this.state.hasPlayedCountdownWarning && this.state.beepCount >= 10) {
        this.stopBeeping();
        logVerbose('[AudioWarning] Countdown warning completed (10 beeps)');
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
  private playBeep(): void {
    logVerbose('[AudioWarning] Playing beep, useSystemBeep:', this.config.useSystemBeep);
    
    // Try Web Audio API first (works better in Electron than system beep)
    const AudioContextClass = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (AudioContextClass && !this.config.useSystemBeep) {
      try {
        if (!this.audioContext) {
          this.audioContext = new AudioContextClass();
        }
        const ctx = this.audioContext;
        if (!ctx) throw new Error('AudioContext not available');
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, ctx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Fade in and out for better sound
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
        
        oscillator.onended = () => {
          oscillator.disconnect();
          gainNode.disconnect();
        };
        
        logVerbose('[AudioWarning] Web Audio API beep played successfully');
        return;
      } catch (e) {
        logVerbose('[AudioWarning] Web Audio API beep failed, falling back to system beep:', e);
      }
    }
    
    // Fallback to system beep
    logVerbose('[AudioWarning] Using system beep (console.log)');
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