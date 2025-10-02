import React, { useState, useRef, useEffect } from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (pageNumber: number) => void;
  className?: string;
  maxPages?: number; // Maximum pages available for expansion
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  maxPages
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  if (totalPages <= 1) {
    return null;
  }

  const effectiveMaxPages = maxPages || totalPages;
  const hasMorePages = effectiveMaxPages > totalPages;

  const getVisiblePages = () => {
    const delta = 2; // Show 2 pages before and after current page
    const range = [];
    const rangeWithDots = [];

    // Determine the display range based on current page
    let displayMax = totalPages;

    // If current page is beyond default totalPages, expand the display range
    if (currentPage > totalPages && currentPage <= effectiveMaxPages) {
      // Show the current range (in groups of 10)
      const currentGroup = Math.floor((currentPage - 1) / 10);
      displayMax = Math.min((currentGroup + 1) * 10, effectiveMaxPages);
    }

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(displayMax - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < displayMax - 1) {
      rangeWithDots.push('...', displayMax);
    } else if (displayMax > 1) {
      rangeWithDots.push(displayMax);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  // Generate page range groups for dropdown
  const getPageRanges = () => {
    const ranges = [];
    const currentDisplayMax = currentPage > totalPages
      ? Math.min(Math.floor((currentPage - 1) / 10 + 1) * 10, effectiveMaxPages)
      : totalPages;

    for (let start = currentDisplayMax + 1; start <= effectiveMaxPages; start += 10) {
      const end = Math.min(start + 9, effectiveMaxPages);
      ranges.push({ start, end });
    }
    return ranges;
  };

  const handleRangeSelect = (start: number) => {
    onPageChange(start);
    setShowDropdown(false);
  };

  const pageRanges = hasMorePages ? getPageRanges() : [];

  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      {/* Previous button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          currentPage === 1
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        Previous
      </button>

      {/* Page numbers */}
      <div className="flex items-center space-x-1">
        {visiblePages.map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="px-2 py-2 text-gray-500">...</span>
            ) : (
              <button
                onClick={() => onPageChange(page as number)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}

        {/* More Pages Dropdown */}
        {hasMorePages && pageRanges.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700 flex items-center space-x-1"
              title="Show more pages"
            >
              <span>+More</span>
              <svg
                className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute top-full mt-1 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[150px]">
                <div className="py-1">
                  {pageRanges.map(({ start, end }) => (
                    <button
                      key={start}
                      onClick={() => handleRangeSelect(start)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      Pages {start}-{end}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Next button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= effectiveMaxPages}
        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          currentPage >= effectiveMaxPages
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        Next
      </button>
    </div>
  );
};
