/**
 * Tests for fallback video creation logic
 * Verifies video ID extraction, YouTube URL generation, and placeholder content
 */

import { describe, it, expect } from 'vitest';
import { createFallbackVideo, VideoErrorType, classifyVideoError } from '../videoErrorHandling';

describe('Fallback Video Creation Logic', () => {
  describe('createFallbackVideo', () => {
    it('should extract video ID and generate correct YouTube URL', () => {
      const videoId = 'dQw4w9WgXcQ';
      const fallback = createFallbackVideo(videoId);

      expect(fallback.id).toBe(videoId);
      expect(fallback.url).toBe(`https://www.youtube.com/watch?v=${videoId}`);
    });

    it('should generate appropriate placeholder thumbnail', () => {
      const videoId = 'test123';
      const fallback = createFallbackVideo(videoId);

      expect(fallback.thumbnail).toBe('/placeholder-thumbnail.svg');
    });

    it('should generate appropriate placeholder title', () => {
      const videoId = 'abc123';
      const fallback = createFallbackVideo(videoId);

      expect(fallback.title).toBe(`Video ${videoId} (Unavailable)`);
    });

    it('should set correct fallback properties', () => {
      const videoId = 'test456';
      const fallback = createFallbackVideo(videoId);

      expect(fallback.type).toBe('youtube');
      expect(fallback.duration).toBe(0);
      expect(fallback.isAvailable).toBe(false);
      expect(fallback.isFallback).toBe(true);
    });

    it('should handle video IDs with special characters', () => {
      const videoId = 'abc-123_XYZ';
      const fallback = createFallbackVideo(videoId);

      expect(fallback.id).toBe(videoId);
      expect(fallback.url).toBe(`https://www.youtube.com/watch?v=${videoId}`);
      expect(fallback.title).toBe(`Video ${videoId} (Unavailable)`);
    });

    it('should include error information when provided', () => {
      const videoId = 'error123';
      const error = classifyVideoError(new Error('Video not found'), videoId);
      const fallback = createFallbackVideo(videoId, error);

      expect(fallback.errorInfo).toBe(error);
      expect(fallback.errorInfo?.type).toBe(VideoErrorType.DELETED);
      expect(fallback.errorInfo?.videoId).toBe(videoId);
    });

    it('should work without error information', () => {
      const videoId = 'noerror123';
      const fallback = createFallbackVideo(videoId);

      expect(fallback.errorInfo).toBeUndefined();
      expect(fallback.isAvailable).toBe(false);
      expect(fallback.isFallback).toBe(true);
    });

    it('should handle empty video ID gracefully', () => {
      const videoId = '';
      const fallback = createFallbackVideo(videoId);

      expect(fallback.id).toBe('');
      expect(fallback.url).toBe('https://www.youtube.com/watch?v=');
      expect(fallback.title).toBe('Video  (Unavailable)');
    });

    it('should handle long video IDs', () => {
      const videoId = 'a'.repeat(50); // Very long video ID
      const fallback = createFallbackVideo(videoId);

      expect(fallback.id).toBe(videoId);
      expect(fallback.url).toBe(`https://www.youtube.com/watch?v=${videoId}`);
      expect(fallback.title).toBe(`Video ${videoId} (Unavailable)`);
    });

    it('should maintain consistent structure for all fallback videos', () => {
      const videoIds = ['test1', 'test2', 'test3'];
      const fallbacks = videoIds.map(id => createFallbackVideo(id));

      fallbacks.forEach((fallback, index) => {
        expect(fallback).toHaveProperty('id');
        expect(fallback).toHaveProperty('type');
        expect(fallback).toHaveProperty('title');
        expect(fallback).toHaveProperty('thumbnail');
        expect(fallback).toHaveProperty('duration');
        expect(fallback).toHaveProperty('url');
        expect(fallback).toHaveProperty('isAvailable');
        expect(fallback).toHaveProperty('isFallback');
        
        expect(fallback.type).toBe('youtube');
        expect(fallback.isAvailable).toBe(false);
        expect(fallback.isFallback).toBe(true);
        expect(fallback.duration).toBe(0);
        expect(fallback.thumbnail).toBe('/placeholder-thumbnail.svg');
      });
    });
  });
});