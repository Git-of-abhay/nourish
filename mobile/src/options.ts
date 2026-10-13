import { ActivityLevel, Goal, Obstacle, Reminder } from './types';

export const goals: { value: Goal; title: string; detail: string }[] = [
  { value: 'eat_consistently', title: 'Build a steady meal routine', detail: 'Notice when and how I eat.' },
  { value: 'calorie_awareness', title: 'Understand my calorie target', detail: 'Track meals against a target I choose.' },
  { value: 'move_more', title: 'Move more often', detail: 'Start with activity that fits my day.' },
  { value: 'feel_better', title: 'Feel more balanced', detail: 'Check in with food and movement.' },
];
export const obstacles: { value: Obstacle; title: string }[] = [
  { value: 'forget', title: 'I forget to check in' }, { value: 'changing_routine', title: 'My routine changes' },
  { value: 'portion_size', title: 'I am unsure about portions' }, { value: 'exploring', title: 'I am just exploring' },
];
export const levels: { value: ActivityLevel; title: string; detail: string }[] = [
  { value: 'beginner', title: 'Starting gently', detail: 'Short walks and easy stretches.' },
  { value: 'some_activity', title: 'Some activity already', detail: 'A little movement most weeks.' },
  { value: 'active', title: 'I am already active', detail: 'I want to maintain a rhythm.' },
];
export const reminders: { value: Reminder; title: string }[] = [
  { value: 'morning', title: 'A morning nudge' }, { value: 'evening', title: 'An evening check-in' }, { value: 'off', title: 'No reminders' },
];
