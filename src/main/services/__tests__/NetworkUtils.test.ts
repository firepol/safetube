import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import { NetworkUtils } from '../NetworkUtils';

// Mock os.networkInterfaces()
vi.mock('os', () => ({
  default: {
    networkInterfaces: vi.fn(),
  },
}));

describe('NetworkUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLocalIPAddress', () => {
    it('should return preferred private IP address (192.168.x.x)', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({
        lo: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8',
          },
        ],
        eth0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24',
          },
        ],
      });

      expect(NetworkUtils.getLocalIPAddress()).toBe('192.168.1.100');
    });

    it('should return preferred private IP address (10.x.x.x)', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({
        lo: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8',
          },
        ],
        eth0: [
          {
            address: '10.0.0.50',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: '10.0.0.50/24',
          },
        ],
      });

      expect(NetworkUtils.getLocalIPAddress()).toBe('10.0.0.50');
    });

    it('should return preferred private IP address (172.x.x.x)', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({
        lo: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8',
          },
        ],
        eth0: [
          {
            address: '172.16.0.100',
            netmask: '255.255.0.0',
            family: 'IPv4',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: '172.16.0.100/16',
          },
        ],
      });

      expect(NetworkUtils.getLocalIPAddress()).toBe('172.16.0.100');
    });

    it('should exclude IPv6 addresses', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({
        lo: [
          {
            address: '::1',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '::1/128',
            scopeid: 0,
          },
        ],
        eth0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24',
          },
          {
            address: 'fe80::1',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: 'fe80::1/10',
            scopeid: 1,
          },
        ],
      });

      expect(NetworkUtils.getLocalIPAddress()).toBe('192.168.1.100');
    });

    it('should exclude loopback/internal addresses', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({
        lo: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8',
          },
        ],
        eth0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24',
          },
        ],
      });

      const ip = NetworkUtils.getLocalIPAddress();
      expect(ip).not.toBe('127.0.0.1');
      expect(ip).toBe('192.168.1.100');
    });

    it('should return 127.0.0.1 when no suitable network interface found', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({
        lo: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8',
          },
        ],
      });

      expect(NetworkUtils.getLocalIPAddress()).toBe('127.0.0.1');
    });

    it('should handle empty network interfaces', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({});

      expect(NetworkUtils.getLocalIPAddress()).toBe('127.0.0.1');
    });

    it('should prefer first private address when multiple available', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({
        eth0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24',
          },
        ],
        eth1: [
          {
            address: '10.0.0.50',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '08:00:27:00:00:01',
            internal: false,
            cidr: '10.0.0.50/24',
          },
        ],
      });

      // Should return the first preferred address found (order depends on Object.keys())
      const ip = NetworkUtils.getLocalIPAddress();
      expect(['192.168.1.100', '10.0.0.50']).toContain(ip);
    });
  });

  describe('getAllNetworkInterfaces', () => {
    it('should return all network interfaces with local IP', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({
        lo: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8',
          },
        ],
        eth0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24',
          },
        ],
      });

      const result = NetworkUtils.getAllNetworkInterfaces();

      expect(result.localIP).toBe('192.168.1.100');
      expect(result.interfaces).toHaveLength(2);
      expect(result.interfaces).toContainEqual({
        name: 'lo',
        address: '127.0.0.1',
        family: 'IPv4',
        internal: true,
      });
      expect(result.interfaces).toContainEqual({
        name: 'eth0',
        address: '192.168.1.100',
        family: 'IPv4',
        internal: false,
      });
    });

    it('should include IPv6 addresses in full list', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({
        eth0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24',
          },
          {
            address: 'fe80::1',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: 'fe80::1/10',
            scopeid: 1,
          },
        ],
      });

      const result = NetworkUtils.getAllNetworkInterfaces();

      expect(result.interfaces).toHaveLength(2);
      expect(result.interfaces.some((i) => i.family === 'IPv6')).toBe(true);
      expect(result.interfaces.some((i) => i.family === 'IPv4')).toBe(true);
    });

    it('should handle multiple addresses per interface', () => {
      vi.mocked(os.networkInterfaces).mockReturnValue({
        eth0: [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24',
          },
          {
            address: 'fe80::1',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: '08:00:27:00:00:00',
            internal: false,
            cidr: 'fe80::1/10',
            scopeid: 1,
          },
        ],
      });

      const result = NetworkUtils.getAllNetworkInterfaces();

      expect(result.interfaces).toHaveLength(2);
      expect(result.interfaces.filter((i) => i.name === 'eth0')).toHaveLength(2);
    });
  });
});
