import { renderHook, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useVideoStatus } from './useVideoStatus';

// Mock window.electron
const mockGetWatchedVideos = vi.fn();
Object.defineProperty(window, 'electron', {
  value: {
    getWatchedVideos: mockGetWatchedVideos
  },
  writable: true
});

describe('useVideoStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should initialize with loading state', () => {
    mockGetWatchedVideos.mockResolvedValue([]);

    const { result } = renderHook(() => useVideoStatus());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.watchedVideos).toEqual([]);
  });

  test('should load watched videos successfully', async () => {
    const mockWatchedVideos = [
      {
        videoId: 'video1',
        position: 100,
        lastWatched: '2025-01-01T10:00:00Z',
        timeWatched: 300,
        watched: true
      },
      {
        videoId: 'video2',
        position: 50,
        lastWatched: '2025-01-01T11:00:00Z',
        timeWatched: 150,
        watched: false
      }
    ];

    mockGetWatchedVideos.mockResolvedValue(mockWatchedVideos);

    const { result } = renderHook(() => useVideoStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(null);
    expect(result.current.watchedVideos).toEqual(mockWatchedVideos);
  });

  test('should handle loading error', async () => {
    mockGetWatchedVideos.mockRejectedValue(new Error('Failed to load'));

    const { result } = renderHook(() => useVideoStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load watched videos');
    expect(result.current.watchedVideos).toEqual([]);
  });

  test('should get video status correctly', async () => {
    const mockWatchedVideos = [
      {
        videoId: 'watched-video',
        position: 100,
        lastWatched: '2025-01-01T10:00:00Z',
        timeWatched: 300,
        watched: true
      },
      {
        videoId: 'clicked-video',
        position: 50,
        lastWatched: '2025-01-01T11:00:00Z',
        timeWatched: 150,
        watched: false
      }
    ];

    mockGetWatchedVideos.mockResolvedValue(mockWatchedVideos);

    const { result } = renderHook(() => useVideoStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Test watched video
    const watchedStatus = result.current.getVideoStatus('watched-video');
    expect(watchedStatus).toEqual({ isWatched: true, isClicked: true });

    // Test clicked but not watched video
    const clickedStatus = result.current.getVideoStatus('clicked-video');
    expect(clickedStatus).toEqual({ isWatched: false, isClicked: true });

    // Test unknown video
    const unknownStatus = result.current.getVideoStatus('unknown-video');
    expect(unknownStatus).toEqual({ isWatched: false, isClicked: false });
  });

  test('should get multiple video statuses correctly', async () => {
    const mockWatchedVideos = [
      {
        videoId: 'video1',
        position: 100,
        lastWatched: '2025-01-01T10:00:00Z',
        timeWatched: 300,
        watched: true
      },
      {
        videoId: 'video2',
        position: 50,
        lastWatched: '2025-01-01T11:00:00Z',
        timeWatched: 150,
        watched: false
      }
    ];

    mockGetWatchedVideos.mockResolvedValue(mockWatchedVideos);

    const { result } = renderHook(() => useVideoStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const statuses = result.current.getMultipleVideoStatuses(['video1', 'video2', 'video3']);

    expect(statuses.get('video1')).toEqual({ isWatched: true, isClicked: true });
    expect(statuses.get('video2')).toEqual({ isWatched: false, isClicked: true });
    expect(statuses.get('video3')).toEqual({ isWatched: false, isClicked: false });
  });

  test('should refresh watched videos', async () => {
    const initialWatchedVideos = [
      {
        videoId: 'video1',
        position: 100,
        lastWatched: '2025-01-01T10:00:00Z',
        timeWatched: 300,
        watched: true
      }
    ];

    const updatedWatchedVideos = [
      ...initialWatchedVideos,
      {
        videoId: 'video2',
        position: 50,
        lastWatched: '2025-01-01T11:00:00Z',
        timeWatched: 150,
        watched: false
      }
    ];

    mockGetWatchedVideos
      .mockResolvedValueOnce(initialWatchedVideos)
      .mockResolvedValueOnce(updatedWatchedVideos);

    const { result } = renderHook(() => useVideoStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.watchedVideos).toEqual(initialWatchedVideos);

    // Refresh
    await result.current.refreshWatchedVideos();

    // Wait for the refresh to complete
    await waitFor(() => {
      expect(result.current.watchedVideos).toEqual(updatedWatchedVideos);
    });
  });

  test('should handle refresh error', async () => {
    mockGetWatchedVideos
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Refresh failed'));

    const { result } = renderHook(() => useVideoStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(null);

    // Refresh with error
    await result.current.refreshWatchedVideos();

    // Wait for the error to be set
    await waitFor(() => {
      expect(result.current.error).toBe('Failed to refresh watched videos');
    });
  });
});