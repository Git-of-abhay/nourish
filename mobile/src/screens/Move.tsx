import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { confirmAction } from '../confirm';
import { localDate } from '../date';
import { readTodaySteps, StepResult } from '../healthConnect';
import { Dashboard, Workout } from '../types';
import { Button, Card, Choice, ErrorNote, styles, Subtle, Title } from '../ui';

const activities = [
  { value: 'walk', label: 'Walk' }, { value: 'stretch', label: 'Stretch' }, { value: 'yoga', label: 'Yoga' },
  { value: 'strength', label: 'Strength' }, { value: 'other', label: 'Other' },
];

export function Move({ token, data, onChanged }: { token: string; data: Dashboard; onChanged: () => Promise<void> }) {
  const [activity, setActivity] = useState('walk');
  const [minutes, setMinutes] = useState('10');
  const [steps, setSteps] = useState<StepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function log(activityValue = activity, duration = minutes) {
    const n = Number(duration);
    if (!Number.isInteger(n) || n < 1 || n > 300) return setError('Pick between 1 and 300 minutes.');
    setBusy(true); setError(null);
    try {
      await api.addWorkout(token, { activity: activityValue, minutes: n, logged_on: localDate() });
      await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t save that.'); }
    finally { setBusy(false); }
  }

  async function connect() {
    setBusy(true); setError(null);
    const result = await readTodaySteps();
    setSteps(result);
    setBusy(false);
  }

  function confirmDelete(workout: Workout) {
    confirmAction('Remove this?', workout.activity + ' for ' + workout.minutes + ' minutes', async () => {
        try { await api.deleteWorkout(token, workout.id); await onChanged(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t remove that.'); }
    });
  }

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={{ paddingTop: 15, gap: 5 }}><Text style={styles.eyebrow}>MOVE</Text><Title>{data.activity_plan.headline}</Title><Subtle>Ideas based on where you’re starting. Make them yours.</Subtle></View>
    <Card><Text style={styles.heading}>A small next step</Text>{data.activity_plan.ideas.map(idea => <View key={idea.label} style={[styles.row, { paddingVertical: 7 }]}><View style={{ flex: 1 }}><Text style={styles.body}>{idea.label}</Text><Subtle>{idea.minutes} minutes</Subtle></View><Button title="Add" variant="secondary" disabled={busy} onPress={() => log(idea.activity, String(idea.minutes))} /></View>)}<Subtle>{data.activity_plan.note}</Subtle></Card>
    <Card><Text style={styles.heading}>Add your own</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{activities.map(item => <View key={item.value} style={{ width: '48%' }}><Choice title={item.label} selected={activity === item.value} onPress={() => setActivity(item.value)} /></View>)}</View><TextInput accessibilityLabel="Minutes" style={styles.input} keyboardType="number-pad" value={minutes} onChangeText={setMinutes} placeholder="Minutes" /><Button title={busy ? 'Saving' : 'Save'} disabled={busy} onPress={() => log()} /></Card>
    <Card><Text style={styles.heading}>Steps</Text><Subtle>Optional. I’ll read today’s steps from Health Connect on your phone.</Subtle><Button title={busy ? 'Connecting' : 'Connect steps'} disabled={busy} variant="secondary" onPress={connect} />{steps?.status === 'connected' ? <Text style={styles.heading}>{steps.count.toLocaleString()} steps today</Text> : steps ? <Subtle>{steps.message}</Subtle> : null}</Card>
    <ErrorNote message={error} />
    <Text style={styles.heading}>History</Text>
    {data.workouts.length === 0 ? <Card><Subtle>Nothing yet. Start small if you like.</Subtle></Card> : data.workouts.map(workout => <Card key={workout.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.heading}>{workout.activity.charAt(0).toUpperCase() + workout.activity.slice(1)}</Text><Subtle>{workout.minutes} minutes on {workout.logged_on}</Subtle></View><Button title="Remove" variant="quiet" onPress={() => confirmDelete(workout)} /></View></Card>)}
  </ScrollView>;
}
