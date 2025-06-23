"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentDate = getCurrentDate;
exports.getDayOfWeek = getDayOfWeek;
exports.getTimeLimitForToday = getTimeLimitForToday;
exports.getTimeUsedToday = getTimeUsedToday;
exports.addTimeUsedToday = addTimeUsedToday;
exports.getTimeTrackingState = getTimeTrackingState;
exports.formatTimeRemaining = formatTimeRemaining;
exports.formatTimeUsed = formatTimeUsed;
exports.recordVideoWatching = recordVideoWatching;
exports.getLastWatchedVideo = getLastWatchedVideo;
exports.resetDailyUsage = resetDailyUsage;
exports.getUsageHistory = getUsageHistory;
exports.validateTimeLimits = validateTimeLimits;
const fileUtils_1 = require("./fileUtils");
/**
 * Gets the current date in ISO format (YYYY-MM-DD)
 */
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}
/**
 * Gets the day of the week from a date string
 */
function getDayOfWeek(dateString) {
    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}
/**
 * Gets the time limit for today
 */
async function getTimeLimitForToday() {
    const timeLimits = await (0, fileUtils_1.readTimeLimits)();
    const today = getCurrentDate();
    const dayOfWeek = getDayOfWeek(today);
    return timeLimits[dayOfWeek] || 0;
}
/**
 * Gets the time used today in seconds
 */
async function getTimeUsedToday() {
    const usageLog = await (0, fileUtils_1.readUsageLog)();
    const today = getCurrentDate();
    return usageLog[today] || 0;
}
/**
 * Adds time to today's usage in seconds
 */
async function addTimeUsedToday(seconds) {
    const usageLog = await (0, fileUtils_1.readUsageLog)();
    const today = getCurrentDate();
    usageLog[today] = (usageLog[today] || 0) + seconds;
    await (0, fileUtils_1.writeUsageLog)(usageLog);
}
/**
 * Gets the current time tracking state
 */
async function getTimeTrackingState() {
    const currentDate = getCurrentDate();
    const timeUsedTodaySeconds = await getTimeUsedToday();
    const timeLimitTodayMinutes = await getTimeLimitForToday();
    // Convert time limit from minutes to seconds for comparison
    const timeLimitTodaySeconds = timeLimitTodayMinutes * 60;
    const timeRemainingSeconds = Math.max(0, timeLimitTodaySeconds - timeUsedTodaySeconds);
    const isLimitReached = timeRemainingSeconds <= 0;
    return {
        currentDate,
        timeUsedToday: timeUsedTodaySeconds,
        timeLimitToday: timeLimitTodaySeconds,
        timeRemaining: timeRemainingSeconds,
        isLimitReached
    };
}
/**
 * Formats time remaining in a human-readable format
 */
function formatTimeRemaining(seconds) {
    if (seconds <= 0) {
        return 'No time remaining';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m ${remainingSeconds}s remaining`;
    }
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s remaining`;
    }
    return `${remainingSeconds}s remaining`;
}
/**
 * Formats time used in a human-readable format
 */
function formatTimeUsed(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m ${remainingSeconds}s used`;
    }
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s used`;
    }
    return `${remainingSeconds}s used`;
}
/**
 * Records video watching time
 * @param videoId - The video identifier
 * @param position - Current position in seconds
 * @param timeWatched - Time watched in seconds (since last call)
 */
async function recordVideoWatching(videoId, position, timeWatched) {
    console.log('[TimeTracking] recordVideoWatching:', { videoId, position, timeWatched });
    // Add to daily usage in seconds (for precision)
    await addTimeUsedToday(timeWatched);
    // Update watched video history
    const watchedVideos = await (0, fileUtils_1.readWatchedVideos)();
    const now = new Date().toISOString();
    const existingIndex = watchedVideos.findIndex(v => v.videoId === videoId);
    if (existingIndex >= 0) {
        // Update existing entry
        watchedVideos[existingIndex] = {
            ...watchedVideos[existingIndex],
            position,
            lastWatched: now,
            timeWatched: watchedVideos[existingIndex].timeWatched + timeWatched
        };
    }
    else {
        // Add new entry
        watchedVideos.push({
            videoId,
            position,
            lastWatched: now,
            timeWatched
        });
    }
    await (0, fileUtils_1.writeWatchedVideos)(watchedVideos);
}
/**
 * Gets the last watched video for resume functionality
 */
async function getLastWatchedVideo() {
    const watchedVideos = await (0, fileUtils_1.readWatchedVideos)();
    if (watchedVideos.length === 0) {
        return null;
    }
    // Sort by last watched time and return the most recent
    const sorted = watchedVideos.sort((a, b) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime());
    return sorted[0];
}
/**
 * Resets daily usage (useful for testing or manual reset)
 */
async function resetDailyUsage() {
    const usageLog = await (0, fileUtils_1.readUsageLog)();
    const today = getCurrentDate();
    delete usageLog[today];
    await (0, fileUtils_1.writeUsageLog)(usageLog);
}
/**
 * Gets usage history for the last N days
 */
async function getUsageHistory(days = 7) {
    const usageLog = await (0, fileUtils_1.readUsageLog)();
    const today = new Date();
    const history = [];
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        // Convert seconds to minutes for display
        const secondsUsed = usageLog[dateString] || 0;
        const minutesUsed = Math.round(secondsUsed / 60 * 100) / 100; // Round to 2 decimal places
        history.push({
            date: dateString,
            minutes: minutesUsed
        });
    }
    return history.reverse();
}
/**
 * Validates time limits configuration
 */
function validateTimeLimits(timeLimits) {
    const errors = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of days) {
        const limit = timeLimits[day];
        if (typeof limit !== 'number') {
            errors.push(`${day}: must be a number`);
        }
        else if (limit < 0) {
            errors.push(`${day}: cannot be negative`);
        }
        else if (limit > 1440) {
            errors.push(`${day}: cannot exceed 24 hours (1440 minutes)`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
