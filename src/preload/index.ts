import { contextBridge } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    // Add any electron APIs you want to expose to the renderer process here
  }
) 