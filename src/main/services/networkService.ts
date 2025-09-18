import { Client } from 'node-ssdp';

import { logVerbose } from '../../shared/logging';
import log from '../logger';

// Initialize SSDP client
const ssdpClient = new Client();

// Handle DLNA file access
export async function getDlnaFile(server: string, port: number, path: string): Promise<string> {
  try {
    logVerbose('[NetworkService] Searching for DLNA server:', server);

    // Search for DLNA servers
    const devices = await new Promise<any[]>((resolve) => {
      const foundDevices: any[] = [];

      ssdpClient.on('response', (headers: any) => {
        if (headers.ST === 'urn:schemas-upnp-org:service:ContentDirectory:1') {
          foundDevices.push(headers);
        }
      });

      ssdpClient.search('urn:schemas-upnp-org:service:ContentDirectory:1');

      // Wait for 5 seconds to collect responses
      setTimeout(() => {
        resolve(foundDevices);
      }, 5000);
    });

    // Find our target server
    const targetDevice = devices.find(device => device.LOCATION.includes(server));
    if (!targetDevice) {
      throw new Error(`DLNA server ${server} not found`);
    }

    logVerbose('[NetworkService] Found DLNA server:', targetDevice.LOCATION);

    // For now, just return the direct URL since we know the server and path
    // In a real implementation, we would:
    // 1. Parse the device description XML from LOCATION
    // 2. Find the ContentDirectory service
    // 3. Browse the content directory to find the video
    // 4. Get the direct media URL
    const url = `http://${server}:${port}${path}`;
    logVerbose('[NetworkService] Using media URL:', url);

    return url;
  } catch (error) {
    log.error('[NetworkService] Error accessing DLNA file:', error);
    throw error;
  }
}

// Get SSDP client for other network operations
export function getSsdpClient(): Client {
  return ssdpClient;
}

// Search for DLNA devices
export async function searchDlnaDevices(timeout: number = 5000): Promise<any[]> {
  return new Promise((resolve) => {
    const foundDevices: any[] = [];

    ssdpClient.on('response', (headers: any) => {
      if (headers.ST === 'urn:schemas-upnp-org:service:ContentDirectory:1') {
        foundDevices.push(headers);
      }
    });

    ssdpClient.search('urn:schemas-upnp-org:service:ContentDirectory:1');

    setTimeout(() => {
      resolve(foundDevices);
    }, timeout);
  });
}