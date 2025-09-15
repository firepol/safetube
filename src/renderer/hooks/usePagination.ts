import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalVideos: number;
  pageSize: number;
}

interface UsePaginationOptions {
  initialPage?: number;
  navigationBasePath?: string; // For URL-based navigation like '/source/{id}/page/{page}'
  useUrlNavigation?: boolean; // Whether to use URL navigation or state-only pagination
}

interface UsePaginationResult {
  currentPage: number;
  paginationState: PaginationState | null;
  setPaginationState: (state: PaginationState | null) => void;
  handlePageChange: (pageNumber: number) => void;
  goToPage: (pageNumber: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  isFirstPage: boolean;
  isLastPage: boolean;
}

/**
 * Custom hook for managing pagination state and navigation.
 * Supports both URL-based navigation and state-only pagination.
 */
export const usePagination = (options: UsePaginationOptions = {}): UsePaginationResult => {
  const {
    initialPage = 1,
    navigationBasePath = '',
    useUrlNavigation = false
  } = options;

  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [paginationState, setPaginationState] = useState<PaginationState | null>(null);

  /**
   * Handle page changes with either URL navigation or state updates
   */
  const handlePageChange = useCallback((pageNumber: number) => {
    if (useUrlNavigation && navigationBasePath) {
      // URL-based navigation (like SourcePage)
      if (pageNumber === 1) {
        navigate(navigationBasePath);
      } else {
        navigate(`${navigationBasePath}/page/${pageNumber}`);
      }
    } else {
      // State-only navigation (like HistoryPage)
      setCurrentPage(pageNumber);
      // Also update pagination state if it exists
      if (paginationState) {
        setPaginationState({
          ...paginationState,
          currentPage: pageNumber
        });
      }
    }
  }, [useUrlNavigation, navigationBasePath, navigate, paginationState]);

  /**
   * Navigate to a specific page
   */
  const goToPage = useCallback((pageNumber: number) => {
    if (!paginationState) return;

    const validPage = Math.max(1, Math.min(pageNumber, paginationState.totalPages));
    handlePageChange(validPage);
  }, [paginationState, handlePageChange]);

  // Use pagination state's current page if available, otherwise use local state
  const effectiveCurrentPage = paginationState?.currentPage ?? currentPage;

  /**
   * Navigate to the next page
   */
  const nextPage = useCallback(() => {
    if (!paginationState) return;

    const nextPageNumber = Math.min(effectiveCurrentPage + 1, paginationState.totalPages);
    if (nextPageNumber !== effectiveCurrentPage) {
      handlePageChange(nextPageNumber);
    }
  }, [effectiveCurrentPage, paginationState, handlePageChange]);

  /**
   * Navigate to the previous page
   */
  const previousPage = useCallback(() => {
    const previousPageNumber = Math.max(effectiveCurrentPage - 1, 1);
    if (previousPageNumber !== effectiveCurrentPage) {
      handlePageChange(previousPageNumber);
    }
  }, [effectiveCurrentPage, handlePageChange]);

  // Calculate helper booleans
  const isFirstPage = effectiveCurrentPage === 1;
  const isLastPage = paginationState ? effectiveCurrentPage >= paginationState.totalPages : true;

  return {
    currentPage: effectiveCurrentPage,
    paginationState,
    setPaginationState,
    handlePageChange,
    goToPage,
    nextPage,
    previousPage,
    isFirstPage,
    isLastPage
  };
};