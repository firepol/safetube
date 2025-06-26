import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TimeIndicator, TimeTrackingState } from './TimeIndicator';

// Always mock the electron API
const mockGetTimeTrackingState = vi.fn();
Object.defineProperty(window, 'electron', {
  value: {
    getTimeTrackingState: mockGetTimeTrackingState
  },
  writable: true
});

describe('TimeIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(screen.getByText('30 / 60 [30 minutes left]')).toBeInTheDocument();
    });
  });

  it('renders time information with initialState', () => {
    render(<TimeIndicator initialState={mockTimeState} />);
    expect(screen.getByText('30 / 60 [30 minutes left]')).toBeInTheDocument();
  });

  it('shows red color when time is low', () => {
    const lowTimeState: TimeTrackingState = {
      timeRemaining: 120, // 2 minutes
      timeLimit: 3600, // 60 minutes
      timeUsed: 3480, // 58 minutes
      isLimitReached: false
    };
    render(<TimeIndicator initialState={lowTimeState} />);
    const timeElement = screen.getByText('58 / 60 [2 minutes left]');
    expect(timeElement).toHaveClass('text-red-600');
  });

  it('shows green color when time is sufficient', () => {
    render(<TimeIndicator initialState={mockTimeState} />);
    const timeElement = screen.getByText('30 / 60 [30 minutes left]');
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
    expect(screen.getByText('Daily time limit reached')).toBeInTheDocument();
    expect(screen.getByText('Daily time limit reached')).toHaveClass('text-red-600');
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
      expect(screen.getByText('45 / 60 [15 minutes left]')).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    render(<TimeIndicator initialState={mockTimeState} className="custom-class" />);
    const timeElement = screen.getByText('30 / 60 [30 minutes left]');
    expect(timeElement).toHaveClass('custom-class');
  });
}); 