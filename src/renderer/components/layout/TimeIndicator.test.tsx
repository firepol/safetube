import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TimeIndicator, TimeTrackingState } from './TimeIndicator';

// Always mock the electron API
const mockGetTimeTrackingState = vi.fn();
const mockGetTimeLimits = vi.fn();
Object.defineProperty(window, 'electron', {
  value: {
    getTimeTrackingState: mockGetTimeTrackingState,
    getTimeLimits: mockGetTimeLimits
  },
  writable: true
});

describe('TimeIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for getTimeLimits
    mockGetTimeLimits.mockResolvedValue({
      warningThresholdMinutes: 3
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const mockTimeState: TimeTrackingState = {
    timeRemaining: 1800, // 30 minutes
    timeLimit: 3600, // 60 minutes
    timeUsed: 1800, // 30 minutes
    isLimitReached: false
  };

  it('renders loading state initially when no initialState provided', async () => {
    mockGetTimeTrackingState.mockResolvedValueOnce({
      timeRemaining: 1800,
      timeLimitToday: 3600,
      timeUsedToday: 1800,
      isLimitReached: false
    });
    render(<TimeIndicator />);
    expect(screen.getByText('Loading time...')).toBeInTheDocument();
    // Wait for update
    await waitFor(() => {
      expect(screen.getByText('30:00')).toBeInTheDocument();
      expect(screen.getByText('60:00')).toBeInTheDocument();
      expect(screen.getByText('30:00 min')).toBeInTheDocument();
    });
  });

  it('renders time information with initialState', () => {
    render(<TimeIndicator initialState={mockTimeState} />);
    expect(screen.getByText('30:00')).toBeInTheDocument();
    expect(screen.getByText('60:00')).toBeInTheDocument();
    expect(screen.getByText('30:00 min')).toBeInTheDocument();
  });

  it('shows orange color when time is low', () => {
    const lowTimeState: TimeTrackingState = {
      timeRemaining: 120, // 2 minutes
      timeLimit: 3600, // 60 minutes
      timeUsed: 3480, // 58 minutes
      isLimitReached: false
    };
    render(<TimeIndicator initialState={lowTimeState} />);
    const timeElement = screen.getByText('58:00');
    expect(timeElement).toHaveClass('text-orange-600');
  });

  it('shows green color when time is sufficient', () => {
    render(<TimeIndicator initialState={mockTimeState} />);
    const timeElement = screen.getByText('30:00');
    expect(timeElement).toHaveClass('text-green-600');
  });

  it('shows limit reached message when isLimitReached is true', () => {
    const limitReachedState: TimeTrackingState = {
      timeRemaining: 0,
      timeLimit: 3600,
      timeUsed: 3600,
      isLimitReached: true
    };
    render(<TimeIndicator initialState={limitReachedState} />);
    expect(screen.getByText('⏰ Daily time limit reached')).toBeInTheDocument();
    expect(screen.getByText('⏰ Daily time limit reached')).toHaveClass('text-red-600');
  });

  it('fetches time state when no initialState provided', async () => {
    mockGetTimeTrackingState.mockResolvedValueOnce({
      timeRemaining: 900,
      timeLimitToday: 3600,
      timeUsedToday: 2700,
      isLimitReached: false
    });
    render(<TimeIndicator />);
    await waitFor(() => {
      expect(screen.getByText('45:00')).toBeInTheDocument();
      expect(screen.getByText('60:00')).toBeInTheDocument();
      expect(screen.getByText('15:00 min')).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    render(<TimeIndicator initialState={mockTimeState} className="custom-class" />);
    const container = screen.getByText('30:00').closest('div');
    expect(container).toHaveClass('custom-class');
  });

  it('uses configurable warning threshold', async () => {
    // Mock a custom warning threshold of 5 minutes
    mockGetTimeLimits.mockResolvedValue({
      warningThresholdMinutes: 5
    });

    // State with 4 minutes remaining (should be orange with 5-minute threshold)
    const lowTimeState: TimeTrackingState = {
      timeRemaining: 240, // 4 minutes
      timeLimit: 3600, // 60 minutes
      timeUsed: 3360, // 56 minutes
      isLimitReached: false
    };

    render(<TimeIndicator initialState={lowTimeState} />);
    
    // Wait for the warning threshold to be fetched
    await waitFor(() => {
      const timeElement = screen.getByText('56:00');
      expect(timeElement).toHaveClass('text-orange-600');
    });
  });

  it('falls back to default warning threshold when not configured', async () => {
    // Mock no warning threshold configured
    mockGetTimeLimits.mockResolvedValue({});

    // State with 2 minutes remaining (should be orange with default 3-minute threshold)
    const lowTimeState: TimeTrackingState = {
      timeRemaining: 120, // 2 minutes
      timeLimit: 3600, // 60 minutes
      timeUsed: 3480, // 58 minutes
      isLimitReached: false
    };

    render(<TimeIndicator initialState={lowTimeState} />);
    
    // Wait for the warning threshold to be fetched
    await waitFor(() => {
      const timeElement = screen.getByText('58:00');
      expect(timeElement).toHaveClass('text-orange-600');
    });
  });
}); 