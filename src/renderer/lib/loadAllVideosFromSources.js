"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAllVideosFromSources = loadAllVideosFromSources;
const cached_youtube_sources_1 = require("../services/cached-youtube-sources");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function logDebug(msg) {
    if (typeof window !== 'undefined' && window.logVerbose) {
        window.logVerbose(msg);
    }
    console.log(msg);
}
// Helper to scan local folders recursively up to maxDepth
async function scanLocalFolder(folderPath, maxDepth, currentDepth = 1) {
    let videos = [];
    if (currentDepth > maxDepth)
        return videos;
    const entries = fs_1.default.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path_1.default.join(folderPath, entry.name);
        if (entry.isDirectory()) {
            if (currentDepth < maxDepth) {
                videos = videos.concat(await scanLocalFolder(fullPath, maxDepth, currentDepth + 1));
            }
        }
        else if (entry.isFile() && isVideoFile(entry.name)) {
            videos.push({
                id: fullPath,
                type: 'local',
                title: path_1.default.basename(entry.name, path_1.default.extname(entry.name)),
                thumbnail: '', // Could generate or use a placeholder
                duration: 0, // Could be filled in later
                url: fullPath
            });
        }
    }
    return videos;
}
function isVideoFile(filename) {
    return /\.(mp4|mkv|webm|mov|avi)$/i.test(filename);
}
async function loadAllVideosFromSources(configPath = 'config/videoSources.json') {
    const debug = [];
    let sources = [];
    logDebug(`[Loader] Starting loadAllVideosFromSources with configPath: ${configPath}`);
    try {
        debug.push(`[Loader] Loading video sources from: ${configPath}`);
        sources = JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
        debug.push(`[Loader] Loaded ${sources.length} sources.`);
        logDebug(`[Loader] Loaded ${sources.length} sources from config.`);
    }
    catch (err) {
        debug.push(`[Loader] ERROR loading videoSources.json: ${err}`);
        logDebug(`[Loader] ERROR loading videoSources.json: ${err}`);
        return { videos: [], debug };
    }
    let allVideos = [];
    for (const source of sources) {
        if (!source || typeof source !== 'object' || !('type' in source) || !('id' in source)) {
            debug.push(`[Loader] WARNING: Skipping invalid source entry: ${JSON.stringify(source)}`);
            logDebug(`[Loader] WARNING: Skipping invalid source entry: ${JSON.stringify(source)}`);
            continue;
        }
        debug.push(`[Loader] Processing source: ${source.id} (${source.type})`);
        logDebug(`[Loader] Processing source: ${source.id} (${source.type})`);
        if (source.type === 'youtube_channel' || source.type === 'youtube_playlist') {
            const typedSource = source;
            try {
                const cache = await cached_youtube_sources_1.CachedYouTubeSources.loadSourceVideos(typedSource);
                let sourceTitle = typedSource.title;
                let sourceThumbnail = typedSource.thumbnail;
                // Fill in title/thumbnail if blank
                if (!sourceTitle || !sourceThumbnail) {
                    if (cache && cache.videos.length > 0) {
                        if (!sourceTitle) {
                            if (typedSource.type === 'youtube_channel') {
                                sourceTitle = cache.videos[0].channelTitle || '';
                            }
                            else if (typedSource.type === 'youtube_playlist') {
                                sourceTitle = cache.videos[0].playlistTitle || '';
                            }
                        }
                        if (!sourceThumbnail) {
                            if (typedSource.type === 'youtube_channel') {
                                sourceThumbnail = cache.videos[0].thumbnail || '';
                            }
                            else if (typedSource.type === 'youtube_playlist') {
                                sourceThumbnail = cache.videos[0].thumbnail || '';
                            }
                        }
                    }
                }
                debug.push(`[Loader] YouTube source ${typedSource.id}: ${cache.videos.length} videos loaded. Title: ${sourceTitle || typedSource.title}, Thumbnail: ${sourceThumbnail ? '[set]' : '[blank]'}`);
                logDebug(`[Loader] YouTube source ${typedSource.id}: ${cache.videos.length} videos loaded. Title: ${sourceTitle || typedSource.title}, Thumbnail: ${sourceThumbnail ? '[set]' : '[blank]'}`);
                allVideos = allVideos.concat(cache.videos.map(v => ({
                    ...v,
                    type: 'youtube',
                    sourceId: typedSource.id,
                    sourceTitle: sourceTitle || typedSource.title,
                    sourceThumbnail: sourceThumbnail || '',
                })));
            }
            catch (err) {
                debug.push(`[Loader] ERROR loading YouTube source ${typedSource.id}: ${err}`);
                logDebug(`[Loader] ERROR loading YouTube source ${typedSource.id}: ${err}`);
            }
        }
        else if (source.type === 'local') {
            const typedSource = source;
            try {
                const maxDepth = typedSource.maxDepth || 2;
                const localVideos = await scanLocalFolder(typedSource.path, maxDepth);
                debug.push(`[Loader] Local source ${typedSource.id}: ${localVideos.length} videos found.`);
                logDebug(`[Loader] Local source ${typedSource.id}: ${localVideos.length} videos found.`);
                allVideos = allVideos.concat(localVideos.map(v => ({
                    ...v,
                    sourceId: typedSource.id,
                    sourceTitle: typedSource.title,
                    sourceThumbnail: '',
                })));
            }
            catch (err) {
                debug.push(`[Loader] ERROR scanning local source ${typedSource.id}: ${err}`);
                logDebug(`[Loader] ERROR scanning local source ${typedSource.id}: ${err}`);
            }
        }
        else {
            debug.push(`[Loader] WARNING: Unsupported source type: ${source.type} (id: ${source.id}) - skipping.`);
            logDebug(`[Loader] WARNING: Unsupported source type: ${source.type} (id: ${source.id}) - skipping.`);
        }
    }
    debug.push(`[Loader] Total videos loaded: ${allVideos.length}`);
    logDebug(`[Loader] Total videos loaded: ${allVideos.length}`);
    return { videos: allVideos, debug };
}
