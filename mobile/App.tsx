import React, { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { api, ApiError, guestStore } from './src/api';
import { localDate } from './src/date';
import { refreshReminder } from './src/notifications';
import { Assistant } from './src/screens/Assistant';
import { Meals } from './src/screens/Meals';
import { Move } from './src/screens/Move';
import { Onboarding } from './src/screens/Onboarding';
import { Overview } from './src/screens/Overview';
import { Reports } from './src/screens/Reports';
import { Today } from './src/screens/Today';
import { Dashboard, GuestInput } from './src/types';
import { Button, colors, ErrorNote, styles } from './src/ui';

type Tab = 'Home' | 'Overview' | 'Assistant' | 'Meals' | 'Move' | 'Reports' | 'Profile';
const tabs: { name: Tab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'Home', icon: 'home-outline' }, { name: 'Meals', icon: 'restaurant-outline' }, { name: 'Overview', icon: 'grid-outline' }, { name: 'Assistant', icon: 'chatbubble-ellipses-outline' }, { name: 'Move', icon: 'walk-outline' },
];
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>('Home');
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (guestToken: string) => {
    try { const result = await api.dashboard(guestToken, localDate()); setData(result); setError(null); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) { await guestStore.clear(); setToken(null); setData(null); }
      else setError(e instanceof Error ? e.message : 'Couldn’t load your day.');
      throw e;
    }
  }, []);
  useEffect(() => { (async () => {
    try { const saved = await guestStore.get(); if (saved) { setToken(saved); await load(saved).catch(() => {}); } }
    finally { setStarting(false); }
  })(); }, [load]);
  async function finishOnboarding(input: GuestInput) {
    const result = await api.createGuest(input); await guestStore.set(result.token);
    setStarting(true); setToken(result.token);
    try { await load(result.token); } catch { /* the retry screen handles it */ } finally { setStarting(false); }
    refreshReminder(input.reminder).catch(() => {});
  }
  async function saveProfile(input: GuestInput) {
    if (!token) return;
    await api.updateProfile(token, input); await load(token); setTab('Home'); refreshReminder(input.reminder).catch(() => {});
  }
  async function refresh() { if (token) await load(token); }
  if (starting) return <SafeAreaView style={[styles.screen, s.center]}><StatusBar barStyle="dark-content" /><Image source={require('./assets/icon.png')} style={{ width: 96, height: 96, borderRadius: 28 }} /><ActivityIndicator size="small" color={colors.blue} /><Text style={styles.subtle}>Getting your day ready</Text></SafeAreaView>;
  if (!token) return <SafeAreaView style={styles.screen}><StatusBar barStyle="dark-content" /><Onboarding onDone={finishOnboarding} /></SafeAreaView>;
  if (!data) return <SafeAreaView style={[styles.screen, s.center]}><StatusBar barStyle="dark-content" /><Text style={styles.heading}>Your day is waiting for you</Text><ErrorNote message={error} /><Button title="Try again" onPress={() => load(token).catch(() => {})} /></SafeAreaView>;
  return <SafeAreaView style={styles.screen}><StatusBar barStyle="dark-content" backgroundColor={colors.background} />
    {error && <View style={{ paddingHorizontal: 14 }}><ErrorNote message={error} /></View>}
    <View style={{ flex: 1 }}>
      {tab === 'Home' && <Today data={data} onLog={() => setTab('Meals')} onMove={() => setTab('Move')} onReports={() => setTab('Reports')} onAssistant={() => setTab('Assistant')} onOverview={() => setTab('Overview')} onProfile={() => setTab('Profile')} />}
      {tab === 'Overview' && <Overview data={data} onMeals={() => setTab('Meals')} onMove={() => setTab('Move')} onReports={() => setTab('Reports')} />}
      {tab === 'Assistant' && <Assistant token={token} data={data} onReports={() => setTab('Reports')} onMove={() => setTab('Move')} />}
      {tab === 'Meals' && <Meals token={token} meals={data.meals} onChanged={refresh} />}
      {tab === 'Move' && <Move token={token} data={data} onChanged={refresh} />}
      {tab === 'Reports' && <><Pressable accessibilityRole="button" onPress={() => setTab('Overview')} style={s.back}><Ionicons name="arrow-back" size={19} color={colors.blue} /><Text style={s.backText}>Overview</Text></Pressable><Reports token={token} data={data} onChanged={refresh} /></>}
      {tab === 'Profile' && <Onboarding initial={data.profile} onDone={saveProfile} onCancel={() => setTab('Home')} />}
    </View>
    {tab !== 'Profile' && <View style={s.nav}>{tabs.map(item => {
      const active = tab === item.name || tab === 'Reports' && item.name === 'Overview';
      return <Pressable key={item.name} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => { setError(null); setTab(item.name); }} style={[s.navItem, active && s.navSelected]}><Ionicons name={active ? ({ Home: 'home', Meals: 'restaurant', Overview: 'grid', Assistant: 'chatbubble-ellipses', Move: 'walk' } as Record<string, keyof typeof Ionicons.glyphMap>)[item.name] : item.icon} size={19} color={active ? '#FFFFFF' : colors.muted} /><Text style={[s.navText, active && s.navTextSelected]}>{item.name}</Text></Pressable>;
    })}</View>}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  nav: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 7, paddingVertical: 7, marginHorizontal: 14, marginBottom: 8, borderRadius: 25, shadowColor: '#B08068', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 15, gap: 3 }, navSelected: { backgroundColor: colors.green },
  navText: { color: colors.muted, fontSize: 10, fontWeight: '700' }, navTextSelected: { color: '#FFFFFF' },
  back: { paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', gap: 7, alignItems: 'center' }, backText: { color: colors.blue, fontWeight: '700', fontSize: 13 },
});
