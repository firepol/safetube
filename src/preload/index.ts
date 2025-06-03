import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    // Add any electron APIs you want to expose to the renderer process here
    send: (channel: string, data: any) => {
      ipcRenderer.send(channel, data)
    },
    receive: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func)
    },
    getLocalFile: (filePath: string) => {
      return ipcRenderer.invoke('get-local-file', filePath)
    },
    getDlnaFile: (server: string, port: number, path: string) => {
      return ipcRenderer.invoke('get-dlna-file', server, port, path)
    }
  }
) 