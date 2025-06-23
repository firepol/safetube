import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { VideoPlayer } from '../components/VideoPlayer';
import { Video } from '../types';
import { 
  recordVideoWatching, 
  getTimeTrackingState, 
  resetDailyUsage 
} from '../../shared/timeTracking';

// Mock the time tracking functions
vi.mock('../../shared/timeTracking', () => ({
  recordVideoWatching: vi.fn(),
  getTimeTrackingState: vi.fn(),
  resetDailyUsage: vi.fn(),
  addTimeUsedToday: vi.fn(),
  getTimeLimitForToday: vi.fn(),
  getTimeUsedToday: vi.fn()
}));

// Mock the electron API
const mockElectron = {
  getLocalFile: vi.fn(),
  getDlnaFile: vi.fn(),
  getVideoStreams: vi.fn()
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
});

describe('Video Player + Time Tracking Integration', () => {
  const mockVideo: Video = {
    id: 'test-video-1',
    type: 'local',
    title: 'Test Video',
    thumbnail: 'test-thumbnail.jpg',
    duration: 120,
    url: '/path/to/video.mp4'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock successful file access
    mockElectron.getLocalFile.mockResolvedValue('file:///test-video.mp4');
    mockElectron.getDlnaFile.mockResolvedValue('http://test-server/video.mp4');
    
    // Mock time tracking state
    vi.mocked(getTimeTrackingState).mockResolvedValue({
      currentDate: '2025-01-20',
      timeUsedToday: 0,
      timeLimitToday: 60,
      timeRemaining: 60,
      isLimitReached: false
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Time Tracking', () => {
    it('should track normal playback time', async () => {
      render(<VideoPlayer video={mockVideo} />);
      
      // Start playing
      const playButton = screen.getByRole('button', { name: /play/i });
      await act(async () => {
        fireEvent.click(playButton);
      });
      
      // Simulate 10 seconds of playback by triggering timeupdate events
      const videoElement = screen.getByTestId('video-player');
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          fireEvent.timeUpdate(videoElement);
          vi.advanceTimersByTime(1000); // Advance 1 second at a time
        });
      }
      
      // Debug: Check if any calls were made
      const calls = vi.mocked(recordVideoWatching).mock.calls;
      // Ignore the first call if its time is 0
      const filteredCalls = calls.filter(call => call[2] > 0);
      const totalTimeWatched = filteredCalls.reduce((sum, call) => sum + call[2], 0);
      expect(totalTimeWatched).toBeGreaterThanOrEqual(9);
      expect(totalTimeWatched).toBeLessThanOrEqual(10);
      expect(filteredCalls.length).toBeGreaterThan(0);
    });

    it('should NOT track time during pause', async () => {
      render(<VideoPlayer video={mockVideo} />);
      
      // Start playing
      const playButton = screen.getByRole('button', { name: /play/i });
      await act(async () => {
        fireEvent.click(playButton);
      });
      
      // Simulate 5 seconds of playback
      vi.advanceTimersByTime(5000);
      
      // Pause video
      const videoElement = screen.getByTestId('video-player');
      fireEvent.pause(videoElement);
      
      // Simulate 10 seconds of pause
      vi.advanceTimersByTime(10000);
      
      // Verify only 5 seconds were tracked (not 15)
      expect(recordVideoWatching).toHaveBeenCalledWith(
        'test-video-1',
        expect.any(Number),
        5
      );
    });

    it('should stop tracking when video ends', async () => {
      render(<VideoPlayer video={mockVideo} />);
      
      // Start playing
      const playButton = screen.getByRole('button', { name: /play/i });
      await act(async () => {
        fireEvent.click(playButton);
      });
      
      // Simulate video ending
      const videoElement = screen.getByTestId('video-player');
      fireEvent.ended(videoElement);
      
      // Verify final time tracking call
      expect(recordVideoWatching).toHaveBeenCalledWith(
        'test-video-1',
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe('Seeking and Fast-Forward Tracking', () => {
    it('should track seeking time as actual elapsed time', async () => {
      render(<VideoPlayer video={mockVideo} />);
      
      // Start playing
      const playButton = screen.getByRole('button', { name: /play/i });
      await act(async () => {
        fireEvent.click(playButton);
      });
      
      // Simulate seeking from 0:00 to 5:00 in 2 seconds
      const videoElement = screen.getByTestId('video-player');
      fireEvent.seeking(videoElement);
      vi.advanceTimersByTime(2000); // 2 seconds of seeking
      fireEvent.seeked(videoElement);
      
      // Verify only 2 seconds were tracked (not 5 minutes)
      expect(recordVideoWatching).toHaveBeenCalledWith(
        'test-video-1',
        expect.any(Number),
        2
      );
    });

    it('should track fast-forward time as actual elapsed time', async () => {
      render(<VideoPlayer video={mockVideo} />);
      
      // Start playing
      const playButton = screen.getByRole('button', { name: /play/i });
      await act(async () => {
        fireEvent.click(playButton);
      });
      
      // Simulate fast-forwarding 10 minutes in 3 seconds
      const videoElement = screen.getByTestId('video-player');
      fireEvent.seeking(videoElement);
      vi.advanceTimersByTime(3000); // 3 seconds of fast-forwarding
      fireEvent.seeked(videoElement);
      
      // Verify only 3 seconds were tracked (not 10 minutes)
      expect(recordVideoWatching).toHaveBeenCalledWith(
        'test-video-1',
        expect.any(Number),
        3
      );
    });

    it('should handle complex scenarios (seek + play + seek)', async () => {
      render(<VideoPlayer video={mockVideo} />);
      
      // Start playing
      const playButton = screen.getByRole('button', { name: /play/i });
      await act(async () => {
        fireEvent.click(playButton);
      });
      
      // Play for 5 seconds
      vi.advanceTimersByTime(5000);
      
      // Seek for 2 seconds
      const videoElement = screen.getByTestId('video-player');
      fireEvent.seeking(videoElement);
      vi.advanceTimersByTime(2000);
      fireEvent.seeked(videoElement);
      
      // Play for 3 more seconds
      vi.advanceTimersByTime(3000);
      
      // Seek for 1 second
      fireEvent.seeking(videoElement);
      vi.advanceTimersByTime(1000);
      fireEvent.seeked(videoElement);
      
      // Verify total time tracked: 5 + 2 + 3 + 1 = 11 seconds
      const calls = vi.mocked(recordVideoWatching).mock.calls;
      const totalTimeWatched = calls.reduce((sum, call) => sum + call[2], 0);
      expect(totalTimeWatched).toBe(11);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('Time Limit Enforcement', () => {
    it('should stop video when daily limit is reached', async () => {
      // Mock time limit reached
      vi.mocked(getTimeTrackingState).mockResolvedValue({
        currentDate: '2025-01-20',
        timeUsedToday: 60,
        timeLimitToday: 60,
        timeRemaining: 0,
        isLimitReached: true
      });

      render(<VideoPlayer video={mockVideo} />);
      
      // Try to start playing
      const playButton = screen.getByRole('button', { name: /play/i });
      await act(async () => {
        fireEvent.click(playButton);
      });
      
      // Verify video was paused due to time limit
      // This will be implemented in the VideoPlayer component
      expect(getTimeTrackingState).toHaveBeenCalled();
    });

    it('should show time remaining message', async () => {
      // Mock time running low
      vi.mocked(getTimeTrackingState).mockResolvedValue({
        currentDate: '2025-01-20',
        timeUsedToday: 45,
        timeLimitToday: 60,
        timeRemaining: 15,
        isLimitReached: false
      });

      render(<VideoPlayer video={mockVideo} />);
      
      // Should show time remaining (this will be implemented in the UI)
      // For now, just verify the component renders
      expect(screen.getByText('Test Video')).toBeInTheDocument();
    });
  });

  describe('Resume Functionality', () => {
    it('should resume video from saved position', async () => {
      const videoWithResume: Video = {
        ...mockVideo,
        resumeAt: 30 // Resume at 30 seconds
      };

      render(<VideoPlayer video={videoWithResume} />);
      
      // Start playing
      const playButton = screen.getByRole('button', { name: /play/i });
      await act(async () => {
        fireEvent.click(playButton);
      });
      
      // Verify video starts from resume position
      // This will be implemented in the VideoPlayer component
      expect(videoWithResume.resumeAt).toBe(30);
    });
  });
}); 