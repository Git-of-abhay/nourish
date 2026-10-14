import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const colors = {
  background: '#FFF7F4', paper: '#FFFFFF', ink: '#4A2C3A', muted: '#94798A',
  green: '#F6B1C3', paleGreen: '#FDE6EE', peach: '#FFF0E5', line: '#F5DDE6', red: '#C7526B',
  purple: '#B48FD4', teal: '#6FA384', blue: '#C75B86', sky: '#FFE0E9',
};

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) { return <Text style={styles.title}>{children}</Text>; }
export function Subtle({ children }: { children: React.ReactNode }) { return <Text style={styles.subtle}>{children}</Text>; }

export function Button({ title, onPress, disabled, variant = 'primary' }: { title: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, variant === 'secondary' && styles.secondary, variant === 'quiet' && styles.quiet, disabled && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}>
    <Text style={[styles.buttonText, variant !== 'primary' && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

export function Choice({ title, selected, onPress, subtitle }: { title: string; selected: boolean; onPress: () => void; subtitle?: string }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
    <View style={{ flex: 1 }}><Text style={styles.choiceTitle}>{title}</Text>{subtitle ? <Text style={styles.subtle}>{subtitle}</Text> : null}</View>
    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? colors.blue : colors.line} />
  </Pressable>;
}

export function ErrorNote({ message }: { message: string | null }) { return message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null; }

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 114, gap: 14, width: '100%', maxWidth: 620, alignSelf: 'center' },
  card: { backgroundColor: colors.paper, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#FFF9FA', gap: 10, shadowColor: '#DDB7C3', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.17, shadowRadius: 18, elevation: 3 },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '800', color: colors.ink, letterSpacing: -0.7 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  subtle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  eyebrow: { color: colors.blue, fontWeight: '800', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  button: { backgroundColor: colors.green, borderRadius: 18, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, shadowColor: '#DDB7C3', shadowOpacity: 0.18, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
  buttonText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  secondary: { backgroundColor: colors.paleGreen, shadowOpacity: 0 },
  quiet: { backgroundColor: 'transparent', shadowOpacity: 0 },
  secondaryText: { color: colors.blue },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.paper, padding: 16, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 8 },
  choiceSelected: { borderColor: colors.green, backgroundColor: colors.paleGreen, borderWidth: 2 },
  choiceTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  radio: { color: colors.blue, fontSize: 23 },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 16, minHeight: 50, fontSize: 16, color: colors.ink },
  error: { color: colors.red, backgroundColor: '#FCEBE8', borderRadius: 12, padding: 12, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
