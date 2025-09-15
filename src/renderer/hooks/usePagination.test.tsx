import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { usePagination } from './usePagination';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Wrapper component for Router context
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('usePagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should initialize with default values', () => {
    const { result } = renderHook(() => usePagination(), { wrapper: Wrapper });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.paginationState).toBe(null);
    expect(result.current.isFirstPage).toBe(true);
    expect(result.current.isLastPage).toBe(true);
  });

  test('should initialize with custom initial page', () => {
    const { result } = renderHook(() => usePagination({ initialPage: 3 }), { wrapper: Wrapper });

    expect(result.current.currentPage).toBe(3);
    expect(result.current.isFirstPage).toBe(false);
  });

  test('should handle state-only pagination', () => {
    const { result } = renderHook(() => usePagination({ useUrlNavigation: false }), { wrapper: Wrapper });

    act(() => {
      result.current.setPaginationState({
        currentPage: 1,
        totalPages: 5,
        totalVideos: 100,
        pageSize: 20
      });
    });

    expect(result.current.paginationState?.totalPages).toBe(5);
    expect(result.current.isLastPage).toBe(false);

    // Test page change without URL navigation
    act(() => {
      result.current.handlePageChange(3);
    });

    expect(result.current.currentPage).toBe(3);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('should handle URL-based navigation', () => {
    const { result } = renderHook(() =>
      usePagination({
        useUrlNavigation: true,
        navigationBasePath: '/source/test'
      }),
      { wrapper: Wrapper }
    );

    // Test navigation to page 1 (should use base path)
    act(() => {
      result.current.handlePageChange(1);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/source/test');

    // Test navigation to other pages
    act(() => {
      result.current.handlePageChange(3);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/source/test/page/3');
  });

  test('should handle goToPage correctly', () => {
    const { result } = renderHook(() => usePagination(), { wrapper: Wrapper });

    act(() => {
      result.current.setPaginationState({
        currentPage: 1,
        totalPages: 5,
        totalVideos: 100,
        pageSize: 20
      });
    });

    // Test valid page
    act(() => {
      result.current.goToPage(3);
    });

    expect(result.current.currentPage).toBe(3);

    // Test page beyond limits (should clamp to max)
    act(() => {
      result.current.goToPage(10);
    });

    expect(result.current.currentPage).toBe(5);

    // Test page below limits (should clamp to min)
    act(() => {
      result.current.goToPage(-1);
    });

    expect(result.current.currentPage).toBe(1);
  });

  test('should handle nextPage correctly', () => {
    const { result } = renderHook(() => usePagination(), { wrapper: Wrapper });

    act(() => {
      result.current.setPaginationState({
        currentPage: 2,
        totalPages: 5,
        totalVideos: 100,
        pageSize: 20
      });
    });

    // Should advance to next page
    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(3);

    // Test at last page (should not advance beyond)
    act(() => {
      result.current.goToPage(5);
    });

    expect(result.current.currentPage).toBe(5);
    expect(result.current.isLastPage).toBe(true);

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(5); // Should stay at 5
  });

  test('should handle previousPage correctly', () => {
    const { result } = renderHook(() => usePagination({ initialPage: 3 }), { wrapper: Wrapper });

    act(() => {
      result.current.setPaginationState({
        currentPage: 3,
        totalPages: 5,
        totalVideos: 100,
        pageSize: 20
      });
    });

    // Should go to previous page
    act(() => {
      result.current.previousPage();
    });

    expect(result.current.currentPage).toBe(2);

    // Test at first page (should not go below 1)
    act(() => {
      result.current.goToPage(1);
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.isFirstPage).toBe(true);

    act(() => {
      result.current.previousPage();
    });

    expect(result.current.currentPage).toBe(1); // Should stay at 1
  });

  test('should calculate isFirstPage and isLastPage correctly', () => {
    const { result } = renderHook(() => usePagination(), { wrapper: Wrapper });

    act(() => {
      result.current.setPaginationState({
        currentPage: 1,
        totalPages: 3,
        totalVideos: 60,
        pageSize: 20
      });
    });

    // At first page
    expect(result.current.isFirstPage).toBe(true);
    expect(result.current.isLastPage).toBe(false);

    // At middle page
    act(() => {
      result.current.goToPage(2);
    });

    expect(result.current.isFirstPage).toBe(false);
    expect(result.current.isLastPage).toBe(false);

    // At last page
    act(() => {
      result.current.goToPage(3);
    });

    expect(result.current.isFirstPage).toBe(false);
    expect(result.current.isLastPage).toBe(true);
  });

  test('should handle no pagination state gracefully', () => {
    const { result } = renderHook(() => usePagination(), { wrapper: Wrapper });

    // Should not error when calling methods without pagination state
    act(() => {
      result.current.goToPage(5);
    });

    act(() => {
      result.current.nextPage();
    });

    act(() => {
      result.current.previousPage();
    });

    expect(result.current.currentPage).toBe(1); // Should remain at initial value
  });
});