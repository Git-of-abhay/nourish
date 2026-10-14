import React, { useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { confirmAction } from '../confirm';
import { localDate } from '../date';
import { estimateFromNames } from '../foodCatalog';
import { Meal, MealAnalysis } from '../types';
import { Button, Card, ErrorNote, styles, Subtle, Title } from '../ui';

type Photo = { uri: string; name: string; mimeType: string };

export function Meals({ token, meals, onChanged }: { token: string; meals: Meal[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [portion, setPortion] = useState('');
  const [kcal, setKcal] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choosePhoto(camera: boolean) {
    setError(null);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return setError('No camera access. You can pick from gallery or type it in.');
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      // Shrink the photo first so the upload is small and fast on any connection.
      const small = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
      setPhoto({ uri: small.uri, name: 'meal.jpg', mimeType: 'image/jpeg' });
      setAnalysis(null);
    } catch { setError('Couldn’t open that image. Try another or type it in.'); }
  }

  async function analyze() {
    if (!photo) return;
    setBusy(true); setError(null);
    try {
      const result = await api.analyzeMeal(token, photo);
      setAnalysis(result);
      if (result.foods.length) {
        setName(result.foods.join(' + '));
        const estimate = estimateFromNames(result.foods);
        if (estimate.kcal !== null) setKcal(String(estimate.kcal));
        if (estimate.portion) setPortion(estimate.portion);
      } else setError('Couldn’t spot the food. Add the details below.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t analyze that. You can still type it in.'); }
    finally { setBusy(false); }
  }

  async function save() {
    setError(null);
    const number = Number(kcal);
    if (!name.trim() || !portion.trim() || kcal.trim() === '' || !Number.isInteger(number) || number < 0 || number > 5000) {
      return setError('Add a name, portion and calories (0 to 5000).');
    }
    setBusy(true);
    try {
      await api.addMeal(token, { name: name.trim(), portion: portion.trim(), kcal: number, source: analysis ? 'photo_estimate' : 'manual', logged_on: localDate() });
      setName(''); setPortion(''); setKcal(''); setPhoto(null); setAnalysis(null);
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

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ paddingTop: 15, gap: 5 }}><Text style={styles.eyebrow}>FOOD</Text><Title>What did you eat?</Title><Subtle>Snap a photo or just type it in.</Subtle></View>
      <Card><Text style={styles.heading}>Start with a photo</Text><View style={styles.row}><View style={{ flex: 1 }}><Button title="Camera" variant="secondary" onPress={() => choosePhoto(true)} /></View><View style={{ flex: 1 }}><Button title="Gallery" variant="secondary" onPress={() => choosePhoto(false)} /></View></View>
        {photo && <><Image source={{ uri: photo.uri }} style={{ width: '100%', height: 180, borderRadius: 14 }} resizeMode="cover" /><Subtle>When you tap Analyze, your photo is shared with an open AI model (Groq) to spot the food and estimate calories. It isn’t saved.</Subtle><Button title={busy ? 'Analyzing' : 'Analyze'} disabled={busy} onPress={() => confirmAction('Share this photo?', 'It goes to an open AI model (Groq) for analysis and isn’t saved. You’ll review the estimate before anything is logged.', analyze, { cancel: 'Not now', ok: 'Share and analyze', destructive: false })} /></>}
        {analysis && <><Text style={styles.heading}>Looks like: {analysis.foods.join(', ') || 'not sure'}</Text><Subtle>{analysis.uncertainty}</Subtle><Subtle>Estimate ready. Check the portion and calories, then confirm to save.</Subtle></>}
      </Card>
      <Card><Text style={styles.heading}>Meal details</Text>
        <TextInput accessibilityLabel="Food name" style={styles.input} placeholder="Food name" value={name} maxLength={100} onChangeText={setName} />
        <TextInput accessibilityLabel="Portion" style={styles.input} placeholder="Portion, e.g. 1 cup" value={portion} maxLength={80} onChangeText={setPortion} />
        <TextInput accessibilityLabel="Estimated calories" style={styles.input} placeholder="Approx. calories" keyboardType="number-pad" value={kcal} onChangeText={setKcal} />
        <Subtle>Calories are just estimates.</Subtle><ErrorNote message={error} />
        <Button title={busy ? 'Saving' : 'Save meal'} disabled={busy} onPress={save} />
      </Card>
      <Text style={styles.heading}>Recent</Text>
      {meals.length === 0 ? <Card><Subtle>Nothing yet. A snack counts too.</Subtle></Card> : meals.map(meal => <Card key={meal.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.heading}>{meal.name}</Text><Subtle>{meal.portion} on {meal.logged_on}</Subtle><Subtle>About {meal.kcal} kcal</Subtle></View><Button title="Delete" variant="quiet" onPress={() => confirmDelete(meal)} /></View></Card>)}
    </ScrollView>
  </KeyboardAvoidingView>;
}
