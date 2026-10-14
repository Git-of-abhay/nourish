import { describe, expect, it } from 'vitest';
import { describeTrend, newlyEarned, percent } from '../progress';
import type { Badge, MetricTrend } from '../types';

const badge = (id: string, earned: boolean): Badge => ({ id, title: id, detail: '', earned });

describe('newlyEarned', () => {
  it('returns only earned badges that were not seen', () => {
    const result = newlyEarned([badge('a', true), badge('b', true), badge('c', false)], ['a']);
    expect(result.map(b => b.id)).toEqual(['b']);
  });
  it('is empty when nothing new', () => {
    expect(newlyEarned([badge('a', true)], ['a'])).toEqual([]);
  });
});

describe('percent', () => {
  it('clamps between 0 and 100', () => {
    expect(percent(50, 100)).toBe(50);
    expect(percent(250, 100)).toBe(100);
    expect(percent(-5, 100)).toBe(0);
  });
  it('handles a zero target', () => {
    expect(percent(10, 0)).toBe(0);
  });
});

const trend = (over: Partial<MetricTrend>): MetricTrend => ({
  key: 'glucose', label: 'Glucose', unit: 'mg/dL',
  latest: { value: 105, measured_on: '2026-10-01', reference: '70-99', status: 'above' },
  previous: { value: 90, measured_on: '2026-08-01' }, direction: 'up', series: [90, 105], why: null, goal_tip: null, ...over,
});

describe('describeTrend', () => {
  it('describes a rise without judging it', () => {
    const text = describeTrend(trend({}));
    expect(text.status).toBe('Above range');
    expect(text.change).toContain('Up from 90 mg/dL');
  });
  it('handles a first reading and a steady value', () => {
    expect(describeTrend(trend({ previous: null, direction: 'new' })).change).toBe('First reading');
    expect(describeTrend(trend({ direction: 'same', latest: { value: 90, measured_on: '2026-10-01', reference: '', status: 'unknown' } })).change).toContain('About the same');
  });
});
