export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
  type: 'local' | 'dlna';
}

declare global {
  interface Window {
    electron: {
      getLocalFile: (filePath: string) => Promise<string>;
      getDlnaFile: (server: string, port: number, path: string) => Promise<string>;
    };
  }
} 