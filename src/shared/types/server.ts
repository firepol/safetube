/**
 * HTTP Server configuration
 */
export interface ServerConfig {
  port: number;
  host: '127.0.0.1' | '0.0.0.0';
  distPath: string;
}

/**
 * HTTP Server runtime information
 */
export interface ServerInfo {
  started: boolean;
  port: number;
  host: string;
  url: string;
}

/**
 * Network information for remote access display
 */
export interface NetworkInfo {
  localIP: string;
  port: number;
  url: string;
}
