import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { useWishlistDeny } from './useWishlistDeny';

// Mock the electron API
const mockWishlistDeny = vi.fn();

beforeAll(() => {
  (global as any).window = {
    electron: {
      wishlistDeny: mockWishlistDeny
    }
  };
});

describe('useWishlistDeny', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useWishlistDeny());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.denyVideo).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });

  it('should successfully deny video without reason', async () => {
    mockWishlistDeny.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useWishlistDeny());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.denyVideo('video123');
    });

    expect(mockWishlistDeny).toHaveBeenCalledWith('video123', undefined);
    expect(success).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should successfully deny video with reason', async () => {
    mockWishlistDeny.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useWishlistDeny());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.denyVideo('video123', 'Inappropriate content');
    });

    expect(mockWishlistDeny).toHaveBeenCalledWith('video123', 'Inappropriate content');
    expect(success).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle IPC failure with error message', async () => {
    mockWishlistDeny.mockResolvedValue({ 
      success: false, 
      error: 'Video not found in wishlist' 
    });

    const { result } = renderHook(() => useWishlistDeny());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.denyVideo('video123', 'Test reason');
    });

    expect(success).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Video not found in wishlist');
  });

  it('should handle IPC failure without error message', async () => {
    mockWishlistDeny.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useWishlistDeny());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.denyVideo('video123');
    });

    expect(success).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Failed to deny video');
  });

  it('should handle IPC exception', async () => {
    mockWishlistDeny.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWishlistDeny());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.denyVideo('video123');
    });

    expect(success).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Network error');
  });

  it('should handle non-Error exceptions', async () => {
    mockWishlistDeny.mockRejectedValue('String error');

    const { result } = renderHook(() => useWishlistDeny());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.denyVideo('video123');
    });

    expect(success).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Failed to deny video');
  });

  it('should set loading state during operation', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockWishlistDeny.mockReturnValue(promise);

    const { result } = renderHook(() => useWishlistDeny());

    // Start the operation
    act(() => {
      result.current.denyVideo('video123');
    });

    // Should be loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);

    // Resolve the promise
    await act(async () => {
      resolvePromise!({ success: true });
    });

    // Should no longer be loading
    expect(result.current.isLoading).toBe(false);
  });

  it('should clear error when clearError is called', async () => {
    mockWishlistDeny.mockResolvedValue({ 
      success: false, 
      error: 'Test error' 
    });

    const { result } = renderHook(() => useWishlistDeny());

    // Create an error
    await act(async () => {
      await result.current.denyVideo('video123');
    });

    expect(result.current.error).toBe('Test error');

    // Clear the error
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });

  it('should clear error when starting new operation', async () => {
    mockWishlistDeny.mockResolvedValueOnce({ 
      success: false, 
      error: 'First error' 
    });

    const { result } = renderHook(() => useWishlistDeny());

    // Create an error
    await act(async () => {
      await result.current.denyVideo('video123');
    });

    expect(result.current.error).toBe('First error');

    // Start new operation - should clear previous error
    mockWishlistDeny.mockResolvedValueOnce({ success: true });

    await act(async () => {
      await result.current.denyVideo('video456');
    });

    expect(result.current.error).toBe(null);
  });
});