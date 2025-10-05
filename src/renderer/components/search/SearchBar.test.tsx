import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Search: ({ className }: { className?: string }) => <div data-testid="search-icon" className={className} />,
  X: ({ className }: { className?: string }) => <div data-testid="clear-icon" className={className} />
}));

describe('SearchBar', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument(); // Loading spinner
  });

  it('handles input changes', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar onSearch={mockOnSearch} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test query');
    
    expect(input).toHaveValue('test query');
  });

  it('debounces search calls', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar onSearch={mockOnSearch} debounceMs={300} />);
    
    const input = screen.getByRole('textbox');
    
    // Type multiple characters quickly
    await user.type(input, 'test');
    
    // Should not have called onSearch yet
    expect(mockOnSearch).not.toHaveBeenCalled();
    
    // Advance timers by debounce time
    jest.advanceTimersByTime(300);
    
    // Now should have called onSearch
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('test');
    });
    expect(mockOnSearch).toHaveBeenCalledTimes(1);
  });

  it('shows clear button when text is present', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar onSearch={mockOnSearch} />);
    
    const input = screen.getByRole('textbox');
    
    // Initially no clear button
    expect(screen.queryByTestId('clear-icon')).not.toBeInTheDocument();
    
    // Type some text
    await user.type(input, 'test');
    
    // Clear button should appear
    expect(screen.getByTestId('clear-icon')).toBeInTheDocument();
  });

  it('clears input when clear button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar onSearch={mockOnSearch} />);
    
    const input = screen.getByRole('textbox');
    
    // Type some text
    await user.type(input, 'test');
    expect(input).toHaveValue('test');
    
    // Click clear button
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    await user.click(clearButton);
    
    // Input should be cleared
    expect(input).toHaveValue('');
    expect(screen.queryByTestId('clear-icon')).not.toBeInTheDocument();
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
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    
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
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar onSearch={mockOnSearch} />);
    
    const input = screen.getByRole('textbox');
    
    // Type spaces only
    await user.type(input, '   ');
    
    // Advance timers
    jest.advanceTimersByTime(300);
    
    // Should not call onSearch for empty/whitespace-only query
    expect(mockOnSearch).not.toHaveBeenCalled();
  });

  it('trims whitespace from search queries', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar onSearch={mockOnSearch} />);
    
    const input = screen.getByRole('textbox');
    
    // Type query with leading/trailing spaces
    await user.type(input, '  test query  ');
    
    // Advance timers
    jest.advanceTimersByTime(300);
    
    // Should call onSearch with trimmed query
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('test query');
    });
  });

  it('handles rapid typing correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar onSearch={mockOnSearch} debounceMs={300} />);
    
    const input = screen.getByRole('textbox');
    
    // Type rapidly
    await user.type(input, 'a');
    jest.advanceTimersByTime(100);
    await user.type(input, 'b');
    jest.advanceTimersByTime(100);
    await user.type(input, 'c');
    
    // Should not have called onSearch yet
    expect(mockOnSearch).not.toHaveBeenCalled();
    
    // Advance by full debounce time
    jest.advanceTimersByTime(300);
    
    // Should call onSearch only once with final value
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('abc');
    });
    expect(mockOnSearch).toHaveBeenCalledTimes(1);
  });
});