import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LocalFolderNavigator } from '../LocalFolderNavigator';

// Mock the electron API
const mockElectron = {
  getLocalFolderContents: vi.fn(),
  getLocalVideoDuration: vi.fn(),
  getFolderVideoCount: vi.fn(),
  getWatchedVideos: vi.fn(),
  getTimeTrackingState: vi.fn(),
  loadVideosFromSources: vi.fn(),
  getTimeLimits: vi.fn()
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
  };
});

const defaultProps = {
  sourcePath: '/home/user/videos',
  maxDepth: 3,
  sourceTitle: 'My Videos',
  onBackClick: vi.fn(),
  onVideoClick: vi.fn(),
  sourceId: 'local-videos'
};

const renderLocalFolderNavigator = (props = {}) => {
  const finalProps = { ...defaultProps, ...props };

  return render(
    <MemoryRouter>
      <LocalFolderNavigator {...finalProps} />
    </MemoryRouter>
  );
};

describe('LocalFolderNavigator Breadcrumb Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockElectron.getWatchedVideos.mockResolvedValue([]);
    mockElectron.getTimeTrackingState.mockResolvedValue({
      timeRemaining: 1800,
      timeLimitToday: 3600,
      timeUsedToday: 1800,
      isLimitReached: false
    });
    mockElectron.getTimeLimits.mockResolvedValue({
      warningThresholdMinutes: 5
    });
    mockElectron.getLocalFolderContents.mockResolvedValue({
      folders: [],
      videos: [],
      depth: 1
    });
    mockElectron.loadVideosFromSources.mockResolvedValue({
      videosBySource: [{ id: 'local-videos', path: '/home/user/videos' }]
    });
  });

  it('should show source as active when at source root', async () => {
    renderLocalFolderNavigator();

    // Wait for component to load
    await screen.findByText('My Videos', { selector: 'h1' });

    // Source should be active (bold, non-clickable) when at root
    const breadcrumbNav = screen.getByRole('navigation');
    expect(breadcrumbNav).toBeInTheDocument();

    // Home should be clickable
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();

    // Source should be active (not clickable)
    expect(screen.queryByRole('button', { name: 'My Videos' })).not.toBeInTheDocument();

    // Check breadcrumb navigation contains the active source title
    const breadcrumbNav1 = screen.getByRole('navigation');
    const activeSourceInBreadcrumb = breadcrumbNav1.querySelector('.font-semibold');
    expect(activeSourceInBreadcrumb).toHaveTextContent('My Videos');
  });

  it('should show source as clickable when in subfolder', async () => {
    renderLocalFolderNavigator({
      initialFolderPath: '/home/user/videos/subfolder'
    });

    // Wait for component to load
    await screen.findByText('subfolder', { selector: 'h1' });

    // Source should be clickable when in subfolder
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Videos' })).toBeInTheDocument();

    // Current folder should be active (not clickable)
    expect(screen.queryByRole('button', { name: 'subfolder' })).not.toBeInTheDocument();

    // Check breadcrumb navigation contains the active folder title
    const breadcrumbNav2 = screen.getByRole('navigation');
    const activeFolderInBreadcrumb = breadcrumbNav2.querySelector('.font-semibold');
    expect(activeFolderInBreadcrumb).toHaveTextContent('subfolder');
  });

  it('should create correct navigation paths for nested folders', async () => {
    renderLocalFolderNavigator({
      initialFolderPath: '/home/user/videos/sports/judo'
    });

    // Wait for component to load
    await screen.findByText('judo', { selector: 'h1' });

    // Check breadcrumb structure: Home > My Videos > sports > judo
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Videos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sports' })).toBeInTheDocument();

    // Current folder (judo) should be active
    expect(screen.queryByRole('button', { name: 'judo' })).not.toBeInTheDocument();

    // Check breadcrumb navigation contains the active folder title
    const breadcrumbNav3 = screen.getByRole('navigation');
    const activeFolderInBreadcrumb = breadcrumbNav3.querySelector('.font-semibold');
    expect(activeFolderInBreadcrumb).toHaveTextContent('judo');
  });

  it('should handle missing sourceId gracefully', async () => {
    renderLocalFolderNavigator({
      sourceId: undefined,
      initialFolderPath: '/home/user/videos/subfolder'
    });

    // Wait for component to load
    await screen.findByText('subfolder', { selector: 'h1' });

    // Home should still be clickable
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();

    // Source should not be clickable without sourceId
    expect(screen.queryByRole('button', { name: 'My Videos' })).not.toBeInTheDocument();
    expect(screen.getByText('My Videos')).not.toHaveClass('font-semibold'); // Not active either
  });
});