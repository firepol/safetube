import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PlayerPage } from './PlayerPage';
import { vi } from 'vitest';

// Mock console.error to suppress error messages during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Mock window.electron for time tracking IPC
beforeAll(() => {
  window.electron = {
    getTimeTrackingState: vi.fn().mockResolvedValue({ 
      timeRemaining: 1800, 
      timeLimitToday: 3600,
      timeUsedToday: 1800,
      isLimitReached: false 
    }),
    getTimeLimits: vi.fn().mockResolvedValue({
      warningThresholdMinutes: 3,
      countdownWarningSeconds: 60
    }),
    recordVideoWatching: vi.fn().mockResolvedValue({ success: true }),
    getLocalFile: vi.fn().mockResolvedValue('file:///test/video.mp4'),
    getDlnaFile: vi.fn().mockResolvedValue('http://test/dlna.mp4'),
    getVideoStreams: vi.fn().mockResolvedValue({
      videoStreams: [
        { url: 'https://test/video.mp4', quality: '720p', mimeType: 'video/mp4' }
      ],
      audioTracks: []
    })
  } as any;
});

describe('PlayerPage', () => {
  it('renders the back button and time remaining', async () => {
    render(
      <MemoryRouter initialEntries={['/player/f2_3sQu7lA4']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerPage />} />
        </Routes>
      </MemoryRouter>
    );
    
    expect(screen.getByText('← Back')).toBeInTheDocument();
    await waitFor(() => {
      // Look for the time indicator with the new structure
      const timeIndicator = screen.getByTestId('time-indicator-root');
      expect(timeIndicator).toBeInTheDocument();
      // Check that it shows time remaining in the new format
      expect(within(timeIndicator).getAllByText(/30:00/).length).toBeGreaterThan(0);
    });
  });

  it('shows loading and then plays video', async () => {
    render(
      <MemoryRouter initialEntries={['/player/f2_3sQu7lA4']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerPage />} />
        </Routes>
      </MemoryRouter>
    );
    
    // Loading state
    await waitFor(() => {
      expect(screen.getByText(/Loading video/)).toBeInTheDocument();
    });
    
    // Video title should be displayed
    await waitFor(() => {
      expect(screen.getByText('The Top 10 Goals of May | Top Goals | Serie A 2024/25')).toBeInTheDocument();
    });
  });

  it('shows video not found for invalid ID', () => {
    render(
      <MemoryRouter initialEntries={['/player/invalid-id']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerPage />} />
        </Routes>
      </MemoryRouter>
    );
    
    expect(screen.getByText('← Back')).toBeInTheDocument();
    expect(screen.getByText('Video not found')).toBeInTheDocument();
  });

  it('displays time limit reached message when limit is reached', async () => {
    // Mock time limit reached
    window.electron.getTimeTrackingState = vi.fn().mockResolvedValue({ 
      timeRemaining: 0, 
      timeLimitToday: 3600,
      timeUsedToday: 3600,
      isLimitReached: true 
    });

    render(
      <MemoryRouter initialEntries={['/player/f2_3sQu7lA4']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerPage />} />
        </Routes>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      // Look for the time indicator showing limit reached (red color)
      const timeIndicator = screen.getByTestId('time-indicator-root');
      expect(timeIndicator).toBeInTheDocument();
      // Check that the time shows 60:00 / 60:00 in red
      const timeElement = within(timeIndicator).getByText(/60:00/);
      expect(timeElement).toHaveClass('text-red-600');
      // Check for 100% in the progress bar
      expect(screen.getByText(/100\s*%/)).toBeInTheDocument();
    });
  });

  it('handles local video files', async () => {
    render(
      <MemoryRouter initialEntries={['/player/local-1']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerPage />} />
        </Routes>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Tai Otoshi')).toBeInTheDocument();
    });
    
    // Should call getLocalFile for local videos
    expect(window.electron.getLocalFile).toHaveBeenCalled();
  });

  it('handles DLNA video files', async () => {
    render(
      <MemoryRouter initialEntries={['/player/dlna-1']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerPage />} />
        </Routes>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Star Trek: Lower Decks S04E01 DLNA')).toBeInTheDocument();
    });
    
    // Should call getDlnaFile for DLNA videos
    expect(window.electron.getDlnaFile).toHaveBeenCalled();
  });

  it('implements Time\'s Up behavior when limit is reached during playback', async () => {
    // Mock time limit not reached initially
    window.electron.getTimeTrackingState = vi.fn()
      .mockResolvedValueOnce({
        timeRemaining: 1800,
        timeLimitToday: 3600,
        timeUsedToday: 1800,
        isLimitReached: false
      })
      .mockResolvedValue({
        timeRemaining: 0,
        timeLimitToday: 3600,
        timeUsedToday: 3600,
        isLimitReached: true
      });

    // Mock document.fullscreenElement
    Object.defineProperty(document, 'fullscreenElement', {
      writable: true,
      value: null
    });

    // Mock document.exitFullscreen
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/player/f2_3sQu7lA4']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerPage />} />
          <Route path="/time-up" element={<div>Time's Up Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('The Top 10 Goals of May | Top Goals | Serie A 2024/25')).toBeInTheDocument();
    });

    // Simulate time limit being reached after 3.5 seconds (after the interval check)
    await new Promise(resolve => setTimeout(resolve, 3500));

    // Verify that getTimeTrackingState was called at least twice (initial + interval)
    const mockedGetTimeTrackingState = vi.mocked(window.electron.getTimeTrackingState);
    expect(mockedGetTimeTrackingState.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Verify navigation to Time's Up page
    expect(screen.getByText("Time's Up Page")).toBeInTheDocument();
  });
});