import { describe, expect, it } from 'vitest';
import { bearerMatches } from './auth';

describe('bearerMatches', () => {
  it('accepts only the exact bearer token', () => {
    expect(bearerMatches('Bearer s3cret', 's3cret')).toBe(true);
    expect(bearerMatches('Bearer s3cret ', 's3cret')).toBe(false);
    expect(bearerMatches('Bearer other1', 's3cret')).toBe(false);
    expect(bearerMatches('Bearer s3cre', 's3cret')).toBe(false);
    expect(bearerMatches('s3cret', 's3cret')).toBe(false);
    expect(bearerMatches('bearer s3cret', 's3cret')).toBe(false);
  });
  it('rejects tokens of a different length without throwing', () => {
    expect(bearerMatches('Bearer a', 's3cret')).toBe(false);
    expect(bearerMatches(`Bearer ${'x'.repeat(500)}`, 's3cret')).toBe(false);
  });
  it('rejects everything when no secret is configured or no header is sent', () => {
    expect(bearerMatches('Bearer ', '')).toBe(false);
    expect(bearerMatches('Bearer x', undefined)).toBe(false);
    expect(bearerMatches(null, 's3cret')).toBe(false);
    expect(bearerMatches(undefined, 's3cret')).toBe(false);
  });
});
