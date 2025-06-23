"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTimeLimits = readTimeLimits;
exports.writeTimeLimits = writeTimeLimits;
exports.readUsageLog = readUsageLog;
exports.writeUsageLog = writeUsageLog;
exports.readWatchedVideos = readWatchedVideos;
exports.writeWatchedVideos = writeWatchedVideos;
exports.readVideoSources = readVideoSources;
exports.writeVideoSources = writeVideoSources;
exports.backupConfig = backupConfig;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const CONFIG_DIR = path_1.default.join(process.cwd(), 'config');
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
    const filePath = path_1.default.join(CONFIG_DIR, filename);
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
    const filePath = path_1.default.join(CONFIG_DIR, filename);
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
 * Creates a backup of all configuration files
 */
async function backupConfig() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path_1.default.join(CONFIG_DIR, 'backup', timestamp);
    await fs_1.promises.mkdir(backupDir, { recursive: true });
    const files = ['timeLimits.json', 'usageLog.json', 'watched.json', 'videoSources.json'];
    for (const file of files) {
        try {
            const sourcePath = path_1.default.join(CONFIG_DIR, file);
            const backupPath = path_1.default.join(backupDir, file);
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
