import log from 'electron-log';
import path from 'path';
import { app } from 'electron';

// Configure log file location
const userDataPath = app.getPath('userData');
log.transports.file.resolvePathFn = () => path.join(userDataPath, 'logs/main.log');

// Configure log levels
log.transports.file.level = process.env.NODE_ENV === 'test' ? 'error' : 'info';
log.transports.console.level = process.env.NODE_ENV === 'test' ? 'error' : 'debug';

// Configure log format
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.format = '[{level}] {text}';

// Export configured logger
export default log; 