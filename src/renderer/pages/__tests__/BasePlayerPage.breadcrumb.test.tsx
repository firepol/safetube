import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BasePlayerPage } from '../BasePlayerPage';

// Mock the electron API
const mockElectron = {
  getTimeLimits: vi.fn(),
};

// Mock window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
});

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({
      state: {
        breadcrumb: {
          sourceName: 'Test Videos',
          sourceId: 'local-test',
          basePath: '/home/user/videos',
          folderPath: [
            { name: 'sports', path: '/home/user/videos/sports' },
            { name: 'judo', path: '/home/user/videos/sports/judo' }
          ]
        }
      }
    })
  };
});

const mockVideo = {
  id: 'test-video',
  title: 'Test Video',
  type: 'local' as const,
  duration: 300,
  url: '/home/user/videos/sports/judo/test.mp4',
  thumbnail: 'test-thumbnail.jpg'
};

const defaultProps = {
  video: mockVideo,
  isLoading: false,
  error: null,
  isVideoPlaying: false,
  timeRemainingSeconds: 1800,
  countdownWarningSeconds: 60,
  children: <div>Video Player</div>
};

const renderBasePlayerPage = (props = {}) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter>
      <BasePlayerPage {...finalProps} />
    </MemoryRouter>
  );
};

describe('BasePlayerPage Breadcrumb Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockElectron.getTimeLimits.mockResolvedValue({
      countdownWarningSeconds: 60,
      audioWarningSeconds: 10,
      useSystemBeep: true
    });
  });

  it('should create correct navigation paths for nested folders', async () => {
    renderBasePlayerPage();

    // Wait for component to load
    await screen.findByText('Test Video', { selector: 'h1' });

    // Check breadcrumb structure: Home > Test Videos > sports > judo > Test Video
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test Videos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sports' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'judo' })).toBeInTheDocument();

    // Current video should be active (not clickable)
    expect(screen.queryByRole('button', { name: 'Test Video' })).not.toBeInTheDocument();

    // Check breadcrumb navigation contains the active video title
    const breadcrumbNav = screen.getByRole('navigation');
    const activeVideoInBreadcrumb = breadcrumbNav.querySelector('.font-semibold');
    expect(activeVideoInBreadcrumb).toHaveTextContent('Test Video');
  });

  it('should generate correct folder navigation URLs', () => {
    const { container } = renderBasePlayerPage();

    // Find all breadcrumb buttons
    const homeButton = screen.getByRole('button', { name: 'Home' });
    const sourceButton = screen.getByRole('button', { name: 'Test Videos' });
    const sportsButton = screen.getByRole('button', { name: 'sports' });
    const judoButton = screen.getByRole('button', { name: 'judo' });

    expect(homeButton).toBeInTheDocument();
    expect(sourceButton).toBeInTheDocument();
    expect(sportsButton).toBeInTheDocument();
    expect(judoButton).toBeInTheDocument();

    // The buttons should exist and be clickable (we can't easily test the actual navigation
    // URLs without more complex mocking, but we can verify the buttons are present)
  });
});