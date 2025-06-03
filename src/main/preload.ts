import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    getLocalFile: (filePath: string) => ipcRenderer.invoke('get-local-file', filePath),
    getDlnaFile: (server: string, port: number, path: string) => 
      ipcRenderer.invoke('get-dlna-file', server, port, path)
  }
); 