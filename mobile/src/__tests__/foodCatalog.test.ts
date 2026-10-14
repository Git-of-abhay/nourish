import { describe, expect, it } from 'vitest';
import { estimateFromItems, estimateFromNames, isCalorieFree } from '../foodCatalog';

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


describe('estimateFromItems', () => {
  it('multiplies by the amount said: 3 cups of dal', () => {
    expect(estimateFromItems([{ name: 'dal', quantity: 3 }])).toEqual({ kcal: 600, portion: 'dal: 3 cups' });
  });
  it('handles several foods and pieces', () => {
    const result = estimateFromItems([{ name: 'roti', quantity: 2 }, { name: 'dal', quantity: 1 }]);
    expect(result.kcal).toBe(440);
    expect(result.portion).toBe('roti: 2 medium; dal: 1 cup');
  });
  it('supports fractions', () => {
    expect(estimateFromItems([{ name: 'rice', quantity: 0.5 }]).kcal).toBe(103);
  });
  it('leaves the estimate empty for unknown foods', () => {
    expect(estimateFromItems([{ name: 'quinoa', quantity: 2 }])).toEqual({ kcal: null, portion: '' });
  });
});

describe('isCalorieFree', () => {
  it('allows water-like drinks only', () => {
    for (const name of ['water', 'Plain Water', 'black coffee', 'green tea', 'soda water']) expect(isCalorieFree(name)).toBe(true);
    for (const name of ['coconut water', 'milk tea', 'lassi', 'dal', 'watermelon', 'juice']) expect(isCalorieFree(name)).toBe(false);
  });
});
