import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DenyReasonDialog } from './DenyReasonDialog';

describe('DenyReasonDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        videoTitle="Test Video"
      />
    );

    expect(screen.getByText('Deny Video Request')).toBeInTheDocument();
    expect(screen.getByText('Video:')).toBeInTheDocument();
    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Explain why this video is not appropriate...')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <DenyReasonDialog
        isOpen={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.queryByText('Deny Video Request')).not.toBeInTheDocument();
  });

  it('handles text input and character counting', async () => {
    render(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const textarea = screen.getByPlaceholderText('Explain why this video is not appropriate...');
    const testText = 'This video is not appropriate for children';

    fireEvent.change(textarea, { target: { value: testText } });

    expect(textarea).toHaveValue(testText);
    expect(screen.getByText(`${500 - testText.length} characters remaining`)).toBeInTheDocument();
  });

  it('shows warning when approaching character limit', async () => {
    render(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const textarea = screen.getByPlaceholderText('Explain why this video is not appropriate...');
    const longText = 'a'.repeat(460); // 40 characters remaining

    fireEvent.change(textarea, { target: { value: longText } });

    const remainingText = screen.getByText('40 characters remaining');
    expect(remainingText).toHaveClass('text-orange-600');
  });

  it('shows error when exceeding character limit', async () => {
    render(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const textarea = screen.getByPlaceholderText('Explain why this video is not appropriate...');
    const tooLongText = 'a'.repeat(510); // Exceeds 500 character limit

    fireEvent.change(textarea, { target: { value: tooLongText } });

    expect(screen.getByText('Reason cannot exceed 500 characters')).toBeInTheDocument();
    expect(screen.getByText('Deny Video')).toBeDisabled();
  });

  it('calls onConfirm with trimmed reason when confirm button clicked', async () => {
    render(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const textarea = screen.getByPlaceholderText('Explain why this video is not appropriate...');
    const reason = '  This video contains inappropriate content  ';

    fireEvent.change(textarea, { target: { value: reason } });
    fireEvent.click(screen.getByText('Deny Video'));

    expect(mockOnConfirm).toHaveBeenCalledWith(reason.trim());
  });

  it('calls onConfirm with empty string when no reason provided', async () => {
    render(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    fireEvent.click(screen.getByText('Deny Video'));

    expect(mockOnConfirm).toHaveBeenCalledWith('');
  });

  it('calls onClose when cancel button clicked', async () => {
    render(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop clicked', async () => {
    render(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
    fireEvent.click(backdrop!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles keyboard shortcuts', async () => {
    render(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const textarea = screen.getByPlaceholderText('Explain why this video is not appropriate...');
    const reason = 'Test reason';

    fireEvent.change(textarea, { target: { value: reason } });

    // Test Ctrl+Enter to confirm
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(mockOnConfirm).toHaveBeenCalledWith(reason);

    // Reset mock
    mockOnConfirm.mockClear();

    // Test Escape to cancel
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state correctly', async () => {
    render(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={true}
      />
    );

    expect(screen.getByText('Deny Video')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByPlaceholderText('Explain why this video is not appropriate...')).toBeDisabled();
    
    // Check for loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('resets form when dialog opens', async () => {
    const { rerender } = render(
      <DenyReasonDialog
        isOpen={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    // Open dialog and add text
    rerender(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const textarea = screen.getByPlaceholderText('Explain why this video is not appropriate...');
    fireEvent.change(textarea, { target: { value: 'Some reason' } });

    // Close and reopen dialog
    rerender(
      <DenyReasonDialog
        isOpen={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    rerender(
      <DenyReasonDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    // Text should be reset
    expect(screen.getByPlaceholderText('Explain why this video is not appropriate...')).toHaveValue('');
  });
});