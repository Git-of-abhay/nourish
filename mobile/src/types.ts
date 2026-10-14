export type Goal = 'eat_consistently' | 'calorie_awareness' | 'move_more' | 'feel_better';
export type Obstacle = 'forget' | 'changing_routine' | 'portion_size' | 'exploring';
export type Reminder = 'off' | 'morning' | 'evening';
export type ActivityLevel = 'beginner' | 'some_activity' | 'active';

export type Profile = {
  id: string;
  name: string;
  goal: Goal;
  obstacle: Obstacle;
  reminder: Reminder;
  activity_level: ActivityLevel;
  target_kcal: number | null;
};

export type MealSource = 'manual' | 'photo_estimate' | 'voice_estimate';
export type Meal = { id: string; name: string; kcal: number; portion: string; source: MealSource; logged_on: string; logged_at: string };
export type Workout = { id: string; activity: string; minutes: number; logged_on: string; logged_at: string };
export type Metric = { name: string; value: string; unit: string; reference: string };
export type Report = { id: string; title: string; summary: string; metrics: Metric[]; created_at: string };
export type Insight = { today_kcal: number; today_meals: number; today_workout_minutes: number; suggestion: string; target_kcal: number | null };
export type Badge = { id: string; title: string; detail: string; earned: boolean };
export type Progress = { streak: number; streak_at_risk: boolean; best_streak: number; week: { date: string; active: boolean }[]; active_days_this_week: number; badges: Badge[] };
export type Focus = { title: string; why: string; progress: { label: string; value: number; target: number; unit: string } };
export type RangeStatus = 'below' | 'within' | 'above' | 'unknown';
export type MetricTrend = {
  key: string; label: string; unit: string;
  latest: { value: number; measured_on: string; reference: string; status: RangeStatus };
  previous: { value: number; measured_on: string } | null;
  direction: 'up' | 'down' | 'same' | 'new';
  series: number[]; why: string | null; goal_tip: string | null;
};
export type Dashboard = { profile: Profile; insight: Insight; activity_plan: { headline: string; ideas: { activity: string; minutes: number; label: string }[]; note: string }; focus: Focus; progress: Progress; meals: Meal[]; workouts: Workout[]; reports: Report[]; metric_trends: MetricTrend[] };
export type MealAnalysis = { foods: string[]; description: string; uncertainty: string };
export type VoiceAnalysis = MealAnalysis & { transcript: string };
export type ReportAnalysis = { title: string; summary: string; metrics: Metric[] };
export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string };

export type GuestInput = {
  name: string;
  goal: Goal;
  obstacle: Obstacle;
  reminder: Reminder;
  activity_level: ActivityLevel;
  target_kcal: number | null;
};
