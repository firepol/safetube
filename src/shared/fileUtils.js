"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTimeLimits = readTimeLimits;
exports.writeTimeLimits = writeTimeLimits;
exports.readUsageLog = readUsageLog;
exports.writeUsageLog = writeUsageLog;
exports.readWatchedVideos = readWatchedVideos;
exports.writeWatchedVideos = writeWatchedVideos;
exports.readVideoSources = readVideoSources;
exports.writeVideoSources = writeVideoSources;
exports.readPaginationConfig = readPaginationConfig;
exports.writePaginationConfig = writePaginationConfig;
exports.backupConfig = backupConfig;
exports.encodeFilePath = encodeFilePath;
exports.decodeFilePath = decodeFilePath;
exports.isEncodedFilePath = isEncodedFilePath;
exports.readTimeExtra = readTimeExtra;
exports.writeTimeExtra = writeTimeExtra;
exports.mergeWatchedData = mergeWatchedData;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const CONFIG_DIR = path.join(process.cwd(), 'config');
/**
 * Ensures the config directory exists
 */
async function ensureConfigDir() {
    try {
        await fs_1.promises.access(CONFIG_DIR);
    }
    catch {
        await fs_1.promises.mkdir(CONFIG_DIR, { recursive: true });
    }
}
/**
 * Reads a JSON file from the config directory
 */
async function readJsonFile(filename) {
    await ensureConfigDir();
    const filePath = path.join(CONFIG_DIR, filename);
    try {
        const content = await fs_1.promises.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return default value
            return {};
        }
        throw new Error(`Failed to read ${filename}: ${error}`);
    }
}
/**
 * Writes a JSON file to the config directory
 */
async function writeJsonFile(filename, data) {
    await ensureConfigDir();
    const filePath = path.join(CONFIG_DIR, filename);
    try {
        const content = JSON.stringify(data, null, 2);
        await fs_1.promises.writeFile(filePath, content, 'utf-8');
    }
    catch (error) {
        throw new Error(`Failed to write ${filename}: ${error}`);
    }
}
/**
 * Reads time limits configuration
 */
async function readTimeLimits() {
    return readJsonFile('timeLimits.json');
}
/**
 * Writes time limits configuration
 */
async function writeTimeLimits(timeLimits) {
    await writeJsonFile('timeLimits.json', timeLimits);
}
/**
 * Reads usage log
 */
async function readUsageLog() {
    return readJsonFile('usageLog.json');
}
/**
 * Writes usage log
 */
async function writeUsageLog(usageLog) {
    await writeJsonFile('usageLog.json', usageLog);
}
/**
 * Reads watched videos history
 */
async function readWatchedVideos() {
    return readJsonFile('watched.json');
}
/**
 * Writes watched videos history
 */
async function writeWatchedVideos(watchedVideos) {
    await writeJsonFile('watched.json', watchedVideos);
}
/**
 * Reads video sources configuration
 */
async function readVideoSources() {
    return readJsonFile('videoSources.json');
}
/**
 * Writes video sources configuration
 */
async function writeVideoSources(videoSources) {
    await writeJsonFile('videoSources.json', videoSources);
}
/**
 * Reads pagination configuration
 */
async function readPaginationConfig() {
    return readJsonFile('pagination.json');
}
/**
 * Writes pagination configuration
 */
async function writePaginationConfig(config) {
    await writeJsonFile('pagination.json', config);
}
/**
 * Creates a backup of all configuration files
 */
async function backupConfig() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(CONFIG_DIR, 'backup', timestamp);
    await fs_1.promises.mkdir(backupDir, { recursive: true });
    const files = ['timeLimits.json', 'usageLog.json', 'watched.json', 'videoSources.json'];
    for (const file of files) {
        try {
            const sourcePath = path.join(CONFIG_DIR, file);
            const backupPath = path.join(backupDir, file);
            await fs_1.promises.copyFile(sourcePath, backupPath);
        }
        catch (error) {
            // Ignore files that don't exist
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
}
/**
 * Encode a file path to make it URL-safe for routing
 * Uses base64 encoding and replaces problematic characters
 */
function encodeFilePath(filePath) {
    try {
        // Convert to base64 and replace problematic characters
        const base64 = btoa(filePath);
        return base64.replace(/[+/=]/g, (match) => {
            switch (match) {
                case '+': return '-';
                case '/': return '_';
                case '=': return '';
                default: return match;
            }
        });
    }
    catch (error) {
        console.error('Error encoding file path:', error);
        // Fallback: replace problematic characters with underscores
        return filePath.replace(/[\/\\:]/g, '_').replace(/\s+/g, '_');
    }
}
/**
 * Decode a file path ID back to the original path
 * Reverses the base64 encoding
 */
function decodeFilePath(encodedPath) {
    try {
        // Restore base64 characters
        const base64 = encodedPath.replace(/[-_]/g, (match) => {
            switch (match) {
                case '-': return '+';
                case '_': return '/';
                default: return match;
            }
        });
        // Add padding if needed
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        return atob(padded);
    }
    catch (error) {
        console.error('Error decoding file path:', error);
        // Fallback: return the encoded path as-is
        return encodedPath;
    }
}
/**
 * Check if a string is an encoded file path
 * Useful for determining if a video ID is a local file
 */
function isEncodedFilePath(id) {
    // Encoded paths are typically longer and contain only safe characters
    return id.length > 10 && /^[a-zA-Z0-9_-]+$/.test(id);
}
/**
 * Reads time extra configuration (extra time added by parents)
 */
async function readTimeExtra() {
    return readJsonFile('timeExtra.json');
}
/**
 * Writes time extra configuration
 */
async function writeTimeExtra(timeExtra) {
    await writeJsonFile('timeExtra.json', timeExtra);
}
/**
 * Merges watched video data with video objects to populate resumeAt property
 */
async function mergeWatchedData(videos) {
    try {
        const watchedVideos = await readWatchedVideos();
        return videos.map(video => {
            const watchedEntry = watchedVideos.find(w => w.videoId === video.id);
            if (watchedEntry) {
                return {
                    ...video,
                    resumeAt: watchedEntry.position
                };
            }
            return video;
        });
    }
    catch (error) {
        console.warn('[FileUtils] Error merging watched data:', error);
        return videos;
    }
}
