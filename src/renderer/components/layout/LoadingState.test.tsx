import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  test('should render with default props', () => {
    render(<LoadingState />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should render custom message', () => {
    render(<LoadingState message="Loading videos..." />);

    expect(screen.getByText('Loading videos...')).toBeInTheDocument();
  });

  test('should render submessage when provided', () => {
    render(
      <LoadingState
        message="Loading videos..."
        submessage="This may take a few moments"
      />
    );

    expect(screen.getByText('Loading videos...')).toBeInTheDocument();
    expect(screen.getByText('This may take a few moments')).toBeInTheDocument();
  });

  test('should not render back button by default', () => {
    render(<LoadingState />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('should render back button when showBackButton is true and onBackClick is provided', () => {
    const mockOnBackClick = vi.fn();

    render(
      <LoadingState
        showBackButton={true}
        onBackClick={mockOnBackClick}
        variant="page"
      />
    );

    expect(screen.getByRole('button', { name: '← Back' })).toBeInTheDocument();
  });

  test('should call onBackClick when back button is clicked', () => {
    const mockOnBackClick = vi.fn();

    render(
      <LoadingState
        showBackButton={true}
        onBackClick={mockOnBackClick}
        variant="page"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(mockOnBackClick).toHaveBeenCalledOnce();
  });

  test('should render custom back button text', () => {
    const mockOnBackClick = vi.fn();

    render(
      <LoadingState
        showBackButton={true}
        onBackClick={mockOnBackClick}
        backButtonText="Go Back"
        variant="page"
      />
    );

    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
  });

  test('should not render back button for fullscreen variant', () => {
    const mockOnBackClick = vi.fn();

    render(
      <LoadingState
        showBackButton={true}
        onBackClick={mockOnBackClick}
        variant="fullscreen"
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('should not render back button for inline variant', () => {
    const mockOnBackClick = vi.fn();

    render(
      <LoadingState
        showBackButton={true}
        onBackClick={mockOnBackClick}
        variant="inline"
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('should apply custom className', () => {
    const { container } = render(<LoadingState className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  test('should apply correct classes for fullscreen variant', () => {
    const { container } = render(<LoadingState variant="fullscreen" />);

    expect(container.firstChild).toHaveClass('min-h-screen', 'bg-background', 'flex', 'items-center', 'justify-center');
  });

  test('should apply correct classes for page variant', () => {
    const { container } = render(<LoadingState variant="page" />);

    expect(container.firstChild).toHaveClass('p-4');
  });

  test('should apply correct classes for inline variant', () => {
    const { container } = render(<LoadingState variant="inline" />);

    expect(container.firstChild).toHaveClass('flex', 'items-center', 'justify-center', 'py-8');
  });
});