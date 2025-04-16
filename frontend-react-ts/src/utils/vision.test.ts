/**
 * Tests for vision utilities
 */

import { validateAndProcessImages, guessMimeType, removeDataUrlPrefix, handleRequest } from './vision';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Sample base64 image (very small 1x1 pixel JPEG)
const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sampleDataUrl = `data:image/jpeg;base64,${sampleBase64}`;

// Mock the fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('vision utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('guessMimeType', () => {
    it('should return the correct MIME type for known extensions', () => {
      expect(guessMimeType('image.jpg')).toBe('image/jpeg');
      expect(guessMimeType('image.jpeg')).toBe('image/jpeg');
      expect(guessMimeType('image.png')).toBe('image/png');
      expect(guessMimeType('image.gif')).toBe('image/gif');
      expect(guessMimeType('image.webp')).toBe('image/webp');
      expect(guessMimeType('image.svg')).toBe('image/svg+xml');
      expect(guessMimeType('image.bmp')).toBe('image/bmp');
    });

    it('should return a default MIME type for unknown extensions', () => {
      expect(guessMimeType('image.unknown')).toBe('image/jpeg');
      expect(guessMimeType('no-extension')).toBe('image/jpeg');
    });
  });

  describe('removeDataUrlPrefix', () => {
    it('should remove the data URL prefix from a base64 string', () => {
      expect(removeDataUrlPrefix(sampleDataUrl)).toBe(sampleBase64);
    });

    it('should return the original string if no data URL prefix is found', () => {
      expect(removeDataUrlPrefix(sampleBase64)).toBe(sampleBase64);
    });
  });

  describe('validateAndProcessImages', () => {
    let loggerMock: any;

    beforeEach(() => {
      loggerMock = vi.fn();
    });

    it('should handle empty input', async () => {
      const result = await validateAndProcessImages(null, loggerMock);
      expect(result).toEqual([]);
      expect(loggerMock).toHaveBeenCalled();
    });

    it('should convert non-array input to array', async () => {
      const result = await validateAndProcessImages('not-an-array', loggerMock);
      expect(Array.isArray(result)).toBe(true);
      expect(loggerMock).toHaveBeenCalled();
    });

    it('should accept and return base64 strings', async () => {
      const result = await validateAndProcessImages([sampleBase64], loggerMock);
      expect(result).toEqual([sampleBase64]);
    });

    it('should remove data URL prefix', async () => {
      const result = await validateAndProcessImages([sampleDataUrl], loggerMock);
      expect(result).toEqual([sampleBase64]);
    });

    it('should handle mixed inputs', async () => {
      const inputs = [sampleBase64, sampleDataUrl, null, {}];
      const result = await validateAndProcessImages(inputs, loggerMock);
      expect(result).toEqual([sampleBase64, sampleBase64]);
    });

    it('should handle URL image paths', async () => {
      // Mock the fetch response
      const mockBlob = new Blob(['dummy-image-data'], { type: 'image/jpeg' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob)
      });

      // Mock FileReader for base64 conversion
      const originalFileReader = global.FileReader;
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: sampleDataUrl
      };
      global.FileReader = vi.fn(() => mockFileReader) as any;

      // Process an image URL
      const imageUrl = 'https://example.com/image.jpg';
      const result = await validateAndProcessImages([imageUrl], loggerMock);

      // Test that fetch was called with the URL
      expect(mockFetch).toHaveBeenCalledWith(imageUrl);

      // After processing, this should trigger readAsDataURL and simulate the onload event
      if (mockFileReader.onload) {
        mockFileReader.onload();
      }

      // The result should be the base64 data (after removing the data URL prefix)
      expect(result).toEqual([sampleBase64]);

      // Restore FileReader
      global.FileReader = originalFileReader;
    });

    it('should handle fetch errors for image URLs', async () => {
      // Mock a failed fetch
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const imageUrl = 'https://example.com/image.jpg';
      const result = await validateAndProcessImages([imageUrl], loggerMock);

      expect(mockFetch).toHaveBeenCalledWith(imageUrl);
      expect(result).toEqual([]);
      expect(loggerMock).toHaveBeenCalled();
    });

    it('should reject invalid file paths', async () => {
      const result = await validateAndProcessImages(['invalid-path-no-extension'], loggerMock);
      expect(result).toEqual([]);
      expect(loggerMock).toHaveBeenCalled();
    });

    it('should handle a mix of valid and invalid paths', async () => {
      // Mock a successful fetch for one URL and a failed fetch for another
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          blob: vi.fn().mockResolvedValue(new Blob(['data'], { type: 'image/jpeg' }))
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        });

      // Mock FileReader for base64 conversion
      const originalFileReader = global.FileReader;
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: sampleDataUrl
      };
      global.FileReader = vi.fn(() => mockFileReader) as any;

      const validUrl = 'https://example.com/valid.jpg';
      const invalidUrl = 'https://example.com/invalid.jpg';
      
      const result = await validateAndProcessImages([validUrl, invalidUrl, sampleBase64], loggerMock);

      // Simulate the onload event for the FileReader
      if (mockFileReader.onload) {
        mockFileReader.onload();
      }

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(validUrl);
      expect(mockFetch).toHaveBeenCalledWith(invalidUrl);
      
      // We expect only the valid URL (converted to base64) and the original base64 string
      expect(result).toContain(sampleBase64);
      expect(result.length).toBe(2);

      // Restore FileReader
      global.FileReader = originalFileReader;
    });
  });
}); 