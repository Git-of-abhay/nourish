import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { Sheet } from '../components';
import { confirmAction } from '../confirm';
import { localDate } from '../date';
import { estimateFromNames } from '../foodCatalog';
import { Meal, MealSource } from '../types';
import { VoiceRecorder } from '../VoiceRecorder';
import { Button, Card, colors, ErrorNote, styles, Subtle, Title } from '../ui';

type Mode = 'voice' | 'photo' | 'type';
type Photo = { uri: string; name: string; mimeType: string };

const SOURCE_LABEL: Record<MealSource, string> = { manual: 'Typed', photo_estimate: 'Photo', voice_estimate: 'Voice' };

export function Meals({ token, meals, onChanged }: { token: string; meals: Meal[]; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [name, setName] = useState('');
  const [portion, setPortion] = useState('');
  const [kcal, setKcal] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [source, setSource] = useState<MealSource>('manual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(''); setPortion(''); setKcal(''); setPhoto(null); setVoiceUri(null); setHeard(null); setNote(null); setSource('manual'); setError(null);
  }
  function close() { setMode(null); reset(); }
  function open(next: Mode) { reset(); setMode(next); }

  async function choosePhoto(camera: boolean) {
    reset();
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setMode('type'); return setError('No camera access. You can pick from gallery or type it in.'); }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
      if (result.canceled || !result.assets[0]) return;
      // Shrink the photo first so the upload is small and fast on any connection.
      const small = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
      setPhoto({ uri: small.uri, name: 'meal.jpg', mimeType: 'image/jpeg' });
      setMode('photo');
    } catch { setMode('type'); setError('Couldn’t open that image. Try another or type it in.'); }
  }

  function fill(foods: string[], from: MealSource) {
    setSource(from);
    if (!foods.length) return setError('Couldn’t spot any food. Add the details below.');
    setName(foods.join(' + '));
    const estimate = estimateFromNames(foods);
    if (estimate.kcal !== null) setKcal(String(estimate.kcal));
    if (estimate.portion) setPortion(estimate.portion);
  }

  async function analyzePhoto() {
    if (!photo) return;
    setBusy(true); setError(null);
    try {
      const result = await api.analyzeMeal(token, photo);
      setNote(result.uncertainty);
      fill(result.foods, 'photo_estimate');
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t analyze that. You can still type it in.'); }
    finally { setBusy(false); }
  }

  async function analyzeVoice() {
    if (!voiceUri) return;
    setBusy(true); setError(null);
    try {
      const result = await api.analyzeVoice(token, { uri: voiceUri });
      setHeard(result.transcript); setNote(result.uncertainty);
      fill(result.foods, 'voice_estimate');
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t analyze that. You can still type it in.'); }
    finally { setBusy(false); }
  }

  const share = (what: string, run: () => void) => confirmAction('Share this ' + what + '?', 'It goes to an open AI model (Groq) for analysis and isn’t saved. You’ll review the estimate before anything is logged.', run, { cancel: 'Not now', ok: 'Share and analyze', destructive: false });

  async function save() {
    setError(null);
    const number = Number(kcal);
    if (!name.trim() || !portion.trim() || kcal.trim() === '' || !Number.isInteger(number) || number < 0 || number > 5000) {
      return setError('Add a name, portion and calories (0 to 5000).');
    }
    setBusy(true);
    try {
      await api.addMeal(token, { name: name.trim(), portion: portion.trim(), kcal: number, source, logged_on: localDate() });
      close();
      await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t save that.'); }
    finally { setBusy(false); }
  }

  function confirmDelete(meal: Meal) {
    confirmAction('Delete this?', meal.name, async () => {
      try { await api.deleteMeal(token, meal.id); await onChanged(); }
      catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t delete that.'); }
    });
  }

  const tiles: { icon: keyof typeof Ionicons.glyphMap; label: string; run: () => void }[] = [
    { icon: 'mic-outline', label: 'Voice', run: () => open('voice') },
    { icon: 'camera-outline', label: 'Camera', run: () => choosePhoto(true) },
    { icon: 'images-outline', label: 'Gallery', run: () => choosePhoto(false) },
    { icon: 'create-outline', label: 'Type', run: () => open('type') },
  ];

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ paddingTop: 15, gap: 5 }}><Text style={styles.eyebrow}>FOOD</Text><Title>What did you eat?</Title><Subtle>Say it, snap it or type it. Whatever is quickest.</Subtle></View>
      <View style={s.tiles}>{tiles.map(tile => <Pressable key={tile.label} accessibilityRole="button" accessibilityLabel={tile.label} onPress={tile.run} style={s.tile}><View style={s.tileIcon}><Ionicons name={tile.icon} size={26} color={colors.blue} /></View><Text style={s.tileLabel}>{tile.label}</Text></Pressable>)}</View>
      <Text style={styles.heading}>Recent</Text>
      {meals.length === 0 ? <Card><Subtle>Nothing yet. A snack counts too.</Subtle></Card> : meals.map(meal => <Card key={meal.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.heading}>{meal.name}</Text><Subtle>{meal.portion} on {meal.logged_on}</Subtle><Subtle>About {meal.kcal} kcal, {SOURCE_LABEL[meal.source]}</Subtle></View><Button title="Delete" variant="quiet" onPress={() => confirmDelete(meal)} /></View></Card>)}
    </ScrollView>

    <Sheet visible={mode !== null} title={mode === 'voice' ? 'Tell me what you ate' : mode === 'photo' ? 'Your photo' : 'Add a meal'} onClose={close}>
      {mode === 'voice' && <>
        <VoiceRecorder onRecorded={uri => { setVoiceUri(uri); setHeard(null); setError(null); }} onError={setError} />
        {voiceUri && <><Subtle>Your recording is shared with an open AI model (Groq) to turn it into text. It isn’t saved.</Subtle><Button title={busy ? 'Listening' : 'Analyze'} disabled={busy} onPress={() => share('recording', analyzeVoice)} /></>}
        {heard && <Card><Subtle>I heard</Subtle><Text style={styles.body}>“{heard}”</Text></Card>}
      </>}
      {mode === 'photo' && photo && <>
        <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 190, borderRadius: 16 }} resizeMode="cover" />
        <Subtle>When you tap Analyze, your photo is shared with an open AI model (Groq) to spot the food. It isn’t saved.</Subtle>
        <Button title={busy ? 'Analyzing' : 'Analyze'} disabled={busy} onPress={() => share('photo', analyzePhoto)} />
      </>}
      {note && <Subtle>{note} Estimate ready, check the portion and calories, then confirm to save.</Subtle>}
      <TextInput accessibilityLabel="Food name" style={styles.input} placeholder="Food name" placeholderTextColor={colors.muted} value={name} maxLength={100} onChangeText={setName} />
      <TextInput accessibilityLabel="Portion" style={styles.input} placeholder="Portion, e.g. 1 cup" placeholderTextColor={colors.muted} value={portion} maxLength={80} onChangeText={setPortion} />
      <TextInput accessibilityLabel="Estimated calories" style={styles.input} placeholder="Approx. calories" placeholderTextColor={colors.muted} keyboardType="number-pad" value={kcal} onChangeText={setKcal} />
      <Subtle>Calories are just estimates.</Subtle>
      <ErrorNote message={error} />
      <Button title={busy ? 'Saving' : 'Save meal'} disabled={busy} onPress={save} />
    </Sheet>
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.line },
  tileIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.paleGreen, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { color: colors.ink, fontWeight: '700', fontSize: 13 },
});
