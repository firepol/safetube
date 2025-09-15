import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  test('should render with required props', () => {
    render(<ErrorState message="Something went wrong" />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  test('should render custom title', () => {
    render(<ErrorState title="Custom Error" message="Something went wrong" />);

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
  });

  test('should not render back button by default', () => {
    render(<ErrorState message="Something went wrong" />);

    expect(screen.queryByText('← Back')).not.toBeInTheDocument();
  });

  test('should render back button when showBackButton is true and onBackClick is provided', () => {
    const mockOnBackClick = vi.fn();

    render(
      <ErrorState
        message="Something went wrong"
        showBackButton={true}
        onBackClick={mockOnBackClick}
        variant="page"
      />
    );

    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  test('should call onBackClick when back button is clicked', () => {
    const mockOnBackClick = vi.fn();

    render(
      <ErrorState
        message="Something went wrong"
        showBackButton={true}
        onBackClick={mockOnBackClick}
        variant="page"
      />
    );

    fireEvent.click(screen.getByText('← Back'));
    expect(mockOnBackClick).toHaveBeenCalledOnce();
  });

  test('should render custom back button text', () => {
    const mockOnBackClick = vi.fn();

    render(
      <ErrorState
        message="Something went wrong"
        showBackButton={true}
        onBackClick={mockOnBackClick}
        backButtonText="Go Back"
        variant="page"
      />
    );

    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  test('should not render retry button by default', () => {
    render(<ErrorState message="Something went wrong" />);

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  test('should render retry button when onRetry is provided', () => {
    const mockOnRetry = vi.fn();

    render(
      <ErrorState
        message="Something went wrong"
        onRetry={mockOnRetry}
      />
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  test('should call onRetry when retry button is clicked', () => {
    const mockOnRetry = vi.fn();

    render(
      <ErrorState
        message="Something went wrong"
        onRetry={mockOnRetry}
      />
    );

    fireEvent.click(screen.getByText('Try Again'));
    expect(mockOnRetry).toHaveBeenCalledOnce();
  });

  test('should render custom retry text', () => {
    const mockOnRetry = vi.fn();

    render(
      <ErrorState
        message="Something went wrong"
        onRetry={mockOnRetry}
        retryText="Reload"
      />
    );

    expect(screen.getByText('Reload')).toBeInTheDocument();
  });

  test('should not show debug info by default', () => {
    render(
      <ErrorState
        message="Something went wrong"
        debugInfo="Debug details here"
      />
    );

    expect(screen.queryByText('Show debug information')).not.toBeInTheDocument();
  });

  test('should show debug info when showDebug is true', () => {
    render(
      <ErrorState
        message="Something went wrong"
        showDebug={true}
        debugInfo="Debug details here"
      />
    );

    expect(screen.getByText('Show debug information')).toBeInTheDocument();
  });

  test('should handle string debug info', () => {
    render(
      <ErrorState
        message="Something went wrong"
        showDebug={true}
        debugInfo="Debug details here"
      />
    );

    const summary = screen.getByText('Show debug information');
    fireEvent.click(summary);
    expect(screen.getByText('Debug details here')).toBeInTheDocument();
  });

  test('should handle array debug info', () => {
    render(
      <ErrorState
        message="Something went wrong"
        showDebug={true}
        debugInfo={['Line 1', 'Line 2', 'Line 3']}
      />
    );

    const summary = screen.getByText('Show debug information');
    fireEvent.click(summary);

    // Check if the debug content contains the expected lines
    const preElement = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'pre' &&
             content.includes('Line 1') &&
             content.includes('Line 2') &&
             content.includes('Line 3');
    });
    expect(preElement).toBeInTheDocument();
  });

  test('should apply custom className', () => {
    const { container } = render(<ErrorState message="Error" className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  test('should apply correct classes for fullscreen variant', () => {
    const { container } = render(<ErrorState message="Error" variant="fullscreen" />);

    expect(container.firstChild).toHaveClass('min-h-screen', 'bg-background', 'flex', 'flex-col', 'items-center', 'justify-center');
  });

  test('should apply correct classes for page variant', () => {
    const { container } = render(<ErrorState message="Error" variant="page" />);

    expect(container.firstChild).toHaveClass('p-4');
  });

  test('should apply correct classes for inline variant', () => {
    const { container } = render(<ErrorState message="Error" variant="inline" />);

    expect(container.firstChild).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'py-8');
  });

  test('should render back button for fullscreen variant when enabled', () => {
    const mockOnBackClick = vi.fn();

    render(
      <ErrorState
        message="Something went wrong"
        showBackButton={true}
        onBackClick={mockOnBackClick}
        variant="fullscreen"
      />
    );

    expect(screen.getByText('← Back')).toBeInTheDocument();
  });
});