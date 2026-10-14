import { describe, it, expect } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps /rides?date=2026-10-14; turns //evil.test, /\\evil.test and https://evil.test into /', () => {
    expect(safeNext('/rides?date=2026-10-14')).toBe('/rides?date=2026-10-14');
    expect(safeNext('//evil.test')).toBe('/');
    expect(safeNext('/\\evil.test')).toBe('/');
    expect(safeNext('https://evil.test')).toBe('/');
    expect(safeNext(null)).toBe('/');
    expect(safeNext('')).toBe('/');
  });
});
