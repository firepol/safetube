import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QuickExtensionMenu } from '../QuickExtensionMenu';
import { TimeTrackingService } from '@/renderer/services/timeTrackingService';
import { SourceTimeState } from '@/shared/types';

// Mock the TimeTrackingService
vi.mock('@/renderer/services/timeTrackingService', () => ({
  TimeTrackingService: {
    getExtensionOptions: vi.fn(() => [5, 10, 15, 30]),
    grantSourceExtension: vi.fn()
  }
}));

// Mock alert
global.alert = vi.fn();

describe('QuickExtensionMenu Component', () => {
  const mockSourceId = 'test-source-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render "+ Time" button', () => {
    render(<QuickExtensionMenu sourceId={mockSourceId} />);

    expect(screen.getByRole('button', { name: /\+ Time/i })).toBeInTheDocument();
  });

  test('should display dropdown menu when button is clicked', async () => {
    render(<QuickExtensionMenu sourceId={mockSourceId} />);

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('5 minutes')).toBeInTheDocument();
      expect(screen.getByText('10 minutes')).toBeInTheDocument();
      expect(screen.getByText('15 minutes')).toBeInTheDocument();
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
    });
  });

  test('should render extension options from TimeTrackingService', async () => {
    render(<QuickExtensionMenu sourceId={mockSourceId} />);

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(TimeTrackingService.getExtensionOptions).toHaveBeenCalled();
      const options = [5, 10, 15, 30];
      options.forEach(opt => {
        expect(screen.getByText(`${opt} minutes`)).toBeInTheDocument();
      });
    });
  });

  test('should call grantSourceExtension when option is selected', async () => {
    (TimeTrackingService.grantSourceExtension as any).mockResolvedValue(undefined);

    render(<QuickExtensionMenu sourceId={mockSourceId} />);

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    await waitFor(() => {
      const fiveMinButton = screen.getByRole('button', { name: '5 minutes' });
      fireEvent.click(fiveMinButton);
    });

    expect(TimeTrackingService.grantSourceExtension).toHaveBeenCalledWith(
      mockSourceId,
      5,
      'Quick extension from admin panel'
    );
  });

  test('should show success message after granting extension', async () => {
    (TimeTrackingService.grantSourceExtension as any).mockResolvedValue(undefined);

    render(<QuickExtensionMenu sourceId={mockSourceId} />);

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    await waitFor(() => {
      const fiveMinButton = screen.getByRole('button', { name: '5 minutes' });
      fireEvent.click(fiveMinButton);
    });

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Granted 5 minutes');
    });
  });

  test('should show error message on extension failure', async () => {
    const error = new Error('Extension failed');
    (TimeTrackingService.grantSourceExtension as any).mockRejectedValue(error);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<QuickExtensionMenu sourceId={mockSourceId} />);

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    await waitFor(() => {
      const fiveMinButton = screen.getByRole('button', { name: '5 minutes' });
      fireEvent.click(fiveMinButton);
    });

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Failed to grant extension');
    });

    consoleSpy.mockRestore();
  });

  test('should show loading state during extension grant', async () => {
    let resolveGrant: () => void;
    const grantPromise = new Promise<void>(resolve => {
      resolveGrant = resolve;
    });

    (TimeTrackingService.grantSourceExtension as any).mockReturnValue(grantPromise);

    render(<QuickExtensionMenu sourceId={mockSourceId} />);

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    await waitFor(() => {
      const fiveMinButton = screen.getByRole('button', { name: '5 minutes' });
      fireEvent.click(fiveMinButton);
    });

    // Button should be disabled during loading
    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    // Resolve the grant
    resolveGrant!();

    // Button should be enabled again
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  test('should call onExtensionGranted callback after successful extension', async () => {
    (TimeTrackingService.grantSourceExtension as any).mockResolvedValue(undefined);
    const onExtensionGranted = vi.fn();

    render(
      <QuickExtensionMenu
        sourceId={mockSourceId}
        onExtensionGranted={onExtensionGranted}
      />
    );

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    await waitFor(() => {
      const fiveMinButton = screen.getByRole('button', { name: '5 minutes' });
      fireEvent.click(fiveMinButton);
    });

    await waitFor(() => {
      expect(onExtensionGranted).toHaveBeenCalled();
    });
  });

  test('should close menu after selecting an option', async () => {
    (TimeTrackingService.grantSourceExtension as any).mockResolvedValue(undefined);

    render(<QuickExtensionMenu sourceId={mockSourceId} />);

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('5 minutes')).toBeInTheDocument();
    });

    const fiveMinButton = screen.getByRole('button', { name: '5 minutes' });
    fireEvent.click(fiveMinButton);

    await waitFor(() => {
      expect(screen.queryByText('5 minutes')).not.toBeInTheDocument();
    });
  });

  test('should close menu when clicking outside', async () => {
    const { container } = render(<QuickExtensionMenu sourceId={mockSourceId} />);

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('5 minutes')).toBeInTheDocument();
    });

    // Find and click the backdrop div
    const backdrop = container.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    await waitFor(() => {
      expect(screen.queryByText('5 minutes')).not.toBeInTheDocument();
    });
  });

  test('should support multiple extension options', async () => {
    (TimeTrackingService.grantSourceExtension as any).mockResolvedValue(undefined);

    render(<QuickExtensionMenu sourceId={mockSourceId} />);

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    // Test each option
    const testCases = [5, 10, 15, 30];

    for (const minutes of testCases) {
      await waitFor(() => {
        const optionButton = screen.getByRole('button', { name: `${minutes} minutes` });
        expect(optionButton).toBeInTheDocument();
      });
    }
  });

  test('should disable options during loading', async () => {
    let resolveGrant: () => void;
    const grantPromise = new Promise<void>(resolve => {
      resolveGrant = resolve;
    });

    (TimeTrackingService.grantSourceExtension as any).mockReturnValue(grantPromise);

    render(<QuickExtensionMenu sourceId={mockSourceId} />);

    const button = screen.getByRole('button', { name: /\+ Time/i });
    fireEvent.click(button);

    await waitFor(() => {
      const fiveMinButton = screen.getByRole('button', { name: '5 minutes' });
      fireEvent.click(fiveMinButton);
    });

    // Options should be disabled during loading
    await waitFor(() => {
      const tenMinButton = screen.getByRole('button', { name: '10 minutes' });
      expect(tenMinButton).toBeDisabled();
    });

    // Resolve the grant
    resolveGrant!();

    // Options should be enabled again
    await waitFor(() => {
      const tenMinButton = screen.getByRole('button', { name: '10 minutes' });
      expect(tenMinButton).not.toBeDisabled();
    });
  });
});
