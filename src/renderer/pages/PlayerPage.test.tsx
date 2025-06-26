import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
      expect(screen.getByText(/minutes left/)).toBeInTheDocument();
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
      expect(screen.getByText('Daily time limit reached')).toBeInTheDocument();
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
});