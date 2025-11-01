import os from 'os';

/**
 * Network interface information
 */
export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
}

/**
 * Aggregated network information
 */
export interface NetworkInfo {
  localIP: string;
  interfaces: NetworkInterfaceInfo[];
}

/**
 * Network utilities for detecting local IP addresses and network configuration
 */
export class NetworkUtils {
  /**
   * Get primary local network IP address
   * Excludes localhost (127.0.0.1) and IPv6
   * Prefers 192.168.x.x or 10.x.x.x addresses
   *
   * @returns Local network IP address (e.g., 192.168.1.100) or 127.0.0.1 as fallback
   */
  static getLocalIPAddress(): string {
    const nets = os.networkInterfaces();

    // First pass: look for preferred private addresses (192.168.x.x, 10.x.x.x)
    for (const name of Object.keys(nets)) {
      const interfaces = nets[name];
      if (!interfaces) continue;

      for (const net of interfaces) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (net.family === 'IPv4' && !net.internal) {
          // Prefer private network addresses
          if (
            net.address.startsWith('192.168.') ||
            net.address.startsWith('10.') ||
            net.address.startsWith('172.')
          ) {
            return net.address;
          }
        }
      }
    }

    // Second pass: look for any non-internal IPv4 address
    for (const name of Object.keys(nets)) {
      const interfaces = nets[name];
      if (!interfaces) continue;

      for (const net of interfaces) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }

    // Fallback to localhost
    return '127.0.0.1';
  }

  /**
   * Get all network interface information
   *
   * @returns Object containing local IP and list of all interfaces
   */
  static getAllNetworkInterfaces(): NetworkInfo {
    const nets = os.networkInterfaces();
    const interfaces: NetworkInterfaceInfo[] = [];

    for (const name of Object.keys(nets)) {
      const interfaceArray = nets[name];
      if (!interfaceArray) continue;

      for (const net of interfaceArray) {
        interfaces.push({
          name,
          address: net.address,
          family: net.family as 'IPv4' | 'IPv6',
          internal: net.internal,
        });
      }
    }

    return {
      localIP: this.getLocalIPAddress(),
      interfaces,
    };
  }
}
