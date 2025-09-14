/**
 * Core error handling infrastructure for YouTube video loading
 * Provides error classification, result types, and enhanced logging utilities
 */

import { logVerbose, logError, logWarning } from './logging';

// Error classification system
export enum VideoErrorType {
  DELETED = 'deleted',           // Video has been deleted
  PRIVATE = 'private',           // Video is private
  RESTRICTED = 'restricted',     // Age-restricted or geo-blocked
  API_ERROR = 'api_error',       // API quota/rate limit issues
  NETWORK_ERROR = 'network_error', // Network connectivity issues
  UNKNOWN = 'unknown'            // Unclassified errors
}

// Video load error interface
export interface VideoLoadError {
  type: VideoErrorType;
  message: string;
  retryable: boolean;
  videoId?: string;
  timestamp?: string;
}

// Video load result interface
export interface VideoLoadResult {
  success: boolean;
  video?: ProcessedVideo;
  error?: VideoLoadError;
  videoId: string;
}

// Enhanced video interface to support error states
export interface ProcessedVideo {
  id: string;
  type: 'youtube' | 'local' | 'dlna';
  title: string;
  thumbnail: string;
  duration: number;
  url: string;
  publishedAt?: string;
  // New fields for error handling
  isAvailable: boolean;
  errorInfo?: VideoLoadError;
  isFallback?: boolean;
}

// Video error metrics for logging and monitoring
export interface VideoErrorMetrics {
  videoId: string;
  errorType: VideoErrorType;
  timestamp: string;
  retryCount: number;
  lastRetryAt?: string;
  permanentFailure: boolean;
}

// Video load metrics for batch processing
export interface VideoLoadMetrics {
  totalVideos: number;
  successfulLoads: number;
  failedLoads: number;
  errorBreakdown: Record<VideoErrorType, number>;
  loadTimeMs: number;
  sourceId?: string;
  pageNumber?: number;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrorTypes: VideoErrorType[];
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrorTypes: [VideoErrorType.API_ERROR, VideoErrorType.NETWORK_ERROR, VideoErrorType.UNKNOWN]
};

/**
 * Classifies video loading errors based on error message and context
 */
export function classifyVideoError(error: any, videoId: string): VideoLoadError {
  const timestamp = new Date().toISOString();
  const message = error?.message || (error !== null && error !== undefined ? String(error) : 'Unknown error occurred');
  
  // Check for specific error patterns
  if (message.includes('Video not found') || message.includes('not found')) {
    return {
      type: VideoErrorType.DELETED,
      message: 'Video has been deleted',
      retryable: false,
      videoId,
      timestamp
    };
  }
  
  if (message.includes('private') || message.includes('Private')) {
    return {
      type: VideoErrorType.PRIVATE,
      message: 'Video is private',
      retryable: false,
      videoId,
      timestamp
    };
  }
  
  if (message.includes('restricted') || message.includes('age') || message.includes('geo')) {
    return {
      type: VideoErrorType.RESTRICTED,
      message: 'Video is restricted (age/geo)',
      retryable: false,
      videoId,
      timestamp
    };
  }
  
  if (message.includes('quota') || message.includes('rate') || message.includes('limit')) {
    return {
      type: VideoErrorType.API_ERROR,
      message: 'API quota or rate limit exceeded',
      retryable: true,
      videoId,
      timestamp
    };
  }
  
  if (message.includes('timeout') || message.includes('network') || message.includes('ENOTFOUND') || message.includes('ECONNRESET')) {
    return {
      type: VideoErrorType.NETWORK_ERROR,
      message: 'Network connectivity issue',
      retryable: true,
      videoId,
      timestamp
    };
  }
  
  // Default to unknown error
  return {
    type: VideoErrorType.UNKNOWN,
    message: message || 'Unknown error occurred',
    retryable: true,
    videoId,
    timestamp
  };
}

/**
 * Enhanced logging utilities for video loading failures
 */
export class VideoErrorLogger {
  private static errorCounts = new Map<VideoErrorType, number>();
  private static videoErrors = new Map<string, VideoLoadError[]>();
  
  /**
   * Logs individual video loading failure
   */
  static logVideoError(videoId: string, error: VideoLoadError): void {
    // Store error for this video
    if (!this.videoErrors.has(videoId)) {
      this.videoErrors.set(videoId, []);
    }
    this.videoErrors.get(videoId)!.push(error);
    
    // Update error type counts
    const currentCount = this.errorCounts.get(error.type) || 0;
    this.errorCounts.set(error.type, currentCount + 1);
    
    // Log with appropriate level based on error type
    const logMessage = `[VideoError] ${videoId}: ${error.type} - ${error.message}`;
    
    if (error.retryable) {
      logVerbose(logMessage);
    } else {
      logVerbose(logMessage + ' (permanent failure)');
    }
  }
  
  /**
   * Logs batch processing metrics
   */
  static logVideoLoadMetrics(metrics: VideoLoadMetrics): void {
    const successRate = Math.round((metrics.successfulLoads / metrics.totalVideos) * 100);
    const sourceInfo = metrics.sourceId ? ` Source: ${metrics.sourceId}` : '';
    const pageInfo = metrics.pageNumber ? ` Page: ${metrics.pageNumber}` : '';
    
    logVerbose(`[VideoLoad]${sourceInfo}${pageInfo}`);
    logVerbose(`[VideoLoad] Success: ${metrics.successfulLoads}/${metrics.totalVideos} (${successRate}%)`);
    logVerbose(`[VideoLoad] Load time: ${metrics.loadTimeMs}ms`);
    
    // Log error breakdown if there are failures
    if (metrics.failedLoads > 0) {
      logVerbose(`[VideoLoad] Error breakdown:`, metrics.errorBreakdown);
    }
    
    // Warn if high failure rate
    if (successRate < 50) {
      logWarning(`[VideoLoad] High failure rate${sourceInfo}${pageInfo}: ${metrics.failedLoads}/${metrics.totalVideos} failed`);
    }
  }
  
  /**
   * Logs error summary for debugging
   */
  static logErrorSummary(): void {
    if (this.errorCounts.size === 0) {
      return;
    }
    
    logVerbose('[VideoError] Error Summary:');
    this.errorCounts.forEach((count, errorType) => {
      logVerbose(`[VideoError]   ${errorType}: ${count}`);
    });
  }
  
  /**
   * Gets error history for a specific video
   */
  static getVideoErrorHistory(videoId: string): VideoLoadError[] {
    return this.videoErrors.get(videoId) || [];
  }
  
  /**
   * Clears error tracking (useful for testing)
   */
  static clearErrorTracking(): void {
    this.errorCounts.clear();
    this.videoErrors.clear();
  }
  
  /**
   * Gets current error statistics
   */
  static getErrorStatistics(): { totalErrors: number; errorBreakdown: Record<VideoErrorType, number> } {
    const errorBreakdown: Record<VideoErrorType, number> = {
      [VideoErrorType.DELETED]: 0,
      [VideoErrorType.PRIVATE]: 0,
      [VideoErrorType.RESTRICTED]: 0,
      [VideoErrorType.API_ERROR]: 0,
      [VideoErrorType.NETWORK_ERROR]: 0,
      [VideoErrorType.UNKNOWN]: 0
    };
    
    let totalErrors = 0;
    this.errorCounts.forEach((count, errorType) => {
      errorBreakdown[errorType as VideoErrorType] = count;
      totalErrors += count;
    });
    
    return { totalErrors, errorBreakdown };
  }
}

/**
 * Creates a fallback video object for failed video loads
 */
export function createFallbackVideo(videoId: string, error?: VideoLoadError): ProcessedVideo {
  return {
    id: videoId,
    type: 'youtube',
    title: `Video ${videoId} (Unavailable)`,
    thumbnail: '/placeholder-thumbnail.svg',
    duration: 0,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    isAvailable: false,
    isFallback: true,
    errorInfo: error
  };
}

/**
 * Creates video load metrics object for batch processing
 */
export function createVideoLoadMetrics(
  totalVideos: number,
  successfulLoads: number,
  failedLoads: number,
  errorBreakdown: Record<VideoErrorType, number>,
  loadTimeMs: number,
  sourceId?: string,
  pageNumber?: number
): VideoLoadMetrics {
  return {
    totalVideos,
    successfulLoads,
    failedLoads,
    errorBreakdown,
    loadTimeMs,
    sourceId,
    pageNumber
  };
}