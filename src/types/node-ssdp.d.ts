declare module 'node-ssdp' {
  interface SSDPHeaders {
    ST: string;
    LOCATION: string;
    [key: string]: string;
  }

  export class Client {
    constructor();
    search(serviceType: string): void;
    on(event: 'response', callback: (headers: any) => void): this;
  }
}

declare module 'node-ssdp'; 