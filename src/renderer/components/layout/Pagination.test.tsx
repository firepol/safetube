import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  const mockOnPageChange = vi.fn();

  beforeEach(() => {
    mockOnPageChange.mockClear();
  });

  it('should not render when totalPages is 1', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        onPageChange={mockOnPageChange}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render pagination with basic pages', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should disable Previous button on first page', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        onPageChange={mockOnPageChange}
      />
    );

    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();
  });

  it('should disable Next button on last page', () => {
    render(
      <Pagination
        currentPage={10}
        totalPages={10}
        onPageChange={mockOnPageChange}
      />
    );

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('should call onPageChange when clicking a page number', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    );

    const page3Button = screen.getByText('3');
    fireEvent.click(page3Button);

    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it('should call onPageChange when clicking Next button', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={10}
        onPageChange={mockOnPageChange}
      />
    );

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(mockOnPageChange).toHaveBeenCalledWith(4);
  });

  it('should call onPageChange when clicking Previous button', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={10}
        onPageChange={mockOnPageChange}
      />
    );

    const prevButton = screen.getByText('Previous');
    fireEvent.click(prevButton);

    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it('should show +More button when maxPages is greater than totalPages', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        maxPages={100}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByText('+More')).toBeInTheDocument();
  });

  it('should not show +More button when maxPages equals totalPages', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        maxPages={10}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.queryByText('+More')).not.toBeInTheDocument();
  });

  it('should not show +More button when maxPages is not provided', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.queryByText('+More')).not.toBeInTheDocument();
  });

  it('should show dropdown when clicking +More button', async () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        maxPages={100}
        onPageChange={mockOnPageChange}
      />
    );

    const moreButton = screen.getByText('+More');
    fireEvent.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText('Pages 11-20')).toBeInTheDocument();
      expect(screen.getByText('Pages 21-30')).toBeInTheDocument();
    });
  });

  it('should navigate to selected page range when clicking dropdown item', async () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        maxPages={100}
        onPageChange={mockOnPageChange}
      />
    );

    const moreButton = screen.getByText('+More');
    fireEvent.click(moreButton);

    await waitFor(() => {
      const range21_30 = screen.getByText('Pages 21-30');
      fireEvent.click(range21_30);
    });

    expect(mockOnPageChange).toHaveBeenCalledWith(21);
  });

  it('should close dropdown when clicking outside', async () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={10}
        maxPages={100}
        onPageChange={mockOnPageChange}
      />
    );

    const moreButton = screen.getByText('+More');
    fireEvent.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText('Pages 11-20')).toBeInTheDocument();
    });

    // Click outside the dropdown
    fireEvent.mouseDown(container);

    await waitFor(() => {
      expect(screen.queryByText('Pages 11-20')).not.toBeInTheDocument();
    });
  });

  it('should expand display when current page is beyond totalPages', () => {
    render(
      <Pagination
        currentPage={25}
        totalPages={10}
        maxPages={100}
        onPageChange={mockOnPageChange}
      />
    );

    // Should show page 30 (end of current range) when on page 25
    expect(screen.getByText('30')).toBeInTheDocument();
    // Should show +More for remaining pages
    expect(screen.getByText('+More')).toBeInTheDocument();
  });

  it('should show appropriate page ranges based on current page', () => {
    render(
      <Pagination
        currentPage={25}
        totalPages={10}
        maxPages={100}
        onPageChange={mockOnPageChange}
      />
    );

    const moreButton = screen.getByText('+More');
    fireEvent.click(moreButton);

    // When on page 25 (in range 21-30), should show ranges starting from 31
    expect(screen.getByText('Pages 31-40')).toBeInTheDocument();
    expect(screen.getByText('Pages 41-50')).toBeInTheDocument();
  });

  it('should disable Next button when at maxPages', () => {
    render(
      <Pagination
        currentPage={100}
        totalPages={10}
        maxPages={100}
        onPageChange={mockOnPageChange}
      />
    );

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('should show ellipsis for large page ranges', () => {
    render(
      <Pagination
        currentPage={50}
        totalPages={10}
        maxPages={100}
        onPageChange={mockOnPageChange}
      />
    );

    // Should show ellipsis before and after current page
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('should highlight current page', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={10}
        onPageChange={mockOnPageChange}
      />
    );

    const currentPageButton = screen.getByText('5');
    expect(currentPageButton).toHaveClass('bg-blue-600', 'text-white');
  });

  it('should show correct page range groups for maxPages=100', async () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        maxPages={100}
        onPageChange={mockOnPageChange}
      />
    );

    const moreButton = screen.getByText('+More');
    fireEvent.click(moreButton);

    await waitFor(() => {
      // Should show all ranges from 11 to 100
      expect(screen.getByText('Pages 11-20')).toBeInTheDocument();
      expect(screen.getByText('Pages 91-100')).toBeInTheDocument();
    });
  });

  it('should handle partial last range correctly', async () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        maxPages={45}
        onPageChange={mockOnPageChange}
      />
    );

    const moreButton = screen.getByText('+More');
    fireEvent.click(moreButton);

    await waitFor(() => {
      // Last range should be 41-45, not 41-50
      expect(screen.getByText('Pages 41-45')).toBeInTheDocument();
    });
  });
});
