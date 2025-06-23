import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// HOISTED MOCK: This ensures the mock is always used, even if other files import fileUtils first
vi.mock('../shared/fileUtils', () => ({
  readTimeLimits: vi.fn(),
  readUsageLog: vi.fn(),
  writeUsageLog: vi.fn(),
  readWatchedVideos: vi.fn(),
  writeWatchedVideos: vi.fn(),
}));

describe('Time Tracking', () => {
  let timeTracking: any;
  let mockReadTimeLimits: any;
  let mockReadUsageLog: any;
  let mockWriteUsageLog: any;
  let mockReadWatchedVideos: any;
  let mockWriteWatchedVideos: any;

  beforeEach(async () => {
    // Clear all mocks and reset modules to ensure clean state
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the mocked modules
    const fileUtils = await import('../shared/fileUtils');
    mockReadTimeLimits = vi.mocked(fileUtils.readTimeLimits);
    mockReadUsageLog = vi.mocked(fileUtils.readUsageLog);
    mockWriteUsageLog = vi.mocked(fileUtils.writeUsageLog);
    mockReadWatchedVideos = vi.mocked(fileUtils.readWatchedVideos);
    mockWriteWatchedVideos = vi.mocked(fileUtils.writeWatchedVideos);
    
    // Setup default mocks BEFORE importing the module under test
    mockReadTimeLimits.mockResolvedValue({
      Monday: 120,
      Tuesday: 120,
      Wednesday: 120,
      Thursday: 120,
      Friday: 120,
      Saturday: 180,
      Sunday: 180
    });
    
    mockReadUsageLog.mockResolvedValue({});
    mockReadWatchedVideos.mockResolvedValue([]);
    mockWriteUsageLog.mockResolvedValue();
    mockWriteWatchedVideos.mockResolvedValue();
    
    // Import the module under test after mocks are set
    timeTracking = await import('../shared/timeTracking');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getCurrentDate', () => {
    it('should return current date in YYYY-MM-DD format', () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      const result = timeTracking.getCurrentDate();
      
      expect(result).toBe('2024-01-15');
      vi.useRealTimers();
    });
  });

  describe('getDayOfWeek', () => {
    it('should return correct day of week', () => {
      expect(timeTracking.getDayOfWeek('2024-01-15')).toBe('Monday'); // Jan 15, 2024 is a Monday
      expect(timeTracking.getDayOfWeek('2024-01-16')).toBe('Tuesday');
      expect(timeTracking.getDayOfWeek('2024-01-20')).toBe('Saturday');
      expect(timeTracking.getDayOfWeek('2024-01-21')).toBe('Sunday');
    });
  });

  describe('getTimeLimitForToday', () => {
    it('should return time limit for today', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z'); // Monday
      vi.setSystemTime(mockDate);
      
      const result = await timeTracking.getTimeLimitForToday();
      
      expect(result).toBe(120); // Monday limit
      expect(mockReadTimeLimits).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should return 0 when no limit is set for the day', async () => {
      mockReadTimeLimits.mockResolvedValue({
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
        Sunday: 0
      });
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      const result = await timeTracking.getTimeLimitForToday();
      
      expect(result).toBe(0);
      vi.useRealTimers();
    });
  });

  describe('getTimeUsedToday', () => {
    it('should return time used today', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-15': 3600,
        '2024-01-14': 1800
      });
      
      const result = await timeTracking.getTimeUsedToday();
      
      expect(result).toBe(3600);
      expect(mockReadUsageLog).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should return 0 when no usage for today', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-14': 1800
      });
      
      const result = await timeTracking.getTimeUsedToday();
      
      expect(result).toBe(0);
      vi.useRealTimers();
    });
  });

  describe('addTimeUsedToday', () => {
    it('should add time to today\'s usage', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-15': 1800,
        '2024-01-14': 3600
      });
      
      await timeTracking.addTimeUsedToday(900);
      
      expect(mockReadUsageLog).toHaveBeenCalled();
      expect(mockWriteUsageLog).toHaveBeenCalledWith({
        '2024-01-15': 2700, // 1800 + 900
        '2024-01-14': 3600
      });
      vi.useRealTimers();
    });

    it('should create new entry when no usage for today', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-14': 3600
      });
      
      await timeTracking.addTimeUsedToday(900);
      
      expect(mockWriteUsageLog).toHaveBeenCalledWith({
        '2024-01-15': 900,
        '2024-01-14': 3600
      });
      vi.useRealTimers();
    });
  });

  describe('getTimeTrackingState', () => {
    it('should return complete time tracking state', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z'); // Monday
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-15': 1800 // 30 minutes used
      });
      
      const result = await timeTracking.getTimeTrackingState();
      
      expect(result).toEqual({
        currentDate: '2024-01-15',
        timeUsedToday: 1800,
        timeLimitToday: 7200, // 120 minutes * 60 seconds
        timeRemaining: 5400, // 7200 - 1800
        isLimitReached: false
      });
      vi.useRealTimers();
    });

    it('should handle limit reached case', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-15': 7200 // 2 hours used (limit reached)
      });
      
      const result = await timeTracking.getTimeTrackingState();
      
      expect(result.isLimitReached).toBe(true);
      expect(result.timeRemaining).toBe(0);
      vi.useRealTimers();
    });
  });

  describe('formatTimeRemaining', () => {
    it('should format time remaining correctly', () => {
      expect(timeTracking.formatTimeRemaining(3661)).toBe('1h 1m 1s remaining');
      expect(timeTracking.formatTimeRemaining(3600)).toBe('1h 0m 0s remaining');
      expect(timeTracking.formatTimeRemaining(61)).toBe('1m 1s remaining');
      expect(timeTracking.formatTimeRemaining(30)).toBe('30s remaining');
      expect(timeTracking.formatTimeRemaining(0)).toBe('No time remaining');
      expect(timeTracking.formatTimeRemaining(-100)).toBe('No time remaining');
    });
  });

  describe('formatTimeUsed', () => {
    it('should format time used correctly', () => {
      expect(timeTracking.formatTimeUsed(3661)).toBe('1h 1m 1s used');
      expect(timeTracking.formatTimeUsed(3600)).toBe('1h 0m 0s used');
      expect(timeTracking.formatTimeUsed(61)).toBe('1m 1s used');
      expect(timeTracking.formatTimeUsed(30)).toBe('30s used');
      expect(timeTracking.formatTimeUsed(0)).toBe('0s used');
    });
  });

  describe('recordVideoWatching', () => {
    it('should record video watching time and update history', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-15': 1800
      });
      
      mockReadWatchedVideos.mockResolvedValue([
        {
          videoId: 'video1',
          position: 300,
          lastWatched: '2024-01-14T10:00:00.000Z',
          timeWatched: 600
        }
      ]);
      
      await timeTracking.recordVideoWatching('video1', 600, 300);
      
      expect(mockWriteUsageLog).toHaveBeenCalledWith({
        '2024-01-15': 2100 // 1800 + 300
      });
      
      expect(mockWriteWatchedVideos).toHaveBeenCalledWith([
        {
          videoId: 'video1',
          position: 600,
          lastWatched: expect.any(String),
          timeWatched: 900 // 600 + 300
        }
      ]);
      vi.useRealTimers();
    });

    it('should create new watched video entry when video not in history', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-15': 1800
      });
      
      mockReadWatchedVideos.mockResolvedValue([]);
      
      await timeTracking.recordVideoWatching('new-video', 300, 180);
      
      expect(mockWriteWatchedVideos).toHaveBeenCalledWith([
        {
          videoId: 'new-video',
          position: 300,
          lastWatched: expect.any(String),
          timeWatched: 180
        }
      ]);
      vi.useRealTimers();
    });
  });

  describe('getLastWatchedVideo', () => {
    it('should return most recently watched video', async () => {
      const watchedVideos = [
        {
          videoId: 'video1',
          position: 300,
          lastWatched: '2024-01-14T10:00:00.000Z',
          timeWatched: 600
        },
        {
          videoId: 'video2',
          position: 600,
          lastWatched: '2024-01-15T10:00:00.000Z',
          timeWatched: 900
        }
      ];
      
      mockReadWatchedVideos.mockResolvedValue(watchedVideos);
      
      const result = await timeTracking.getLastWatchedVideo();
      
      expect(result).toEqual(watchedVideos[1]); // video2 is more recent
    });

    it('should return null when no watched videos', async () => {
      mockReadWatchedVideos.mockResolvedValue([]);
      
      const result = await timeTracking.getLastWatchedVideo();
      
      expect(result).toBeNull();
    });
  });

  describe('resetDailyUsage', () => {
    it('should reset today\'s usage', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-15': 1800,
        '2024-01-14': 3600
      });
      
      await timeTracking.resetDailyUsage();
      
      expect(mockWriteUsageLog).toHaveBeenCalledWith({
        '2024-01-14': 3600
      });
      vi.useRealTimers();
    });
  });

  describe('getUsageHistory', () => {
    it('should return usage history for specified days', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-15': 1800,
        '2024-01-14': 3600,
        '2024-01-13': 2700,
        '2024-01-12': 900
      });
      
      const result = await timeTracking.getUsageHistory(3);
      
      expect(result).toEqual([
        { date: '2024-01-15', minutes: 30 },
        { date: '2024-01-14', minutes: 60 },
        { date: '2024-01-13', minutes: 45 }
      ]);
      vi.useRealTimers();
    });

    it('should return empty array for days with no usage', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);
      
      mockReadUsageLog.mockResolvedValue({
        '2024-01-14': 3600
      });
      
      const result = await timeTracking.getUsageHistory(3);
      
      expect(result).toEqual([
        { date: '2024-01-15', minutes: 0 },
        { date: '2024-01-14', minutes: 60 },
        { date: '2024-01-13', minutes: 0 }
      ]);
      vi.useRealTimers();
    });
  });
}); 