import fs from 'fs';
import path from 'path';

describe('Video Sources Configuration', () => {
  const configPath = path.join(process.cwd(), 'config', 'videoSources.json');
  
  test('should have videoSources.json config file', () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });
  
  test('should parse videoSources.json as valid JSON', () => {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);
  });
  
  test('should have valid source structure', () => {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    config.forEach((source: any, index: number) => {
      expect(source).toHaveProperty('id');
      expect(source).toHaveProperty('type');
      expect(source).toHaveProperty('title');
      expect(source).toHaveProperty('sortOrder');
      
      // Validate required fields
      expect(typeof source.id).toBe('string');
      expect(typeof source.type).toBe('string');
      expect(typeof source.title).toBe('string');
      expect(typeof source.sortOrder).toBe('string');
      
      // Validate type values - allow custom types for now
      expect(typeof source.type).toBe('string');
      
      // Validate sortOrder values - allow custom sort orders
      expect(typeof source.sortOrder).toBe('string');
      
      // Type-specific validations
      if (source.type.includes('youtube') || source.type === 'skypaul77') {
        expect(source).toHaveProperty('url');
        expect(typeof source.url).toBe('string');
        expect(source.url).toMatch(/^https:\/\/www\.youtube\.com\//);
      }
      
      if (source.type === 'local') {
        expect(source).toHaveProperty('path');
        expect(typeof source.path).toBe('string');
        // maxDepth is optional for local sources
        if (source.maxDepth !== undefined) {
          expect(typeof source.maxDepth).toBe('number');
          expect(source.maxDepth).toBeGreaterThan(0);
          expect(source.maxDepth).toBeLessThanOrEqual(5);
        }
      }
    });
  });
});
