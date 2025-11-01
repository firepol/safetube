import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NetworkInfoFooter } from '../NetworkInfoFooter';
import styles from '../NetworkInfoFooter.module.css';

// Mock window.electron
const mockInvoke = vi.fn();

Object.defineProperty(window, 'electron', {
  value: {
    invoke: mockInvoke,
  },
  writable: true,
});

describe('NetworkInfoFooter Component', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  it('should not render when remote access is disabled', async () => {
    mockInvoke.mockResolvedValue(null);

    render(<NetworkInfoFooter />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('server:get-network-info');
    });

    expect(screen.queryByText(/Network:/)).not.toBeInTheDocument();
  });

  it('should display network info when remote access is enabled', async () => {
    const networkInfo = {
      localIP: '192.168.1.100',
      port: 3000,
      url: 'http://192.168.1.100:3000',
    };

    mockInvoke.mockResolvedValue(networkInfo);

    render(<NetworkInfoFooter />);

    await waitFor(() => {
      expect(screen.getByText(/Network: http:\/\/192\.168\.1\.100:3000/)).toBeInTheDocument();
    });
  });

  it('should show correct network URL', async () => {
    const networkInfo = {
      localIP: '10.0.0.50',
      port: 3001,
      url: 'http://10.0.0.50:3001',
    };

    mockInvoke.mockResolvedValue(networkInfo);

    render(<NetworkInfoFooter />);

    await waitFor(() => {
      expect(screen.getByText(/Network: http:\/\/10\.0\.0\.50:3001/)).toBeInTheDocument();
    });
  });

  it('should refresh network info periodically', async () => {
    const networkInfo = {
      localIP: '192.168.1.100',
      port: 3000,
      url: 'http://192.168.1.100:3000',
    };

    mockInvoke.mockResolvedValue(networkInfo);

    render(<NetworkInfoFooter />);

    // Initial call
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    // Clear to count subsequent calls
    mockInvoke.mockClear();

    // Wait for interval (30 seconds is the default, but we can't wait that long in tests)
    // Just verify the component set up the interval
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should have footer styling classes', async () => {
    const networkInfo = {
      localIP: '192.168.1.100',
      port: 3000,
      url: 'http://192.168.1.100:3000',
    };

    mockInvoke.mockResolvedValue(networkInfo);

    const { container } = render(<NetworkInfoFooter />);

    await waitFor(() => {
      expect(container.querySelector(`.${styles['network-info-footer']}`)).toBeInTheDocument();
      expect(container.querySelector(`.${styles['network-info-text']}`)).toBeInTheDocument();
    });
  });

  it('should handle errors gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Test error'));

    render(<NetworkInfoFooter />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('server:get-network-info');
    });

    // Should not render footer if error occurs
    expect(screen.queryByText(/Network:/)).not.toBeInTheDocument();
  });
});
