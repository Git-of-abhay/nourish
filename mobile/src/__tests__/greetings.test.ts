import { describe, expect, it } from 'vitest';
import { greeting } from '../greetings';

describe('greeting', () => {
  it('is stable within a day and changes by time of day', () => {
    const morning = greeting(new Date(2026, 9, 14, 8));
    expect(greeting(new Date(2026, 9, 14, 9))).toBe(morning);
    expect(greeting(new Date(2026, 9, 14, 20))).not.toBe(morning);
  });
  it('always returns text', () => {
    for (let hour = 0; hour < 24; hour++) expect(greeting(new Date(2026, 9, 14, hour)).length).toBeGreaterThan(3);
  });
});
