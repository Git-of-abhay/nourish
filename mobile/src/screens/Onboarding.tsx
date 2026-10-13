import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { updateReminder } from '../notifications';
import { goals, levels, obstacles, reminders } from '../options';
import { ActivityLevel, Goal, GuestInput, Obstacle, Profile, Reminder } from '../types';
import { Button, Choice, colors, ErrorNote, styles, Subtle, Title } from '../ui';

export function Onboarding({ onDone, initial, onCancel }: { onDone: (input: GuestInput) => Promise<void>; initial?: Profile; onCancel?: () => void }) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(initial?.goal || null);
  const [obstacle, setObstacle] = useState<Obstacle | null>(initial?.obstacle || null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(initial?.activity_level || null);
  const [reminder, setReminder] = useState<Reminder>(initial?.reminder || 'off');
  const [name, setName] = useState(initial?.name || '');
  const [target, setTarget] = useState(initial?.target_kcal ? String(initial.target_kcal) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function next() {
    setError(null);
    if (step === 0 && !goal) return setError('Pick a goal first.');
    if (step === 0 && goal === 'calorie_awareness') {
      const n = Number(target);
      if (!Number.isInteger(n) || n < 500 || n > 6000) return setError('Pick a target between 500 and 6000 kcal, or choose another goal.');
    }
    if (step === 1 && !obstacle) return setError('Pick one first.');
    if (step === 2 && !activityLevel) return setError('Pick one first.');
    if (step < 3) return setStep(step + 1);
    if (!goal || !obstacle || !activityLevel) return;
    setBusy(true);
    try {
      await onDone({ name: name.trim(), goal, obstacle, reminder, activity_level: activityLevel, target_kcal: goal === 'calorie_awareness' ? Number(target) : null });
      if (reminder !== 'off') await updateReminder(reminder);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t finish. Try again.');
    } finally { setBusy(false); }
  }

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ paddingTop: 30, gap: 7 }}><Text style={styles.eyebrow}>STEP {step + 1} OF 4</Text><Title>{[
        'What would you like help with?', 'What tends to get in your way?', 'Where are you starting with movement?', 'How should I check in?'
      ][step]}</Title><Subtle>A few quick questions so I get to know you.</Subtle></View>
      {step === 0 && <>
        {goals.map(item => <Choice key={item.value} title={item.title} subtitle={item.detail} selected={goal === item.value} onPress={() => setGoal(item.value)} />)}
        {goal === 'calorie_awareness' && <View style={{ gap: 6 }}><Text style={styles.heading}>Your daily target</Text><Subtle>Use a target you already follow. I won’t set one for you.</Subtle><TextInput style={styles.input} keyboardType="number-pad" placeholder="e.g. 2000 kcal" value={target} onChangeText={setTarget} /></View>}
      </>}
      {step === 1 && obstacles.map(item => <Choice key={item.value} title={item.title} selected={obstacle === item.value} onPress={() => setObstacle(item.value)} />)}
      {step === 2 && levels.map(item => <Choice key={item.value} title={item.title} subtitle={item.detail} selected={activityLevel === item.value} onPress={() => setActivityLevel(item.value)} />)}
      {step === 3 && <>
        {reminders.map(item => <Choice key={item.value} title={item.title} selected={reminder === item.value} onPress={() => setReminder(item.value)} />)}
        <View style={{ gap: 6 }}><Text style={styles.heading}>What should I call you?</Text><TextInput style={styles.input} autoCapitalize="words" maxLength={40} placeholder="Your name" value={name} onChangeText={setName} /></View>
        <Subtle>No sign up needed. Your data stays on this install.</Subtle>
      </>}
      <ErrorNote message={error} />
      <Button title={busy ? 'Saving' : step === 3 ? initial ? 'Save my preferences' : 'Start my day' : 'Continue'} disabled={busy} onPress={next} />
      {step > 0 && <Button title="Back" variant="quiet" disabled={busy} onPress={() => { setError(null); setStep(step - 1); }} />}
      {onCancel && <Button title="Cancel" variant="quiet" disabled={busy} onPress={onCancel} />}
      <View style={{ height: 16, backgroundColor: colors.paleGreen, borderRadius: 8, overflow: 'hidden' }}><View style={{ width: `${(step + 1) * 25}%`, height: 16, backgroundColor: colors.green }} /></View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
