"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeAPI = void 0;
const zod_1 = require("zod");
const logging_1 = require("../../shared/logging");
// YouTube API response schemas
const VideoSchema = zod_1.z.object({
    id: zod_1.z.string(),
    snippet: zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        thumbnails: zod_1.z.object({
            default: zod_1.z.object({ url: zod_1.z.string() }),
            medium: zod_1.z.object({ url: zod_1.z.string() }),
            high: zod_1.z.object({ url: zod_1.z.string() }),
            maxres: zod_1.z.object({ url: zod_1.z.string() }).optional(),
        }),
        channelId: zod_1.z.string(),
        channelTitle: zod_1.z.string(),
    }),
    contentDetails: zod_1.z.object({
        duration: zod_1.z.string(), // ISO 8601 duration
        dimension: zod_1.z.string(), // "2d" or "3d"
        definition: zod_1.z.string(), // "hd" or "sd"
    }),
    status: zod_1.z.object({
        privacyStatus: zod_1.z.string(),
        madeForKids: zod_1.z.boolean(),
    }),
});
const PlayerSchema = zod_1.z.object({
    streamingData: zod_1.z.object({
        formats: zod_1.z.array(zod_1.z.object({
            itag: zod_1.z.number(),
            url: zod_1.z.string(),
            mimeType: zod_1.z.string(),
            bitrate: zod_1.z.number(),
            width: zod_1.z.number().optional(),
            height: zod_1.z.number().optional(),
            lastModified: zod_1.z.string(),
            contentLength: zod_1.z.string(),
            quality: zod_1.z.string(),
            fps: zod_1.z.number().optional(),
            qualityLabel: zod_1.z.string().optional(),
            projectionType: zod_1.z.string(),
            averageBitrate: zod_1.z.number().optional(),
            audioQuality: zod_1.z.string().optional(),
            approxDurationMs: zod_1.z.string(),
            audioSampleRate: zod_1.z.string().optional(),
            audioChannels: zod_1.z.number().optional(),
        })),
        adaptiveFormats: zod_1.z.array(zod_1.z.object({
            itag: zod_1.z.number(),
            url: zod_1.z.string(),
            mimeType: zod_1.z.string(),
            bitrate: zod_1.z.number(),
            width: zod_1.z.number().optional(),
            height: zod_1.z.number().optional(),
            lastModified: zod_1.z.string(),
            contentLength: zod_1.z.string(),
            quality: zod_1.z.string(),
            fps: zod_1.z.number().optional(),
            qualityLabel: zod_1.z.string().optional(),
            projectionType: zod_1.z.string(),
            averageBitrate: zod_1.z.number().optional(),
            audioQuality: zod_1.z.string().optional(),
            approxDurationMs: zod_1.z.string(),
            audioSampleRate: zod_1.z.string().optional(),
            audioChannels: zod_1.z.number().optional(),
            language: zod_1.z.string().optional(),
        })),
    }),
    videoDetails: zod_1.z.object({
        videoId: zod_1.z.string(),
        title: zod_1.z.string(),
        lengthSeconds: zod_1.z.string(),
        channelId: zod_1.z.string(),
        isOwnerViewing: zod_1.z.boolean(),
        isCrawlable: zod_1.z.boolean(),
        thumbnails: zod_1.z.array(zod_1.z.object({
            url: zod_1.z.string(),
            width: zod_1.z.number(),
            height: zod_1.z.number(),
        })),
        averageRating: zod_1.z.number(),
        allowRatings: zod_1.z.boolean(),
        viewCount: zod_1.z.string(),
        author: zod_1.z.string(),
        isPrivate: zod_1.z.boolean(),
        isUnpluggedCorpus: zod_1.z.boolean(),
        isLiveContent: zod_1.z.boolean(),
    }),
});
const PlaylistItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    snippet: zod_1.z.object({
        resourceId: zod_1.z.object({
            videoId: zod_1.z.string(),
        }),
    }),
});
const PlaylistSchema = zod_1.z.object({
    items: zod_1.z.array(PlaylistItemSchema),
    nextPageToken: zod_1.z.string().optional(),
});
const ChannelSchema = zod_1.z.object({
    id: zod_1.z.string(),
    snippet: zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        thumbnails: zod_1.z.object({
            default: zod_1.z.object({ url: zod_1.z.string() }),
            medium: zod_1.z.object({ url: zod_1.z.string() }),
            high: zod_1.z.object({ url: zod_1.z.string() }),
        }),
    }),
    contentDetails: zod_1.z.object({
        relatedPlaylists: zod_1.z.object({
            uploads: zod_1.z.string(),
        }),
    }),
});
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';
class YouTubeAPI {
    static async fetch(endpoint, params) {
        const queryParams = new URLSearchParams({
            key: API_KEY,
            ...params,
        });
        const response = await fetch(`${BASE_URL}/${endpoint}?${queryParams}`);
        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.statusText}`);
        }
        return response.json();
    }
    static async getVideoDetails(videoId) {
        const data = await YouTubeAPI.fetch('videos', {
            part: 'snippet,contentDetails,status',
            id: videoId,
        });
        if (!data.items?.[0]) {
            throw new Error(`Video not found: ${videoId}`);
        }
        return VideoSchema.parse(data.items[0]);
    }
    static async getVideoPlayer(videoId) {
        const data = await YouTubeAPI.fetch('player', {
            part: 'streamingData,videoDetails',
            id: videoId,
        });
        return PlayerSchema.parse(data);
    }
    static async getVideoStreams(videoId) {
        try {
            // In test environment, use yt-dlp directly
            if (typeof window === 'undefined' || !window.electron?.getVideoStreams) {
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);
                const { stdout } = await execAsync(`yt-dlp -j "${videoId}"`);
                const data = JSON.parse(stdout);
                const videoStreams = data.formats
                    .filter((f) => f.vcodec !== 'none' && f.acodec === 'none')
                    .map((f) => ({
                    url: f.url,
                    quality: f.format_note || f.quality,
                    mimeType: f.ext,
                    width: f.width,
                    height: f.height,
                    fps: f.fps,
                    bitrate: f.tbr
                }));
                const audioTracks = data.formats
                    .filter((f) => f.vcodec === 'none' && f.acodec !== 'none')
                    .map((f) => ({
                    url: f.url,
                    language: f.language || 'en',
                    mimeType: f.ext,
                    bitrate: f.tbr
                }));
                return { videoStreams, audioTracks };
            }
            // In renderer process, use electron IPC
            return await window.electron.getVideoStreams(videoId);
        }
        catch (error) {
            console.error('Error getting video streams:', error);
            throw new Error('Failed to get video streams');
        }
    }
    static async getPlaylistVideos(playlistId, maxResults = 50) {
        const data = await YouTubeAPI.fetch('playlistItems', {
            part: 'snippet',
            playlistId,
            maxResults: maxResults.toString(),
        });
        return data.items.map(item => item.snippet.resourceId.videoId);
    }
    static async getChannelDetails(channelId) {
        const data = await YouTubeAPI.fetch('channels', {
            part: 'snippet,contentDetails',
            id: channelId,
        });
        if (!data.items?.[0]) {
            throw new Error(`Channel not found: ${channelId}`);
        }
        return ChannelSchema.parse(data.items[0]);
    }
    static async getChannelVideos(channelId, maxResults = 50) {
        const channel = await this.getChannelDetails(channelId);
        return this.getPlaylistVideos(channel.contentDetails.relatedPlaylists.uploads, maxResults);
    }
    // Helper to convert ISO 8601 duration to seconds
    static parseDuration(duration) {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match)
            return 0;
        const [, hours, minutes, seconds] = match;
        return ((parseInt(hours || '0') * 3600) +
            (parseInt(minutes || '0') * 60) +
            parseInt(seconds || '0'));
    }
    // Helper to check if URL is m3u8
    static isM3U8(url) {
        return url.toLowerCase().endsWith('.m3u8');
    }
    // Helper to get best quality stream URL
    static getBestStreamUrl(videoStreams, audioTracks) {
        // First try to find a combined format with high quality
        const combinedFormats = videoStreams
            .filter(s => s.mimeType.includes('mp4') && !YouTubeAPI.isM3U8(s.url)) // Prefer mp4 and non-m3u8
            .sort((a, b) => {
            // Sort by resolution first
            const heightDiff = (b.height || 0) - (a.height || 0);
            if (heightDiff !== 0)
                return heightDiff;
            // Then by FPS
            return (b.fps || 0) - (a.fps || 0);
        });
        if (combinedFormats.length > 0) {
            return combinedFormats[0].url;
        }
        // If no combined format, get highest quality video and audio separately
        const videoFormats = videoStreams
            .filter(s => !YouTubeAPI.isM3U8(s.url)) // Only filter out m3u8
            .sort((a, b) => {
            // Sort by resolution first
            const heightDiff = (b.height || 0) - (a.height || 0);
            if (heightDiff !== 0)
                return heightDiff;
            // Then by FPS
            return (b.fps || 0) - (a.fps || 0);
        });
        if (videoFormats.length > 0) {
            const bestVideo = videoFormats[0];
            const bestAudio = this.getBestAudioTrackByLanguage(audioTracks, ['en']);
            return `${bestVideo.url}|${bestAudio.url}`;
        }
        // Fallback to any non-m3u8 format
        const fallbackVideoFormats = videoStreams
            .filter(s => !YouTubeAPI.isM3U8(s.url)) // Prefer non-m3u8
            .sort((a, b) => {
            const heightDiff = (b.height || 0) - (a.height || 0);
            if (heightDiff !== 0)
                return heightDiff;
            return (b.fps || 0) - (a.fps || 0);
        });
        const fallbackAudioFormats = audioTracks
            .filter(a => !YouTubeAPI.isM3U8(a.url)) // Prefer non-m3u8
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        if (fallbackVideoFormats.length > 0 && fallbackAudioFormats.length > 0) {
            return `${fallbackVideoFormats[0].url}|${fallbackAudioFormats[0].url}`;
        }
        // Last resort: use any format
        const lastResortVideoFormats = videoStreams
            .sort((a, b) => {
            const heightDiff = (b.height || 0) - (a.height || 0);
            if (heightDiff !== 0)
                return heightDiff;
            return (b.fps || 0) - (a.fps || 0);
        });
        const lastResortAudioFormats = audioTracks
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        if (lastResortVideoFormats.length > 0 && lastResortAudioFormats.length > 0) {
            return `${lastResortVideoFormats[0].url}|${lastResortAudioFormats[0].url}`;
        }
        throw new Error('No suitable stream found');
    }
    // Helper to get best audio track by language preference
    static getBestAudioTrackByLanguage(audioTracks, preferredLanguages) {
        if (!audioTracks.length) {
            (0, logging_1.logVerboseRenderer)('No audio tracks available in getBestAudioTrackByLanguage');
            throw new Error('No audio tracks available');
        }
        (0, logging_1.logVerboseRenderer)('Getting best audio track for languages:', preferredLanguages);
        (0, logging_1.logVerboseRenderer)('Available audio tracks:', audioTracks.map(t => ({
            language: t.language,
            mimeType: t.mimeType,
            bitrate: t.bitrate
        })));
        // If no preferredLanguages, default to English
        const langs = (preferredLanguages && preferredLanguages.length > 0) ? preferredLanguages : ['en'];
        (0, logging_1.logVerboseRenderer)('Using languages:', langs);
        // For each language, pick the highest-bitrate track, non-m3u8
        for (const lang of langs) {
            (0, logging_1.logVerboseRenderer)(`Looking for language: ${lang}`);
            const candidates = audioTracks
                .filter(t => {
                const matches = t.language.toLowerCase() === lang.toLowerCase() && !YouTubeAPI.isM3U8(t.url);
                (0, logging_1.logVerboseRenderer)(`Track ${t.language} matches ${lang}? ${matches}`);
                return matches;
            })
                .sort((a, b) => {
                // First sort by mimeType (prefer m4a over webm)
                if (a.mimeType === 'm4a' && b.mimeType !== 'm4a')
                    return -1;
                if (a.mimeType !== 'm4a' && b.mimeType === 'm4a')
                    return 1;
                // Then by bitrate
                return (b.bitrate || 0) - (a.bitrate || 0);
            });
            (0, logging_1.logVerboseRenderer)(`Candidates for language ${lang}:`, candidates.map(t => ({
                language: t.language,
                mimeType: t.mimeType,
                bitrate: t.bitrate
            })));
            if (candidates.length > 0) {
                const selected = candidates[0];
                (0, logging_1.logVerboseRenderer)('Selected audio track:', {
                    language: selected.language,
                    mimeType: selected.mimeType,
                    bitrate: selected.bitrate
                });
                return selected;
            }
        }
        // If we get here, none of the preferred languages were found
        (0, logging_1.logVerboseRenderer)('No tracks found for preferred languages, falling back to any non-m3u8 track');
        // Fallback: any non-m3u8
        const anyNonM3U8Track = audioTracks
            .filter(t => !YouTubeAPI.isM3U8(t.url))
            .sort((a, b) => {
            // First sort by mimeType (prefer m4a over webm)
            if (a.mimeType === 'm4a' && b.mimeType !== 'm4a')
                return -1;
            if (a.mimeType !== 'm4a' && b.mimeType === 'm4a')
                return 1;
            // Then by bitrate
            return (b.bitrate || 0) - (a.bitrate || 0);
        })[0];
        if (anyNonM3U8Track) {
            (0, logging_1.logVerboseRenderer)('Selected fallback audio track:', {
                language: anyNonM3U8Track.language,
                mimeType: anyNonM3U8Track.mimeType,
                bitrate: anyNonM3U8Track.bitrate
            });
            return anyNonM3U8Track;
        }
        // Last resort: any
        const lastResortTrack = audioTracks
            .sort((a, b) => {
            // First sort by mimeType (prefer m4a over webm)
            if (a.mimeType === 'm4a' && b.mimeType !== 'm4a')
                return -1;
            if (a.mimeType !== 'm4a' && b.mimeType === 'm4a')
                return 1;
            // Then by bitrate
            return (b.bitrate || 0) - (a.bitrate || 0);
        })[0];
        (0, logging_1.logVerboseRenderer)('Selected last resort audio track:', {
            language: lastResortTrack.language,
            mimeType: lastResortTrack.mimeType,
            bitrate: lastResortTrack.bitrate
        });
        return lastResortTrack;
    }
    // Helper to get highest quality stream details
    static getHighestQualityStream(videoStreams, audioTracks, preferredLanguages = ['en'], maxQuality) {
        (0, logging_1.logVerboseRenderer)('getHighestQualityStream called with:', {
            videoStreamsCount: videoStreams.length,
            audioTracksCount: audioTracks.length,
            preferredLanguages,
            maxQuality
        });
        // Parse max quality to height limit
        const maxHeight = maxQuality ? this.parseMaxQuality(maxQuality) : undefined;
        (0, logging_1.logVerboseRenderer)('Max height limit:', maxHeight);
        // Filter streams by max quality if specified
        const filteredVideoStreams = maxHeight
            ? videoStreams.filter(s => (s.height || 0) <= maxHeight)
            : videoStreams;
        (0, logging_1.logVerboseRenderer)('Filtered video streams count:', filteredVideoStreams.length);
        // First try to find a combined format with high quality
        const combinedFormats = filteredVideoStreams
            .filter(s => s.mimeType.includes('mp4') && !YouTubeAPI.isM3U8(s.url) && s.mimeType.includes('audio')) // Must be mp4 and have audio
            .sort((a, b) => {
            // Sort by resolution first
            const heightDiff = (b.height || 0) - (a.height || 0);
            if (heightDiff !== 0)
                return heightDiff;
            // Then by FPS
            return (b.fps || 0) - (a.fps || 0);
        });
        (0, logging_1.logVerboseRenderer)('Combined formats found:', combinedFormats.length);
        if (combinedFormats.length > 0) {
            const best = combinedFormats[0];
            (0, logging_1.logVerboseRenderer)('Selected combined format:', {
                quality: best.quality,
                resolution: `${best.width || 0}x${best.height || 0}`,
                fps: best.fps
            });
            return {
                videoUrl: best.url,
                quality: best.quality,
                resolution: `${best.width || 0}x${best.height || 0}`,
                fps: best.fps,
            };
        }
        // If no combined format, get highest quality video and audio separately
        const videoFormats = filteredVideoStreams
            .filter(s => !YouTubeAPI.isM3U8(s.url)) // Only filter out m3u8
            .sort((a, b) => {
            // Sort by resolution first
            const heightDiff = (b.height || 0) - (a.height || 0);
            if (heightDiff !== 0)
                return heightDiff;
            // Then by FPS
            return (b.fps || 0) - (a.fps || 0);
        });
        if (videoFormats.length > 0) {
            const bestVideo = videoFormats[0];
            const bestAudio = this.getBestAudioTrackByLanguage(audioTracks, preferredLanguages);
            (0, logging_1.logVerboseRenderer)('Selected separate video/audio format:', {
                videoQuality: bestVideo.quality,
                videoResolution: `${bestVideo.width || 0}x${bestVideo.height || 0}`,
                videoFps: bestVideo.fps,
                audioLanguage: bestAudio.language
            });
            return {
                videoUrl: bestVideo.url,
                audioUrl: bestAudio.url,
                quality: bestVideo.quality,
                resolution: `${bestVideo.width || 0}x${bestVideo.height || 0}`,
                fps: bestVideo.fps,
                audioLanguage: bestAudio.language,
            };
        }
        // Last resort: use any format including M3U8
        const lastResortVideoFormats = filteredVideoStreams
            .sort((a, b) => {
            // Sort by resolution first
            const heightDiff = (b.height || 0) - (a.height || 0);
            if (heightDiff !== 0)
                return heightDiff;
            // Then by FPS
            return (b.fps || 0) - (a.fps || 0);
        });
        if (lastResortVideoFormats.length > 0) {
            const bestVideo = lastResortVideoFormats[0];
            let bestAudio;
            try {
                bestAudio = this.getBestAudioTrackByLanguage(audioTracks, preferredLanguages);
            }
            catch (error) {
                // If no audio tracks available, use the first one
                if (audioTracks.length > 0) {
                    bestAudio = audioTracks[0];
                }
                else {
                    // No audio tracks at all
                    (0, logging_1.logVerboseRenderer)('No audio tracks available, using video-only format');
                    return {
                        videoUrl: bestVideo.url,
                        quality: bestVideo.quality,
                        resolution: `${bestVideo.width || 0}x${bestVideo.height || 0}`,
                        fps: bestVideo.fps,
                    };
                }
            }
            (0, logging_1.logVerboseRenderer)('Selected last resort format:', {
                videoQuality: bestVideo.quality,
                videoResolution: `${bestVideo.width || 0}x${bestVideo.height || 0}`,
                videoFps: bestVideo.fps,
                audioLanguage: bestAudio.language
            });
            return {
                videoUrl: bestVideo.url,
                audioUrl: bestAudio.url,
                quality: bestVideo.quality,
                resolution: `${bestVideo.width || 0}x${bestVideo.height || 0}`,
                fps: bestVideo.fps,
                audioLanguage: bestAudio.language,
            };
        }
        throw new Error('No suitable stream found');
    }
    // Helper function to parse quality string to max height
    static parseMaxQuality(maxQuality) {
        const qualityMap = {
            '144p': 144,
            '240p': 240,
            '360p': 360,
            '480p': 480,
            '720p': 720,
            '1080p': 1080,
            '1440p': 1440,
            '2160p': 2160,
            '4k': 2160
        };
        return qualityMap[maxQuality.toLowerCase()] || 1080;
    }
    // Helper to get available audio tracks
    static getAudioTracks(player) {
        return player.streamingData.adaptiveFormats
            .filter(f => f.mimeType.startsWith('audio/') && f.language)
            .map(f => ({
            language: f.language,
            url: f.url,
        }));
    }
}
exports.YouTubeAPI = YouTubeAPI;
