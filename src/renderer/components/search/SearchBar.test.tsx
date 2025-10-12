import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';
import { vi, beforeEach, describe, it, expect } from 'vitest';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Search: ({ className }: { className?: string }) => <div data-testid="search-icon" className={className} />,
  X: ({ className }: { className?: string }) => <div data-testid="clear-icon" className={className} />
}));

describe('SearchBar', () => {
  const mockOnSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default props', () => {
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search videos...');
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<SearchBar onSearch={mockOnSearch} placeholder="Custom placeholder" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Custom placeholder');
  });

  it('shows loading state', () => {
    render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    expect(screen.getByTestId('search-icon')).toHaveClass('animate-pulse');
    // Check for loading spinner div
    const spinner = screen.getByRole('textbox').parentElement?.parentElement?.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('handles basic input changes', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} debounceMs={50} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test');

    expect(input).toHaveValue('test');
  });

  it('triggers search after debounce delay', async () => {
    render(<SearchBar onSearch={mockOnSearch} debounceMs={50} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });

    // Should not call immediately
    expect(mockOnSearch).not.toHaveBeenCalled();

    // Wait for debounce
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('test');
    }, { timeout: 200 });
  });

  it('shows clear button when text is present', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByRole('textbox');

    // Initially no clear button
    expect(screen.queryByTestId('clear-icon')).not.toBeInTheDocument();

    // Type some text
    await user.type(input, 't');

    // Clear button should appear
    await waitFor(() => {
      expect(screen.getByTestId('clear-icon')).toBeInTheDocument();
    });
  });

  it('clears input when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByRole('textbox');

    // Type some text
    await user.type(input, 't');
    expect(input).toHaveValue('t');

    // Click clear button
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    await user.click(clearButton);

    // Input should be cleared
    expect(input).toHaveValue('');
  });

  it('focuses input on Ctrl+K keyboard shortcut', () => {
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByRole('textbox');

    // Simulate Ctrl+K
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(input).toHaveFocus();
  });

  it('focuses input on Cmd+K keyboard shortcut (Mac)', () => {
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByRole('textbox');

    // Simulate Cmd+K
    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(input).toHaveFocus();
  });

  it('prevents default behavior for keyboard shortcuts', () => {
    render(<SearchBar onSearch={mockOnSearch} />);

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fireEvent(document, event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<SearchBar onSearch={mockOnSearch} className="custom-class" />);

    const container = screen.getByRole('textbox').closest('div')?.parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('auto-focuses when autoFocus prop is true', () => {
    render(<SearchBar onSearch={mockOnSearch} autoFocus={true} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveFocus();
  });

  it('does not trigger search for empty queries', async () => {
    render(<SearchBar onSearch={mockOnSearch} debounceMs={50} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });

    // Wait longer than debounce time
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should not call onSearch for whitespace-only query
    expect(mockOnSearch).not.toHaveBeenCalled();
  });

  it('trims whitespace from search queries', async () => {
    render(<SearchBar onSearch={mockOnSearch} debounceMs={50} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  test  ' } });

    // Wait for debounce
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('test');
    }, { timeout: 200 });
  });

  it('triggers immediate search on Enter key', async () => {
    render(<SearchBar onSearch={mockOnSearch} debounceMs={2000} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });

    // Press Enter before debounce completes
    fireEvent.keyDown(input, { key: 'Enter' });

    // Should call immediately, not wait for debounce
    expect(mockOnSearch).toHaveBeenCalledWith('test');
    expect(mockOnSearch).toHaveBeenCalledTimes(1);
  });
});
