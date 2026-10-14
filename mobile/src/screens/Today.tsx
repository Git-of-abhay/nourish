import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Dashboard } from '../types';
import { greeting } from '../greetings';
import { Card, colors, styles } from '../ui';

type Props = { data: Dashboard; onLog: () => void; onMove: () => void; onReports: () => void; onAssistant: () => void; onOverview: () => void; onProfile: () => void };
function Action({ icon, title, subtitle, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.action}><View style={s.actionIcon}><Ionicons name={icon} size={22} color={colors.blue} /></View><Text style={s.actionTitle}>{title}</Text><Text style={s.actionSubtitle}>{subtitle}</Text></Pressable>;
}
export function Today({ data, onLog, onMove, onReports, onAssistant, onOverview, onProfile }: Props) {
  const { profile, insight } = data;
  const name = profile.name?.split(' ')[0] || 'there';
  const actions = Number(insight.today_meals > 0) + Number(insight.today_workout_minutes > 0);
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 0 }]}>
    <View style={s.hero}>
      <View style={s.topline}><View style={s.brand}><View style={s.orb}><Ionicons name="sparkles" size={18} color={colors.ink} /></View><Text style={s.brandText}>Nourish</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Edit your profile" onPress={onProfile} style={s.avatar}><Ionicons name="person-outline" size={18} color={colors.ink} /></Pressable></View>
      <Text style={s.greet}>Hey, {name} 👋</Text>
      <Text style={s.heroTitle}>{greeting()}</Text>
      <Pressable accessibilityRole="button" onPress={onAssistant} style={s.ask}><Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.muted} /><Text style={s.askText}>Chat with Nourish</Text><View style={s.askArrow}><Ionicons name="arrow-forward" size={17} color={colors.blue} /></View></Pressable>
    </View>
    <View style={s.actions}><Action icon="restaurant-outline" title="Food" subtitle="Add a meal" onPress={onLog} /><Action icon="document-text-outline" title="Reports" subtitle="See your results" onPress={onReports} /></View>
    <Card><Text style={s.sectionTitle}>Little wins today</Text><View style={s.rhythmBody}><View><Text style={s.rhythmValue}>{actions}<Text style={s.rhythmTotal}> /2</Text></Text><Text style={s.rhythmLabel}>little wins</Text></View><View style={s.circle}><Svg width={70} height={70}><Circle cx={35} cy={35} r={28} fill="none" stroke="#E6F3E9" strokeWidth={6} /><Circle cx={35} cy={35} r={28} fill="none" stroke={colors.teal} strokeWidth={6} strokeDasharray={String(actions * 88) + ' 176'} strokeLinecap="round" transform="rotate(-90 35 35)" /></Svg><Ionicons name="leaf-outline" size={25} color={colors.teal} style={s.circleHeart} /></View></View></Card>
    <Card><Pressable accessibilityRole="button" onPress={onOverview} style={styles.row}><Text style={s.sectionTitle}>Your day</Text><Text style={s.link}>See more</Text></Pressable><Text style={s.summary}>{insight.suggestion}</Text>
      <View style={s.statRow}><View style={[s.stat, { backgroundColor: '#FFF0F3' }]}><Ionicons name="restaurant-outline" size={18} color="#DE8BA1" /><Text style={s.statLabel}>Meals</Text><Text style={s.statValue}>{insight.today_meals}</Text></View><View style={[s.stat, { backgroundColor: '#E6F3E9' }]}><Ionicons name="walk-outline" size={18} color="#6FA384" /><Text style={s.statLabel}>Move</Text><Text style={s.statValue}>{insight.today_workout_minutes}m</Text></View><View style={[s.stat, { backgroundColor: '#FFF3D6' }]}><Ionicons name="flame-outline" size={18} color="#D2A03F" /><Text style={s.statLabel}>Food</Text><Text style={s.statValue}>~{insight.today_kcal}</Text></View></View>
    </Card>
    <Pressable accessibilityRole="button" onPress={onMove} style={s.prompt}><Ionicons name="sparkles-outline" color={colors.blue} size={20} /><Text style={s.promptText}>Feel like moving a bit?</Text><Ionicons name="arrow-forward" color={colors.blue} size={18} /></Pressable>
  </ScrollView>;
}
const s = StyleSheet.create({
  hero: { marginHorizontal: -20, paddingHorizontal: 20, paddingTop: 19, paddingBottom: 27, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, gap: 14, backgroundColor: colors.paleGreen },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { flexDirection: 'row', alignItems: 'center', gap: 8 }, brandText: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  orb: { height: 34, width: 34, borderRadius: 11, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' }, avatar: { height: 34, width: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  greet: { color: colors.blue, fontWeight: '700', fontSize: 13, marginTop: 4 }, heroTitle: { color: colors.ink, fontSize: 29, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8 },
  ask: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingLeft: 14, paddingRight: 8, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }, askText: { flex: 1, color: colors.muted, fontSize: 13 }, askArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FCE5EE', alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: -10 }, action: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, minHeight: 120, shadowColor: '#DDB7C3', shadowOpacity: 0.17, shadowRadius: 12, elevation: 2 }, actionIcon: { backgroundColor: '#FFF0F3', alignSelf: 'flex-start', borderRadius: 11, padding: 8, marginBottom: 8 }, actionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink }, actionSubtitle: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 3 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, rhythmBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rhythmValue: { color: colors.ink, fontSize: 32, fontWeight: '800' }, rhythmTotal: { color: colors.muted, fontSize: 14, fontWeight: '500' }, rhythmLabel: { color: colors.teal, fontWeight: '700', fontSize: 12 }, circle: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' }, circleHeart: { position: 'absolute' }, smallNote: { color: colors.muted, fontSize: 11 },
  link: { color: colors.blue, fontSize: 12, fontWeight: '700' }, summary: { color: colors.muted, fontSize: 12, lineHeight: 18 }, statRow: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, borderRadius: 14, padding: 10, minHeight: 80, gap: 4 }, statLabel: { color: colors.muted, fontSize: 10 }, statValue: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  prompt: { borderRadius: 16, backgroundColor: colors.paleGreen, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 10 }, promptText: { flex: 1, color: colors.ink, fontWeight: '700', fontSize: 13 },
});
