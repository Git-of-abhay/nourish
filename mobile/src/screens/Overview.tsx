import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Dashboard } from '../types';
import { Card, colors, styles } from '../ui';

export function Overview({ data, onMeals, onMove, onReports }: { data: Dashboard; onMeals: () => void; onMove: () => void; onReports: () => void }) {
  const { insight } = data;
  const week = Array.from({ length: 5 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - 1 + i); return date; });
  const latest = data.reports[0];
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={o.hero}><Text style={o.kicker}>TODAY</Text><Text style={o.title}>Your wellness</Text><Text style={o.caption}>Here’s what you’ve shared so far</Text></View>
    <View style={o.week}>{week.map((day, i) => <View key={i} style={[o.day, i === 1 && o.today]}><Text style={[o.dayName, i === 1 && o.todayText]}>{day.toLocaleDateString(undefined, { weekday: 'short' })}</Text><Text style={[o.dayNumber, i === 1 && o.todayText]}>{day.getDate()}</Text></View>)}</View>
    <View style={styles.row}><Text style={o.section}>Your check-in</Text><Text style={o.date}>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></View>
    <Pressable accessibilityRole="button" onPress={onMeals}><Card><View style={o.item}><View style={[o.icon, { backgroundColor: '#FFF0F3' }]}><Ionicons name="restaurant-outline" size={20} color="#D97798" /></View><View style={o.itemMain}><Text style={o.label}>Food</Text><Text style={o.value}>{insight.today_meals} <Text style={o.unit}>{insight.today_meals === 1 ? 'meal' : 'meals'}</Text></Text></View><Text style={o.link}>See</Text></View><Text style={o.note}>Around {insight.today_kcal} kcal logged</Text></Card></Pressable>
    <Pressable accessibilityRole="button" onPress={onMove}><Card><View style={o.item}><View style={[o.icon, { backgroundColor: '#E6F3E9' }]}><Ionicons name="walk-outline" size={20} color="#6FA384" /></View><View style={o.itemMain}><Text style={o.label}>Movement</Text><Text style={o.value}>{insight.today_workout_minutes} <Text style={o.unit}>minutes</Text></Text></View><Text style={o.link}>See</Text></View></Card></Pressable>
    {insight.target_kcal !== null && <Card><View style={o.item}><View style={[o.icon, { backgroundColor: '#FFF3D6' }]}><Ionicons name="flame-outline" size={20} color="#D2A03F" /></View><View style={o.itemMain}><Text style={o.label}>Your food target</Text><Text style={o.value}>{insight.target_kcal} <Text style={o.unit}>kcal a day</Text></Text></View></View><View style={o.track}><View style={[o.fill, { width: `${Math.min(100, insight.today_kcal / insight.target_kcal * 100)}%` }]} /></View><Text style={o.note}>Just an estimate. You can edit any meal.</Text></Card>}
    <Pressable accessibilityRole="button" onPress={onReports}><Card><View style={o.item}><View style={[o.icon, { backgroundColor: '#EFE6F7' }]}><Ionicons name="document-text-outline" size={20} color="#9B7FC0" /></View><View style={o.itemMain}><Text style={o.label}>Reports</Text><Text style={o.value}>{data.reports.length} <Text style={o.unit}>saved</Text></Text></View><Text style={o.link}>See</Text></View>{latest && <Text style={o.note}>{latest.title}</Text>}</Card></Pressable>
    <Card><Text style={o.section}>A little nudge</Text><Text style={o.note}>{insight.suggestion}</Text></Card>
  </ScrollView>;
}
const o = StyleSheet.create({
  hero: { marginHorizontal: -20, marginTop: -20, padding: 22, paddingTop: 34, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, backgroundColor: colors.paleGreen }, kicker: { fontSize: 10, color: colors.blue, fontWeight: '800', letterSpacing: 1 }, title: { fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: 4 }, caption: { color: colors.muted, fontSize: 13, marginTop: 5 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -20 }, day: { width: '18%', paddingVertical: 13, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center' }, today: { backgroundColor: colors.green }, dayName: { color: colors.muted, fontSize: 11 }, dayNumber: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 3 }, todayText: { color: colors.ink },
  section: { fontSize: 17, fontWeight: '800', color: colors.ink }, date: { color: colors.muted, fontSize: 12 }, item: { flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { height: 44, width: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, itemMain: { flex: 1 }, label: { color: colors.muted, fontSize: 12, fontWeight: '700' }, value: { color: colors.ink, fontSize: 21, fontWeight: '800', marginTop: 2 }, unit: { color: colors.muted, fontSize: 11, fontWeight: '500' }, link: { color: colors.blue, fontWeight: '700', fontSize: 12 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 }, track: { height: 7, borderRadius: 4, backgroundColor: '#FAE4EC' }, fill: { height: 7, borderRadius: 4, backgroundColor: colors.green },
});
