import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  test('should render title and back button', () => {
    const mockOnBackClick = vi.fn();

    render(
      <PageHeader
        title="Test Page"
        onBackClick={mockOnBackClick}
      />
    );

    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  test('should render subtitle when provided', () => {
    const mockOnBackClick = vi.fn();

    render(
      <PageHeader
        title="Test Page"
        subtitle="Test subtitle"
        onBackClick={mockOnBackClick}
      />
    );

    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('Test subtitle')).toBeInTheDocument();
  });

  test('should render custom back button text', () => {
    const mockOnBackClick = vi.fn();

    render(
      <PageHeader
        title="Test Page"
        onBackClick={mockOnBackClick}
        backButtonText="← Back to Home"
      />
    );

    expect(screen.getByText('← Back to Home')).toBeInTheDocument();
  });

  test('should render right content when provided', () => {
    const mockOnBackClick = vi.fn();
    const rightContent = <div data-testid="right-content">Right Content</div>;

    render(
      <PageHeader
        title="Test Page"
        onBackClick={mockOnBackClick}
        rightContent={rightContent}
      />
    );

    expect(screen.getByTestId('right-content')).toBeInTheDocument();
    expect(screen.getByText('Right Content')).toBeInTheDocument();
  });

  test('should call onBackClick when back button is clicked', () => {
    const mockOnBackClick = vi.fn();

    render(
      <PageHeader
        title="Test Page"
        onBackClick={mockOnBackClick}
      />
    );

    const backButton = screen.getByText('← Back');
    fireEvent.click(backButton);

    expect(mockOnBackClick).toHaveBeenCalledOnce();
  });

  test('should not render subtitle when not provided', () => {
    const mockOnBackClick = vi.fn();

    render(
      <PageHeader
        title="Test Page"
        onBackClick={mockOnBackClick}
      />
    );

    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.queryByText(/subtitle/i)).not.toBeInTheDocument();
  });

  test('should not render right content when not provided', () => {
    const mockOnBackClick = vi.fn();

    render(
      <PageHeader
        title="Test Page"
        onBackClick={mockOnBackClick}
      />
    );

    // Check that the right content container is not present
    const rightContentContainers = screen.queryAllByText('Right Content');
    expect(rightContentContainers).toHaveLength(0);
  });

  test('should have proper styling classes', () => {
    const mockOnBackClick = vi.fn();

    render(
      <PageHeader
        title="Test Page"
        onBackClick={mockOnBackClick}
      />
    );

    const backButton = screen.getByText('← Back');
    expect(backButton).toHaveClass('px-3', 'py-1', 'bg-gray-200', 'hover:bg-gray-300', 'rounded', 'text-sm', 'transition-colors');

    const title = screen.getByText('Test Page');
    expect(title).toHaveClass('text-2xl', 'font-bold', 'text-gray-900');
  });
});