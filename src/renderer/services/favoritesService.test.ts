import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FavoritesService } from './favoritesService';
import { FavoriteVideo, FavoritesConfig } from '@/shared/types';

// Mock the global electron API
const mockElectron = {
  favoritesGetAll: vi.fn(),
  favoritesAdd: vi.fn(),
  favoritesRemove: vi.fn(),
  favoritesIsFavorite: vi.fn(),
  favoritesToggle: vi.fn(),
  favoritesUpdateMetadata: vi.fn(),
  favoritesGetBySource: vi.fn(),
  favoritesGetConfig: vi.fn(),
  favoritesUpdateConfig: vi.fn(),
  favoritesCleanupOrphaned: vi.fn(),
  favoritesSyncWatchHistory: vi.fn(),
};

// Mock the global window object
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
});

describe('FavoritesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FavoritesService.clearCache();
  });

  it('should get all favorites and cache them', async () => {
    const mockFavorites: FavoriteVideo[] = [
      {
        videoId: 'test-video-1',
        dateAdded: '2025-09-17T16:00:00.000Z',
        sourceType: 'youtube',
        title: 'Test Video 1',
        thumbnail: 'https://example.com/thumb1.jpg',
        duration: 120
      }
    ];

    mockElectron.favoritesGetAll.mockResolvedValue(mockFavorites);

    const result = await FavoritesService.getFavorites();

    expect(mockElectron.favoritesGetAll).toHaveBeenCalledOnce();
    expect(result).toEqual(mockFavorites);

    // Test caching - second call should not call electron again
    const cachedResult = await FavoritesService.getFavorites();
    expect(mockElectron.favoritesGetAll).toHaveBeenCalledOnce(); // Still only once
    expect(cachedResult).toEqual(mockFavorites);
  });

  it('should add a favorite with optimistic updates', async () => {
    const mockFavorite: FavoriteVideo = {
      videoId: 'test-video-2',
      dateAdded: '2025-09-17T16:00:00.000Z',
      sourceType: 'youtube',
      title: 'Test Video 2',
      thumbnail: 'https://example.com/thumb2.jpg',
      duration: 180
    };

    mockElectron.favoritesAdd.mockResolvedValue(mockFavorite);

    const result = await FavoritesService.addFavorite(
      'test-video-2',
      'test-source',
      'youtube',
      'Test Video 2',
      'https://example.com/thumb2.jpg',
      180
    );

    expect(mockElectron.favoritesAdd).toHaveBeenCalledWith(
      'test-video-2',
      'test-source',
      'youtube',
      'Test Video 2',
      'https://example.com/thumb2.jpg',
      180,
      undefined
    );
    expect(result).toEqual(mockFavorite);
  });

  it('should check if video is favorite using cache', async () => {
    const mockFavorites: FavoriteVideo[] = [
      {
        videoId: 'cached-video',
        dateAdded: '2025-09-17T16:00:00.000Z',
        sourceType: 'youtube',
        title: 'Cached Video',
        thumbnail: 'https://example.com/cached.jpg',
        duration: 90
      }
    ];

    mockElectron.favoritesGetAll.mockResolvedValue(mockFavorites);

    // First call to populate cache
    await FavoritesService.getFavorites();

    // Check if video is favorite - should use cache
    const isFavorite = await FavoritesService.isFavorite('cached-video');
    expect(isFavorite).toBe(true);

    // Check a video that's not in favorites
    const isNotFavorite = await FavoritesService.isFavorite('non-favorite-video');
    expect(isNotFavorite).toBe(false);
  });

  it('should toggle favorite status', async () => {
    const mockFavorite: FavoriteVideo = {
      videoId: 'toggle-video',
      dateAdded: '2025-09-17T16:00:00.000Z',
      sourceType: 'youtube',
      title: 'Toggle Video',
      thumbnail: 'https://example.com/toggle.jpg',
      duration: 240
    };

    mockElectron.favoritesIsFavorite.mockResolvedValue(false);
    mockElectron.favoritesToggle.mockResolvedValue(mockFavorite);

    const result = await FavoritesService.toggleFavorite(
      'toggle-video',
      'test-source',
      'youtube',
      'Toggle Video',
      'https://example.com/toggle.jpg',
      240
    );

    expect(mockElectron.favoritesToggle).toHaveBeenCalledWith(
      'toggle-video',
      'test-source',
      'youtube',
      'Toggle Video',
      'https://example.com/toggle.jpg',
      240,
      undefined
    );
    expect(result.favorite).toEqual(mockFavorite);
    expect(result.isFavorite).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    mockElectron.favoritesGetAll.mockRejectedValue(new Error('Network error'));

    await expect(FavoritesService.getFavorites()).rejects.toThrow('Network error');
  });

  it('should create favorites source for video grid', async () => {
    const mockFavorites: FavoriteVideo[] = [
      {
        videoId: 'grid-video-1',
        dateAdded: '2025-09-17T16:00:00.000Z',
        sourceType: 'youtube',
        title: 'Grid Video 1',
        thumbnail: 'https://example.com/grid1.jpg',
        duration: 120
      },
      {
        videoId: 'grid-video-2',
        dateAdded: '2025-09-17T16:01:00.000Z',
        sourceType: 'local',
        title: 'Grid Video 2',
        thumbnail: 'https://example.com/grid2.jpg',
        duration: 180
      }
    ];

    mockElectron.favoritesGetAll.mockResolvedValue(mockFavorites);

    const source = await FavoritesService.getFavoritesSource();

    expect(source.id).toBe('favorites');
    expect(source.title).toBe('Favorites');
    expect(source.type).toBe('favorites');
    expect(source.count).toBe(2);
    expect(source.videos).toHaveLength(2);

    // Check first video conversion
    expect(source.videos[0]).toMatchObject({
      id: 'grid-video-1',
      title: 'Grid Video 1',
      thumbnail: 'https://example.com/grid1.jpg',
      duration: 120,
      type: 'youtube',
      isFavorite: true,
      showFavoriteIcon: true
    });
  });
});