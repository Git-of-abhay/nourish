import { Badge, MetricTrend } from './types';

/** Badges earned now that the user has not been told about yet. */
export function newlyEarned(badges: Badge[], seen: string[]): Badge[] {
  return badges.filter(badge => badge.earned && !seen.includes(badge.id));
}

export function percent(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

const STATUS_LABEL = { above: 'Above range', below: 'Below range', within: 'In range', unknown: 'No range' } as const;

/** Plain wording for a tracked value, without judging whether the change is good or bad. */
export function describeTrend(trend: MetricTrend): { status: string; change: string } {
  const { latest, previous, direction } = trend;
  let change = 'First reading';
  if (previous) {
    const unit = trend.unit ? ' ' + trend.unit : '';
    const since = new Date(previous.measured_on + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    change = direction === 'same' ? `About the same as ${previous.value}${unit} on ${since}` : `${direction === 'up' ? 'Up' : 'Down'} from ${previous.value}${unit} on ${since}`;
  }
  return { status: STATUS_LABEL[latest.status], change };
}
