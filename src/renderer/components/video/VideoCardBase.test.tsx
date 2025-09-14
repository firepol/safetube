import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { VideoCardBase } from './VideoCardBase';
import * as Tooltip from '@radix-ui/react-tooltip';

// Mock the electron API
const mockOpenExternal = vi.fn();
const mockElectron = {
  openExternal: mockOpenExternal
};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
});

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Wrapper component for tests
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <Tooltip.Provider>
      {children}
    </Tooltip.Provider>
  </BrowserRouter>
);

describe('VideoCardBase External Link Opening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should open external YouTube link when clicking fallback video', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isAvailable: false,
      isFallback: true,
      errorInfo: {
        type: 'deleted' as const,
        message: 'Video has been deleted',
        retryable: false
      }
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Find the video card by its specific class and click it
    const videoCard = screen.getByText('Video dQw4w9WgXcQ').closest('div[tabindex="0"]');
    expect(videoCard).toBeTruthy();
    fireEvent.click(videoCard!);

    // Verify that openExternal was called with the correct YouTube URL
    expect(mockOpenExternal).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('should navigate normally when clicking available video', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isAvailable: true,
      isFallback: false
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Find the video card by its title and click it
    const videoCard = screen.getByText('Test Video').closest('div[tabindex="0"]');
    expect(videoCard).toBeTruthy();
    fireEvent.click(videoCard!);

    // Verify that navigate was called and openExternal was not
    expect(mockNavigate).toHaveBeenCalledWith('/player/dQw4w9WgXcQ');
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });

  test('should display fallback UI for unavailable videos', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isAvailable: false,
      isFallback: true,
      errorInfo: {
        type: 'private' as const,
        message: 'Video is private',
        retryable: false
      }
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Check for fallback UI elements
    expect(screen.getByText('Video Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Open in browser')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('Click to open in YouTube')).toBeInTheDocument();
  });

  test('should display correct error type indicators', () => {
    const testCases = [
      { type: 'deleted' as const, expectedText: 'Deleted' },
      { type: 'private' as const, expectedText: 'Private' },
      { type: 'restricted' as const, expectedText: 'Restricted' },
      { type: 'api_error' as const, expectedText: 'Unavailable' }
    ];

    testCases.forEach(({ type, expectedText }) => {
      const props = {
        id: 'dQw4w9WgXcQ',
        thumbnail: 'test-thumbnail.jpg',
        title: 'Test Video',
        duration: 180,
        type: 'youtube' as const,
        isAvailable: false,
        isFallback: true,
        errorInfo: {
          type,
          message: 'Test error',
          retryable: false
        }
      };

      const { unmount } = render(
        <TestWrapper>
          <VideoCardBase {...props} />
        </TestWrapper>
      );

      expect(screen.getByText(expectedText)).toBeInTheDocument();
      
      unmount();
    });
  });

  test('should handle missing electron API gracefully', () => {
    // Temporarily set electron to undefined
    const originalElectron = window.electron;
    // @ts-ignore
    window.electron = undefined;

    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isAvailable: false,
      isFallback: true,
      errorInfo: {
        type: 'deleted' as const,
        message: 'Video has been deleted',
        retryable: false
      }
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Find the video card and click it - should not throw error
    const videoCard = screen.getByText('Video dQw4w9WgXcQ').closest('div[tabindex="0"]');
    expect(videoCard).toBeTruthy();
    expect(() => fireEvent.click(videoCard!)).not.toThrow();

    // Restore electron
    window.electron = originalElectron;
  });
});