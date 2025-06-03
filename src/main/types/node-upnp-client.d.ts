declare module 'node-upnp-client' {
  interface Device {
    host: string;
    services: {
      [key: string]: {
        browse: (options: {
          ObjectID: string;
          BrowseFlag: string;
          Filter: string;
          StartingIndex: number;
          RequestedCount: number;
          SortCriteria: string;
        }) => Promise<{
          Result: Array<{
            res: string;
            [key: string]: any;
          }>;
        }>;
      };
    };
  }

  export class Client {
    constructor();
    search(target: string): Promise<Device[]>;
  }
} 