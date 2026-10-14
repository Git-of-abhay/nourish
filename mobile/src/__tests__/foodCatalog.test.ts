import { describe, expect, it } from 'vitest';
import { estimateFromNames } from '../foodCatalog';

describe('estimateFromNames', () => {
  it('adds up known foods', () => {
    expect(estimateFromNames(['rice', 'dal']).kcal).toBe(405);
  });
  it('matches names loosely, ignoring case', () => {
    expect(estimateFromNames(['Boiled Egg']).kcal).toBe(72);
  });
  it('gives up when any food is unknown, so the user types it', () => {
    expect(estimateFromNames(['rice', 'quinoa bowl'])).toEqual({ kcal: null, portion: '' });
    expect(estimateFromNames([])).toEqual({ kcal: null, portion: '' });
  });
});
