/**
 * Unit tests for thumbnail URL parsing logic
 * Tests how different filenames are handled in the custom protocol
 */

import { describe, it, expect } from 'vitest';

describe('Thumbnail URL Parsing', () => {
  // Helper function that mimics the current protocol handler logic
  function parseFilenameFromUrl(requestUrl: string): string {
    const url = new URL(requestUrl);

    // For custom protocols, the "filename" might be in the hostname part
    let filename = url.hostname || url.pathname.slice(1);

    // Remove trailing slash if present
    if (filename.endsWith('/')) {
      filename = filename.slice(0, -1);
    }

    return filename;
  }

  // Helper function to test the improved version with URL decoding
  function parseFilenameFromUrlFixed(requestUrl: string): string {
    const url = new URL(requestUrl);

    // For custom protocols, the "filename" might be in the hostname part
    let filename = url.hostname || url.pathname.slice(1);

    // Remove trailing slash if present
    if (filename.endsWith('/')) {
      filename = filename.slice(0, -1);
    }

    // Decode URL encoding
    try {
      filename = decodeURIComponent(filename);
    } catch (error) {
      // If decoding fails, use original filename
      console.warn('Failed to decode filename:', filename, error);
    }

    return filename;
  }

  describe('Current Implementation', () => {
    it('should parse simple filenames correctly', () => {
      const url = 'safetube-thumbnails://simple-file.mp4.jpg';
      const filename = parseFilenameFromUrl(url);

      expect(filename).toBe('simple-file.mp4.jpg');
    });

    it('should handle filenames with spaces (URL encoded)', () => {
      const originalFilename = 'Title - Desc.mp4.jpg';
      const encodedFilename = encodeURIComponent(originalFilename);
      const url = `safetube-thumbnails://${encodedFilename}`;

      const parsedFilename = parseFilenameFromUrl(url);

      console.log('Original:', originalFilename);
      console.log('Encoded:', encodedFilename);
      console.log('Parsed:', parsedFilename);

      // This test will show if the current implementation handles URL encoding
      expect(parsedFilename).toBe(encodedFilename); // Current implementation doesn't decode
    });

    it('should expose the emoji encoding issue', () => {
      const originalFilename = 'Title 😂 [123].mp4.jpg';
      const encodedFilename = encodeURIComponent(originalFilename);
      const url = `safetube-thumbnails://${encodedFilename}`;

      const parsedFilename = parseFilenameFromUrl(url);

      console.log('Original:', originalFilename);
      console.log('Encoded:', encodedFilename);
      console.log('Parsed:', parsedFilename);

      expect(parsedFilename).toBe(encodedFilename); // Problem: encoded !== original
      expect(parsedFilename).not.toBe(originalFilename); // This shows the bug
    });

    it('should expose the colon parsing issue', () => {
      const originalFilename = 'Title: Desc.mp4.jpg';
      const encodedFilename = encodeURIComponent(originalFilename);
      const url = `safetube-thumbnails://${encodedFilename}`;

      const parsedFilename = parseFilenameFromUrl(url);

      console.log('Original:', originalFilename);
      console.log('Encoded:', encodedFilename);
      console.log('Parsed:', parsedFilename);

      expect(parsedFilename).not.toBe(originalFilename); // This shows the bug
    });
  });

  describe('Fixed Implementation', () => {
    it('should correctly decode simple filenames', () => {
      const url = 'safetube-thumbnails://simple-file.mp4.jpg';
      const filename = parseFilenameFromUrlFixed(url);

      expect(filename).toBe('simple-file.mp4.jpg');
    });

    it('should correctly decode filenames with spaces', () => {
      const originalFilename = 'Title - Desc.mp4.jpg';
      const encodedFilename = encodeURIComponent(originalFilename);
      const url = `safetube-thumbnails://${encodedFilename}`;

      const parsedFilename = parseFilenameFromUrlFixed(url);

      expect(parsedFilename).toBe(originalFilename); // Fixed version should decode correctly
    });

    it('should correctly decode filenames with emoji', () => {
      const originalFilename = 'Title 😂 [123].mp4.jpg';
      const encodedFilename = encodeURIComponent(originalFilename);
      const url = `safetube-thumbnails://${encodedFilename}`;

      const parsedFilename = parseFilenameFromUrlFixed(url);

      expect(parsedFilename).toBe(originalFilename); // Fixed version should decode correctly
    });

    it('should correctly decode filenames with colon', () => {
      const originalFilename = 'Title: Desc.mp4.jpg';
      const encodedFilename = encodeURIComponent(originalFilename);
      const url = `safetube-thumbnails://${encodedFilename}`;

      const parsedFilename = parseFilenameFromUrlFixed(url);

      expect(parsedFilename).toBe(originalFilename); // Fixed version should decode correctly
    });

    it('should correctly decode filenames with apostrophe', () => {
      const originalFilename = "Children's Movies.webm.jpg";
      const encodedFilename = encodeURIComponent(originalFilename);
      const url = `safetube-thumbnails://${encodedFilename}`;

      const parsedFilename = parseFilenameFromUrlFixed(url);

      expect(parsedFilename).toBe(originalFilename); // Fixed version should decode correctly
    });

    it('should handle invalid URL encoding gracefully', () => {
      const invalidEncodedFilename = 'invalid%encoding';
      const url = `safetube-thumbnails://${invalidEncodedFilename}`;

      const parsedFilename = parseFilenameFromUrlFixed(url);

      // Should fall back to original if decoding fails
      expect(parsedFilename).toBe(invalidEncodedFilename);
    });
  });

  describe('URL Generation', () => {
    it('should test how getThumbnailUrl generates URLs', () => {
      // This mimics the current getThumbnailUrl function
      function getThumbnailUrl(thumbnailPath: string): string {
        const filename = thumbnailPath.split('/').pop() || '';
        return `safetube-thumbnails://${filename}`;
      }

      const problematicPath = "/tmp/thumbnails/Title 😂 [123].mp4.jpg";
      const url = getThumbnailUrl(problematicPath);

      console.log('Generated URL:', url);
      console.log('Should be encoded as:', `safetube-thumbnails://${encodeURIComponent('Title 😂 [123].mp4.jpg')}`);

      // This will show that the URL generation doesn't encode filenames
      expect(url).toBe('safetube-thumbnails://Title 😂 [123].mp4.jpg');
      expect(url).not.toBe(`safetube-thumbnails://${encodeURIComponent('Title 😂 [123].mp4.jpg')}`);
    });

    it('should test fixed URL generation', () => {
      // This is the fixed version that encodes filenames
      function getThumbnailUrlFixed(thumbnailPath: string): string {
        const filename = thumbnailPath.split('/').pop() || '';
        return `safetube-thumbnails://${encodeURIComponent(filename)}`;
      }

      const problematicPath = "/tmp/thumbnails/Title 😂 [123].mp4.jpg";
      const url = getThumbnailUrlFixed(problematicPath);
      const parsedFilename = parseFilenameFromUrlFixed(url);

      console.log('Generated URL:', url);
      console.log('Parsed back to:', parsedFilename);

      // Fixed version should round-trip correctly
      expect(parsedFilename).toBe('Title 😂 [123].mp4.jpg');
    });
  });
});