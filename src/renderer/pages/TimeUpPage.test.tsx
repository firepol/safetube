import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TimeUpPage } from './TimeUpPage';
import { vi } from 'vitest';

// Mock the time tracking functions
vi.mock('@/shared/timeTracking', () => ({
  getCurrentDate: vi.fn().mockReturnValue('2024-01-15'),
  getDayOfWeek: vi.fn().mockReturnValue('Monday'),
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('TimeUpPage', () => {
  let mockGetTimeLimits: any;
  let mockGetCurrentDate: any;
  let mockGetDayOfWeek: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    
    // Mock window.electron
    window.electron = {
      getTimeLimits: vi.fn().mockResolvedValue({
        Monday: 30,
        Tuesday: 45,
        Wednesday: 30,
        Thursday: 30,
        Friday: 60,
        Saturday: 90,
        Sunday: 90
      })
    } as any;
    
    const timeTracking = await import('@/shared/timeTracking');
    
    mockGetTimeLimits = vi.mocked(window.electron.getTimeLimits);
    mockGetCurrentDate = vi.mocked(timeTracking.getCurrentDate);
    mockGetDayOfWeek = vi.mocked(timeTracking.getDayOfWeek);
  });

  it('renders loading state initially', () => {
    renderWithRouter(<TimeUpPage />);
    expect(screen.getByText('Loading schedule...')).toBeInTheDocument();
  });

  it('renders the time up message and schedule', async () => {
    renderWithRouter(<TimeUpPage />);
    
    await waitFor(() => {
      expect(screen.getByText("Time's Up for Today!")).toBeInTheDocument();
      expect(screen.getByText("Here's your weekly viewing schedule:")).toBeInTheDocument();
      expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
    });
  });

  it('displays all days of the week with their time limits', async () => {
    renderWithRouter(<TimeUpPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Monday')).toBeInTheDocument();
      expect(screen.getByText('Tuesday')).toBeInTheDocument();
      expect(screen.getByText('Wednesday')).toBeInTheDocument();
      expect(screen.getByText('Thursday')).toBeInTheDocument();
      expect(screen.getByText('Friday')).toBeInTheDocument();
      expect(screen.getByText('Saturday')).toBeInTheDocument();
      expect(screen.getByText('Sunday')).toBeInTheDocument();
      
      // Check for specific time formats that should be unique
      expect(screen.getByText('45 minutes')).toBeInTheDocument();
      expect(screen.getByText('1 hour')).toBeInTheDocument();
      // Check that 1 hour 30 minutes appears (multiple times is expected)
      const ninetyMinutesElements = screen.getAllByText('1 hour 30 minutes');
      expect(ninetyMinutesElements.length).toBeGreaterThan(0);
      // Check that 30 minutes appears (multiple times is expected)
      const thirtyMinutesElements = screen.getAllByText('30 minutes');
      expect(thirtyMinutesElements.length).toBeGreaterThan(0);
    });
  });

  it('highlights the current day in red and bold', async () => {
    renderWithRouter(<TimeUpPage />);
    
    await waitFor(() => {
      const mondayElement = screen.getByText('Monday').closest('div');
      expect(mondayElement).toHaveClass('bg-red-50', 'border-red-300');
      expect(screen.getByText('Today')).toBeInTheDocument();
    });
  });

  it('shows error state when time limits fail to load', async () => {
    mockGetTimeLimits.mockRejectedValue(new Error('Failed to load'));
    
    renderWithRouter(<TimeUpPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Error loading schedule')).toBeInTheDocument();
    });
  });

  it('formats time limits correctly', async () => {
    mockGetTimeLimits.mockResolvedValue({
      Monday: 0,
      Tuesday: 30,
      Wednesday: 60,
      Thursday: 90,
      Friday: 120,
      Saturday: 180,
      Sunday: 240
    });
    
    renderWithRouter(<TimeUpPage />);
    
    await waitFor(() => {
      expect(screen.getByText('No time')).toBeInTheDocument();
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
      expect(screen.getByText('1 hour')).toBeInTheDocument();
      expect(screen.getByText('1 hour 30 minutes')).toBeInTheDocument();
      expect(screen.getByText('2 hours')).toBeInTheDocument();
      expect(screen.getByText('3 hours')).toBeInTheDocument();
      expect(screen.getByText('4 hours')).toBeInTheDocument();
    });
  });
}); 