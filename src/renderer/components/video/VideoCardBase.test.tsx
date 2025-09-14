import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { VideoCardBase } from './VideoCardBase';
import { VideoErrorType } from '../../../shared/videoErrorHandling';
import * as Tooltip from '@radix-ui/react-tooltip';

// Mock window.electron (not needed for external links but kept for consistency)
const mockElectron = {};

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

  test('should render fallback video as external link', () => {
    const props = {
      id: 'dQw4w9WgXcQ',
      thumbnail: 'test-thumbnail.jpg',
      title: 'Test Video',
      duration: 180,
      type: 'youtube' as const,
      isAvailable: false,
      isFallback: true,
      errorInfo: {
        type: VideoErrorType.DELETED,
        message: 'Video has been deleted',
        retryable: false
      }
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Find the link element
    const linkElement = screen.getByRole('link');
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(linkElement).toHaveAttribute('target', '_blank');
    expect(linkElement).toHaveAttribute('rel', 'noopener noreferrer');

    // Verify that navigate is not called (since it's a standard link)
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

    // Verify that navigate was called
    expect(mockNavigate).toHaveBeenCalledWith('/player/dQw4w9WgXcQ');
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
        type: VideoErrorType.PRIVATE,
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
      { type: VideoErrorType.DELETED, expectedText: 'Deleted' },
      { type: VideoErrorType.PRIVATE, expectedText: 'Private' },
      { type: VideoErrorType.RESTRICTED, expectedText: 'Restricted' },
      { type: VideoErrorType.API_ERROR, expectedText: 'Unavailable' }
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

  test('should work without electron API since fallback uses standard links', () => {
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
        type: VideoErrorType.DELETED,
        message: 'Video has been deleted',
        retryable: false
      }
    };

    render(
      <TestWrapper>
        <VideoCardBase {...props} />
      </TestWrapper>
    );

    // Should still render the link correctly even without electron API
    const linkElement = screen.getByRole('link');
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    // Restore electron
    window.electron = originalElectron;
  });
});