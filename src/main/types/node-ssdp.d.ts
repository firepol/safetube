declare module 'node-ssdp' {
  interface SSDPHeaders {
    ST: string;
    LOCATION: string;
    [key: string]: string;
  }

  export class Client {
    constructor();
    search(target: string): void;
    on(event: 'response', callback: (headers: SSDPHeaders) => void): this;
  }
} 