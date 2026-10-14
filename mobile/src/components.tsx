import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { percent } from './progress';
import { colors } from './ui';

/** Bottom sheet on phones, centered dialog on wide screens. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return <Modal visible={visible} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
    <View style={[c.backdrop, wide && c.backdropWide]}>
      <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[c.sheet, wide && c.sheetWide, !wide && keyboard > 0 && { marginBottom: keyboard }]}>
        {!wide && <View style={c.grabber} />}
        <View style={c.sheetHead}><Text style={c.sheetTitle}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.muted} /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}

export function ProgressBar({ value, target }: { value: number; target: number }) {
  return <View style={c.track}><View style={[c.fill, { width: `${percent(value, target)}%` }]} /></View>;
}

export function Sparkline({ values, color = colors.green }: { values: number[]; color?: string }) {
  const width = 96, height = 30, pad = 4;
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => [pad + (i * (width - 2 * pad)) / (values.length - 1), height - pad - ((v - min) / span) * (height - 2 * pad)] as const);
  const last = points[points.length - 1];
  return <Svg width={width} height={height}>
    <Polyline points={points.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
  </Svg>;
}

/** Short celebration at the top of the screen, gone after a few seconds. */
export function Toast({ title, message, onDone }: { title: string; message: string; onDone: () => void }) {
  useEffect(() => { const timer = setTimeout(onDone, 4500); return () => clearTimeout(timer); }, [onDone]);
  return <Pressable accessibilityRole="alert" onPress={onDone} style={c.toast}>
    <View style={c.toastIcon}><Ionicons name="trophy" size={20} color="#FFFFFF" /></View>
    <View style={{ flex: 1 }}><Text style={c.toastTitle}>{title}</Text><Text style={c.toastMessage}>{message}</Text></View>
  </Pressable>;
}

const c = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(51,36,31,0.45)', justifyContent: 'flex-end' },
  backdropWide: { justifyContent: 'center', alignItems: 'center' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 10, maxHeight: '90%' },
  sheetWide: { width: 520, borderRadius: 28, paddingTop: 20 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.paleGreen, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.green },
  toast: { position: 'absolute', top: 44, left: 16, right: 16, maxWidth: 560, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, shadowColor: '#B08068', shadowOpacity: 0.25, shadowRadius: 14, elevation: 8, zIndex: 10 },
  toastIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  toastTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  toastMessage: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
