import { describe, it, expect } from 'vitest';

describe('Smoke Test', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle basic math', () => {
    expect(1 + 1).toBe(2);
  });
}); 