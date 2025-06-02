import log from 'electron-log';

// Configure log levels for renderer
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Configure log format for renderer
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [Renderer] [{level}] {text}';
log.transports.console.format = '[Renderer] [{level}] {text}';

// Export configured logger
export default log; 