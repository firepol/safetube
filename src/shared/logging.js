"use strict";
/**
 * Logging utility for controlling verbosity across different environments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logVerboseRenderer = void 0;
exports.logVerbose = logVerbose;
exports.logError = logError;
exports.logWarning = logWarning;
function logVerbose(...args) {
    if (process.env.ELECTRON_LOG_VERBOSE === 'true') {
        // eslint-disable-next-line no-console
        console.log('[Main][Verbose]', ...args);
    }
}
const logVerboseRenderer = (...args) => {
    if (process.env.ELECTRON_LOG_VERBOSE === 'true') {
        // eslint-disable-next-line no-console
        console.log('[Renderer][Verbose]', ...args);
    }
};
exports.logVerboseRenderer = logVerboseRenderer;
/**
 * Logs an error message (always logged, regardless of verbosity setting)
 * @param args - Arguments to pass to console.error
 */
function logError(...args) {
    console.error(...args);
}
/**
 * Logs a warning message (always logged, regardless of verbosity setting)
 * @param args - Arguments to pass to console.warn
 */
function logWarning(...args) {
    console.warn(...args);
}
