import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { TimeIndicator, TimeTrackingState } from './TimeIndicator';

// Mock console.error to suppress error messages during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

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
      warningThresholdMinutes: 3,
      countdownWarningSeconds: 60
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
      const container = screen.getByText('⏰').closest('div');
      // Use getAllByText and check length
      expect(within(container!).getAllByText(/30:00/).length).toBeGreaterThan(0);
      expect(within(container!).getAllByText(/60:00/).length).toBeGreaterThan(0);
      expect(within(container!).getAllByText(/30:00\s*min/).length).toBeGreaterThan(0);
    });
  });

  it('renders time information with initialState', () => {
    render(<TimeIndicator initialState={mockTimeState} />);
    const container = screen.getByText('⏰').closest('div');
    expect(within(container!).getAllByText(/30:00/).length).toBeGreaterThan(0);
    expect(within(container!).getAllByText(/60:00/).length).toBeGreaterThan(0);
    expect(within(container!).getAllByText(/30:00\s*min/).length).toBeGreaterThan(0);
  });

  it('shows orange color when time is low', () => {
    const lowTimeState: TimeTrackingState = {
      timeRemaining: 120, // 2 minutes
      timeLimit: 3600, // 60 minutes
      timeUsed: 3480, // 58 minutes
      isLimitReached: false
    };
    render(<TimeIndicator initialState={lowTimeState} />);
    const container = screen.getByText('⏰').closest('div');
    // Find all elements with 58:00 and check one has the orange class
    const matches = within(container!).getAllByText(/58:00/);
    expect(matches.some(el => el.className.includes('text-orange-600'))).toBe(true);
  });

  it('shows green color when time is sufficient', () => {
    render(<TimeIndicator initialState={mockTimeState} />);
    const container = screen.getByText('⏰').closest('div');
    const matches = within(container!).getAllByText(/30:00/);
    expect(matches.some(el => el.className.includes('text-green-600'))).toBe(true);
  });

  it('shows limit reached message when isLimitReached is true', () => {
    const limitReachedState: TimeTrackingState = {
      timeRemaining: 0,
      timeLimit: 3600,
      timeUsed: 3600,
      isLimitReached: true
    };
    render(<TimeIndicator initialState={limitReachedState} />);
    // Should show 60:00 / 60:00 in red and [00 sec]
    const container = screen.getByText('⏰').closest('div');
    const timeElement = within(container!).getByText(/60:00/);
    expect(timeElement).toHaveClass('text-red-600');
    // Should show 100% in the percent label
    const percentLabel = screen.getByText(/100\s*%/);
    expect(percentLabel).toBeInTheDocument();
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
      const container = screen.getByText('⏰').closest('div');
      expect(within(container!).getByText(/45:00/)).toBeInTheDocument();
      expect(within(container!).getByText(/60:00/)).toBeInTheDocument();
      expect(within(container!).getByText(/15:00\s*min/)).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    render(<TimeIndicator initialState={mockTimeState} className="custom-class" />);
    // The outermost container should have the custom class
    const outer = screen.getByTestId('time-indicator-root');
    expect(outer).toHaveClass('custom-class');
  });

  it('uses configurable warning threshold', async () => {
    // Mock a custom warning threshold of 5 minutes
    mockGetTimeLimits.mockResolvedValue({
      warningThresholdMinutes: 5,
      countdownWarningSeconds: 60
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
      const container = screen.getByText('⏰').closest('div');
      const timeElement = within(container!).getByText(/56:00/);
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
      const container = screen.getByText('⏰').closest('div');
      const timeElement = within(container!).getByText(/58:00/);
      expect(timeElement).toHaveClass('text-orange-600');
    });
  });
}); 