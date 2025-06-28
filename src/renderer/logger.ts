// Simple console-based logger for renderer process
const log = {
  verbose: (message: string, ...args: any[]) => {
    console.log(`[Renderer] [verbose] ${message}`, ...args);
  },
  info: (message: string, ...args: any[]) => {
    console.log(`[Renderer] [info] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[Renderer] [warn] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[Renderer] [error] ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    console.log(`[Renderer] [debug] ${message}`, ...args);
  }
};

export default log; 