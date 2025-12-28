import { SourceTimeState } from '../../shared/types';

/**
 * TimeTrackingService - Renderer-side service for time tracking operations
 *
 * Provides methods for querying and managing source-level time tracking.
 * All methods call IPC handlers that interact with the main process database.
 */
export class TimeTrackingService {
  /**
   * Get current time state for a specific source
   * @param sourceId - The source ID to check
   * @returns Promise<SourceTimeState> with current usage and limit info
   */
  static async getSourceTimeState(sourceId: string): Promise<SourceTimeState> {
    try {
      const state = await window.electron.timeTracking.getSourceState(sourceId);
      console.debug(`[TimeTrackingService] Got source time state for ${sourceId}:`, state);
      return state;
    } catch (error) {
      console.error(`[TimeTrackingService] Error getting source time state for ${sourceId}:`, error);
      throw error;
    }
  }

  /**
   * Grant temporary time extension for a specific source
   * @param sourceId - The source ID to extend
   * @param minutesAdded - Minutes to add to today's limit
   * @param reason - Optional reason for the extension
   * @returns Promise<SourceTimeState> with updated state after extension
   */
  static async grantSourceExtension(
    sourceId: string,
    minutesAdded: number,
    reason?: string
  ): Promise<SourceTimeState> {
    try {
      const state = await window.electron.timeTracking.grantSourceExtension(
        sourceId,
        minutesAdded,
        reason
      );
      console.debug(`[TimeTrackingService] Granted extension for ${sourceId}: +${minutesAdded} min`, state);
      return state;
    } catch (error) {
      console.error(`[TimeTrackingService] Error granting extension for ${sourceId}:`, error);
      throw error;
    }
  }

  /**
   * Get current time state for all sources
   * @returns Promise<SourceTimeState[]> array of all source time states
   */
  static async getAllSourceStates(): Promise<SourceTimeState[]> {
    try {
      const states = await window.electron.timeTracking.getAllSourceStates();
      console.debug(`[TimeTrackingService] Got time states for ${states.length} sources`);
      return states;
    } catch (error) {
      console.error(`[TimeTrackingService] Error getting all source time states:`, error);
      throw error;
    }
  }

  /**
   * Format time remaining for display
   * @param sourceTimeState - The source time state to format
   * @returns Formatted string: "Unlimited" or "Xm Ys"
   */
  static formatTimeRemaining(sourceTimeState: SourceTimeState): string {
    if (sourceTimeState.dailyLimitMinutes === null) {
      return 'Unlimited';
    }

    const secondsRemaining = sourceTimeState.secondsRemainingToday ?? 0;
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;

    return `${minutes}m ${seconds}s`;
  }

  /**
   * Get standard extension options for quick access
   * @returns Array of minute values for quick extension buttons
   */
  static getExtensionOptions(): number[] {
    return [5, 10, 15, 30];
  }
}
