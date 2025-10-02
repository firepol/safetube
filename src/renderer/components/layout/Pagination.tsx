import React, { useState, useRef, useEffect } from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number; // Already capped at 100 by backend
  onPageChange: (pageNumber: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = ''
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

  // Progressive pagination: Show pages in 100-page chunks, 10 pages at a time
  const PAGES_PER_CHUNK = 100; // Show up to 100 pages per "more" expansion
  const PAGES_PER_GROUP = 10; // Show 10 pages in dropdown groups

  // Determine the current chunk (0-based: 0-99, 100-199, 200-299, etc.)
  const currentChunk = Math.floor((currentPage - 1) / PAGES_PER_CHUNK);
  const chunkStart = currentChunk * PAGES_PER_CHUNK + 1;
  const chunkEnd = Math.min((currentChunk + 1) * PAGES_PER_CHUNK, totalPages);

  // Show first 10 pages of current chunk by default
  const defaultDisplayEnd = Math.min(chunkStart + PAGES_PER_GROUP - 1, chunkEnd);

  const hasMoreInChunk = chunkEnd > defaultDisplayEnd;
  const hasNextChunk = totalPages > chunkEnd;

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    // Show pages around current page (within current visible range)
    let displayMax = defaultDisplayEnd;

    // If current page is beyond default display, expand to show current page's group
    if (currentPage > defaultDisplayEnd) {
      const currentGroup = Math.floor((currentPage - chunkStart) / PAGES_PER_GROUP);
      displayMax = Math.min(chunkStart + (currentGroup + 1) * PAGES_PER_GROUP - 1, chunkEnd);
    }

    for (let i = Math.max(chunkStart + 1, currentPage - delta); i <= Math.min(displayMax - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > chunkStart + 1) {
      rangeWithDots.push(chunkStart, '...');
    } else {
      rangeWithDots.push(chunkStart);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < displayMax - 1) {
      rangeWithDots.push('...', displayMax);
    } else if (displayMax > chunkStart) {
      rangeWithDots.push(displayMax);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  // Generate page range groups for dropdown (within current chunk)
  const getPageRanges = () => {
    const ranges = [];
    const currentDisplayMax = currentPage > defaultDisplayEnd
      ? Math.min(chunkStart + Math.floor((currentPage - chunkStart) / PAGES_PER_GROUP + 1) * PAGES_PER_GROUP - 1, chunkEnd)
      : defaultDisplayEnd;

    // Show remaining groups in current chunk
    for (let start = currentDisplayMax + 1; start <= chunkEnd; start += PAGES_PER_GROUP) {
      const end = Math.min(start + PAGES_PER_GROUP - 1, chunkEnd);
      ranges.push({ start, end, label: `Pages ${start}-${end}` });
    }

    // Add next chunk option
    if (hasNextChunk) {
      const nextChunkStart = chunkEnd + 1;
      const nextChunkEnd = Math.min(nextChunkStart + PAGES_PER_CHUNK - 1, totalPages);
      ranges.push({ start: nextChunkStart, end: nextChunkEnd, label: `Pages ${nextChunkStart}-${nextChunkEnd} (+${PAGES_PER_CHUNK})` });
    }

    return ranges;
  };

  const handleRangeSelect = (start: number) => {
    onPageChange(start);
    setShowDropdown(false);
  };

  const pageRanges = (hasMoreInChunk || hasNextChunk) ? getPageRanges() : [];

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
        {(hasMoreInChunk || hasNextChunk) && pageRanges.length > 0 && (
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
        disabled={currentPage >= totalPages}
        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          currentPage >= totalPages
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        Next
      </button>
    </div>
  );
};
