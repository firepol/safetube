import React, { useEffect, useState } from 'react';
import styles from './NetworkInfoFooter.module.css';

interface NetworkInfo {
  localIP: string;
  port: number;
  url: string;
}

/**
 * Displays network information in footer when remote access is enabled
 */
export function NetworkInfoFooter() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  useEffect(() => {
    async function fetchNetworkInfo() {
      try {
        const info = await (window.electron as any).invoke('server:get-network-info');
        setNetworkInfo(info);
      } catch (error) {
        console.error('[NetworkInfoFooter] Error fetching network info:', error);
      }
    }

    fetchNetworkInfo();

    // Refresh every 30 seconds in case IP changes (e.g., network reconnection)
    const interval = setInterval(fetchNetworkInfo, 30000);

    return () => clearInterval(interval);
  }, []);

  // Don't render if remote access is disabled (networkInfo will be null)
  if (!networkInfo) {
    return null;
  }

  return (
    <div className={styles['network-info-footer']}>
      <span className={styles['network-info-text']}>
        Network: {networkInfo.url}
      </span>
    </div>
  );
}
