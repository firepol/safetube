import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SourceTimeDisplay } from '../SourceTimeDisplay';
import { TimeTrackingService } from '@/renderer/services/timeTrackingService';
import { SourceTimeState } from '@/shared/types';

// Mock the TimeTrackingService
vi.mock('@/renderer/services/timeTrackingService', () => ({
  TimeTrackingService: {
    getSourceTimeState: vi.fn()
  }
}));

describe('SourceTimeDisplay Component', () => {
  const mockSourceId = 'test-source-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should display "Unlimited" when no limit is set', async () => {
    const mockState: SourceTimeState = {
      sourceId: mockSourceId,
      dailyLimitMinutes: null,
      secondsUsedToday: 100,
      secondsRemainingToday: null,
      isLimitExceeded: false,
      lastResetDate: '2025-12-28'
    };

    (TimeTrackingService.getSourceTimeState as any).mockResolvedValue(mockState);

    render(<SourceTimeDisplay sourceId={mockSourceId} />);

    await waitFor(() => {
      expect(screen.getByText('Unlimited')).toBeInTheDocument();
    });
  });

  test('should display time remaining in Xm Ys format', async () => {
    const mockState: SourceTimeState = {
      sourceId: mockSourceId,
      dailyLimitMinutes: 30,
      secondsUsedToday: 300,
      secondsRemainingToday: 1500, // 25 minutes
      isLimitExceeded: false,
      lastResetDate: '2025-12-28'
    };

    (TimeTrackingService.getSourceTimeState as any).mockResolvedValue(mockState);

    render(<SourceTimeDisplay sourceId={mockSourceId} />);

    await waitFor(() => {
      expect(screen.getByText(/25m 0s/)).toBeInTheDocument();
    });
  });

  test('should display "Limit exceeded" when limit is exceeded', async () => {
    const mockState: SourceTimeState = {
      sourceId: mockSourceId,
      dailyLimitMinutes: 10,
      secondsUsedToday: 700,
      secondsRemainingToday: 0,
      isLimitExceeded: true,
      lastResetDate: '2025-12-28'
    };

    (TimeTrackingService.getSourceTimeState as any).mockResolvedValue(mockState);

    render(<SourceTimeDisplay sourceId={mockSourceId} />);

    await waitFor(() => {
      expect(screen.getByText('Limit exceeded')).toBeInTheDocument();
    });
  });

  test('should show warning styling when less than 5 minutes remaining', async () => {
    const mockState: SourceTimeState = {
      sourceId: mockSourceId,
      dailyLimitMinutes: 10,
      secondsUsedToday: 540,
      secondsRemainingToday: 60, // 1 minute
      isLimitExceeded: false,
      lastResetDate: '2025-12-28'
    };

    (TimeTrackingService.getSourceTimeState as any).mockResolvedValue(mockState);

    const { container } = render(<SourceTimeDisplay sourceId={mockSourceId} />);

    await waitFor(() => {
      // Check for warning styling (orange/yellow background)
      const progressBar = container.querySelector('.bg-yellow-500');
      expect(progressBar).toBeInTheDocument();
    });
  });

  test('should show exceeded styling when limit is reached', async () => {
    const mockState: SourceTimeState = {
      sourceId: mockSourceId,
      dailyLimitMinutes: 10,
      secondsUsedToday: 600,
      secondsRemainingToday: 0,
      isLimitExceeded: true,
      lastResetDate: '2025-12-28'
    };

    (TimeTrackingService.getSourceTimeState as any).mockResolvedValue(mockState);

    const { container } = render(<SourceTimeDisplay sourceId={mockSourceId} />);

    await waitFor(() => {
      // Check for exceeded styling (red background)
      const progressBar = container.querySelector('.bg-red-500');
      expect(progressBar).toBeInTheDocument();
    });
  });

  test('should display progress bar with correct percentage', async () => {
    const mockState: SourceTimeState = {
      sourceId: mockSourceId,
      dailyLimitMinutes: 100,
      secondsUsedToday: 3000, // 50 minutes
      secondsRemainingToday: 3000,
      isLimitExceeded: false,
      lastResetDate: '2025-12-28'
    };

    (TimeTrackingService.getSourceTimeState as any).mockResolvedValue(mockState);

    const { container } = render(<SourceTimeDisplay sourceId={mockSourceId} />);

    await waitFor(() => {
      // Progress should be 50%
      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });
  });

  test('should show loading state initially', () => {
    (TimeTrackingService.getSourceTimeState as any).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({}), 100))
    );

    render(<SourceTimeDisplay sourceId={mockSourceId} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should show error message on fetch failure', async () => {
    (TimeTrackingService.getSourceTimeState as any).mockRejectedValue(
      new Error('Network error')
    );

    render(<SourceTimeDisplay sourceId={mockSourceId} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load time state')).toBeInTheDocument();
    });
  });

  test('should refresh time state every 60 seconds', async () => {
    const mockState: SourceTimeState = {
      sourceId: mockSourceId,
      dailyLimitMinutes: 30,
      secondsUsedToday: 300,
      secondsRemainingToday: 1500,
      isLimitExceeded: false,
      lastResetDate: '2025-12-28'
    };

    (TimeTrackingService.getSourceTimeState as any).mockResolvedValue(mockState);

    vi.useFakeTimers();

    render(<SourceTimeDisplay sourceId={mockSourceId} />);

    // Initial call
    expect(TimeTrackingService.getSourceTimeState).toHaveBeenCalledTimes(1);

    // Advance time by 60 seconds
    vi.advanceTimersByTime(60000);

    // Should have called again
    await waitFor(() => {
      expect(TimeTrackingService.getSourceTimeState).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });

  test('should handle sourceId changes', async () => {
    const mockState1: SourceTimeState = {
      sourceId: 'source-1',
      dailyLimitMinutes: 10,
      secondsUsedToday: 300,
      secondsRemainingToday: 300,
      isLimitExceeded: false,
      lastResetDate: '2025-12-28'
    };

    const mockState2: SourceTimeState = {
      sourceId: 'source-2',
      dailyLimitMinutes: 20,
      secondsUsedToday: 600,
      secondsRemainingToday: 600,
      isLimitExceeded: false,
      lastResetDate: '2025-12-28'
    };

    (TimeTrackingService.getSourceTimeState as any)
      .mockResolvedValueOnce(mockState1)
      .mockResolvedValueOnce(mockState2);

    const { rerender } = render(<SourceTimeDisplay sourceId="source-1" />);

    await waitFor(() => {
      expect(screen.getByText(/5m 0s/)).toBeInTheDocument();
    });

    rerender(<SourceTimeDisplay sourceId="source-2" />);

    await waitFor(() => {
      expect(screen.getByText(/10m 0s/)).toBeInTheDocument();
    });
  });
});
