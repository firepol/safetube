import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { FavoriteButton } from './FavoriteButton';
import { FavoritesService } from '../../services/favoritesService';

// Mock the FavoritesService
vi.mock('../../services/favoritesService');

// Mock tooltip provider
vi.mock('@radix-ui/react-tooltip', () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Trigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Arrow: () => <div />
}));

const mockFavoritesService = FavoritesService as any;

describe('FavoriteButton', () => {

  const mockProps = {
    videoId: 'test-video',
    sourceId: 'test-source',
    type: 'youtube' as const,
    title: 'Test Video',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: 120
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render unfilled star when not favorite', () => {
    render(<FavoriteButton {...mockProps} isFavorite={false} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('☆');
    expect(button).toHaveAttribute('aria-label', 'Add to favorites');
  });

  it('should render filled star when favorite', () => {
    render(<FavoriteButton {...mockProps} isFavorite={true} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('⭐');
    expect(button).toHaveAttribute('aria-label', 'Remove from favorites');
  });

  it('should load initial favorite status when not provided', async () => {
    mockFavoritesService.isFavorite.mockResolvedValue(true);

    render(<FavoriteButton {...mockProps} />);

    await waitFor(() => {
      expect(mockFavoritesService.isFavorite).toHaveBeenCalledWith('test-video', 'youtube');
    });

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('⭐');
    });
  });

  it('should toggle favorite status when clicked', async () => {
    const mockToggle = vi.fn();
    mockFavoritesService.toggleFavorite.mockResolvedValue({
      favorite: { videoId: 'test-video', isFavorite: true },
      isFavorite: true
    });

    render(
      <FavoriteButton
        {...mockProps}
        isFavorite={false}
        onToggle={mockToggle}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockFavoritesService.toggleFavorite).toHaveBeenCalledWith(
      'test-video',
      'test-source',
      'youtube',
      'Test Video',
      'https://example.com/thumb.jpg',
      120,
      undefined
    );

    await waitFor(() => {
      expect(mockToggle).toHaveBeenCalledWith('test-video', true);
    });
  });

  it('should show loading state during toggle', async () => {
    let resolveToggle: (value: any) => void;
    const togglePromise = new Promise((resolve) => {
      resolveToggle = resolve;
    });

    mockFavoritesService.toggleFavorite.mockReturnValue(togglePromise);

    render(<FavoriteButton {...mockProps} isFavorite={false} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Button should be disabled during loading
    expect(button).toBeDisabled();

    // Resolve the promise
    resolveToggle!({ favorite: null, isFavorite: true });

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it('should handle errors gracefully', async () => {
    mockFavoritesService.toggleFavorite.mockRejectedValue(new Error('Network error'));

    render(<FavoriteButton {...mockProps} isFavorite={false} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Just verify the error message appears in the DOM (component doesn't crash)
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should render with different sizes', () => {
    const { rerender } = render(
      <FavoriteButton {...mockProps} size="small" isFavorite={false} />
    );

    let button = screen.getByRole('button');
    expect(button).toHaveClass('w-5', 'h-5');

    rerender(<FavoriteButton {...mockProps} size="medium" isFavorite={false} />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('w-6', 'h-6');

    rerender(<FavoriteButton {...mockProps} size="large" isFavorite={false} />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('w-8', 'h-8');
  });

  it('should show label when requested', () => {
    render(
      <FavoriteButton
        {...mockProps}
        isFavorite={false}
        showLabel={true}
      />
    );

    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<FavoriteButton {...mockProps} disabled={true} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('cursor-not-allowed', 'opacity-40');
  });

  it('should apply custom className', () => {
    render(
      <FavoriteButton
        {...mockProps}
        className="custom-class"
        isFavorite={false}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should not load initial status when disabled', () => {
    render(<FavoriteButton {...mockProps} disabled={true} />);

    expect(mockFavoritesService.isFavorite).not.toHaveBeenCalled();
  });
});