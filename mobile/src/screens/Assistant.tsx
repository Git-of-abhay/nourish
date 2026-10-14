import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { localDate } from '../date';
import { ChatMessage, Dashboard } from '../types';
import { colors, ErrorNote, Logo, styles } from '../ui';

const suggestions = ['How’s my day going?', 'What did I eat?', 'How are my numbers?'];
export function Assistant({ token, data, onReports, onMove }: { token: string; data: Dashboard; onReports: () => void; onMove: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const pendingId = useRef(0);
  useEffect(() => { api.chatMessages(token).then(setMessages).catch(e => setError(e instanceof Error ? e.message : 'Could not load the conversation.')); }, [token]);
  async function send(value = draft) {
    const question = value.trim();
    if (!question || busy) return;
    setDraft(''); setError(null); setBusy(true);
    pendingId.current += 1;
    const current = { id: 'pending-' + pendingId.current, role: 'user' as const, content: question, created_at: '' };
    setMessages(old => [...old, current]);
    try { await api.askAssistant(token, question, localDate()); setMessages(await api.chatMessages(token)); }
    catch (e) { setMessages(old => old.filter(item => item.id !== current.id)); setDraft(question); setError(e instanceof Error ? e.message : 'Could not send your message.'); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={a.header}><View style={a.orb}><Logo size={34} /></View><Text style={a.title}>Chat with Nourish</Text><Text style={a.subtitle}>Ask me anything</Text></View>
    <ScrollView ref={scroll} style={a.scroll} contentContainerStyle={a.messages} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
      <View style={a.bubble}><Text style={a.bubbleText}>Hey{data.profile.name ? ' ' + data.profile.name.split(' ')[0] : ''}! {data.insight.suggestion}</Text><Text style={a.time}>NOURISH</Text></View>
      {messages.map(item => <View key={item.id} style={[a.bubble, item.role === 'user' && a.userBubble]}><Text style={[a.bubbleText, item.role === 'user' && a.userText]}>{item.content}</Text><Text style={[a.time, item.role === 'user' && a.userTime]}>{item.role === 'user' ? 'YOU' : 'NOURISH'}</Text></View>)}
      {busy && <View style={a.bubble}><Text style={a.bubbleText}>One sec</Text></View>}
      {messages.length === 0 && <View style={a.quick}>{suggestions.map(question => <Pressable key={question} accessibilityRole="button" onPress={() => send(question)} style={a.chip}><Text style={a.chipText}>{question}</Text></Pressable>)}</View>}
      <View style={a.quick}><Pressable accessibilityRole="button" onPress={onMove} style={a.chip}><Text style={a.chipText}>Move a bit</Text></Pressable><Pressable accessibilityRole="button" onPress={onReports} style={a.chip}><Text style={a.chipText}>My reports</Text></Pressable></View>
    </ScrollView>
    <ErrorNote message={error} />
    <View style={a.composer}><TextInput accessibilityLabel="Message Nourish" placeholder="Ask about your day" placeholderTextColor={colors.muted} value={draft} onChangeText={setDraft} maxLength={300} style={a.input} onSubmitEditing={() => send()} returnKeyType="send" /><Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!draft.trim() || busy} onPress={() => send()} style={[a.send, (!draft.trim() || busy) && { opacity: 0.45 }]}><Ionicons name="arrow-up" color="#FFFFFF" size={20} /></Pressable></View>
    <Text style={a.disclaimer}>Not medical advice, ask your doctor for that</Text>
  </KeyboardAvoidingView>;
}
const a = StyleSheet.create({
  header: { backgroundColor: colors.green, paddingTop: 24, paddingBottom: 20, alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }, orb: { width: 54, height: 54, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 7 }, title: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' }, subtitle: { color: '#FFE3E8', fontSize: 11, marginTop: 3 },
  scroll: { flex: 1 }, messages: { padding: 18, gap: 14, paddingBottom: 28 }, bubble: { alignSelf: 'flex-start', maxWidth: '84%', backgroundColor: '#FFFFFF', padding: 13, borderRadius: 17, borderTopLeftRadius: 5, shadowColor: '#B08068', shadowOpacity: 0.2, shadowRadius: 8 }, userBubble: { alignSelf: 'flex-end', backgroundColor: colors.green, borderTopLeftRadius: 17, borderTopRightRadius: 5 }, bubbleText: { color: colors.ink, fontSize: 13, lineHeight: 19 }, userText: { color: '#FFFFFF' }, time: { color: '#B6A7B1', fontSize: 9, textAlign: 'right', marginTop: 7 }, userTime: { color: '#FFE3E8' },
  quick: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' }, chip: { borderRadius: 16, backgroundColor: '#FDE3E7', paddingHorizontal: 11, paddingVertical: 9 }, chipText: { color: colors.blue, fontSize: 11, fontWeight: '700' },
  composer: { flexDirection: 'row', gap: 9, paddingHorizontal: 14, paddingTop: 9, backgroundColor: '#FFFFFF', alignItems: 'center' }, input: { flex: 1, minHeight: 44, borderRadius: 22, backgroundColor: '#FFF8F1', paddingHorizontal: 15, color: colors.ink, fontSize: 13 }, send: { height: 40, width: 40, borderRadius: 20, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, disclaimer: { color: colors.muted, backgroundColor: '#FFFFFF', textAlign: 'center', fontSize: 9, paddingVertical: 8 },
});
