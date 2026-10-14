import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { requestRecordingPermissionsAsync, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './ui';

const MAX_SECONDS = 30;
const MIN_SECONDS = 1;
const STOP_TIMEOUT_MS = 4000;

const withTimeout = <T,>(promise: Promise<T>, ms: number) => Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

/** Tap to start, tap to stop. It can never get stuck: every path ends back at "ready". */
export function VoiceRecorder({ disabled, onRecorded, onError }: { disabled?: boolean; onRecorded: (uri: string) => void; onError: (message: string) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const active = useRef(false);

  function clearTimer() { if (timer.current) clearInterval(timer.current); timer.current = null; }

  async function stop(discard = false) {
    if (!active.current) return;
    active.current = false;
    clearTimer();
    const length = seconds;
    setRecording(false);
    try {
      await withTimeout(recorder.stop(), STOP_TIMEOUT_MS);
      if (discard) return;
      if (length < MIN_SECONDS) return onError('That was too short. Hold on a little longer and tell me what you ate.');
      if (recorder.uri) onRecorded(recorder.uri); else onError('Nothing was recorded. Try again.');
    } catch { if (!discard) onError('Couldn’t finish that recording. Please try again.'); }
  }

  async function start() {
    if (active.current || disabled) return;
    active.current = true;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) { active.current = false; return onError('No microphone access. You can allow it in settings, or type the meal instead.'); }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      try { await recorder.prepareToRecordAsync(); }
      catch { await recorder.stop().catch(() => {}); await recorder.prepareToRecordAsync(); }
      recorder.record();
      setSeconds(0); setRecording(true);
      timer.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      active.current = false; clearTimer(); setRecording(false);
      onError('Couldn’t start the microphone. You can type the meal instead.');
    }
  }

  useEffect(() => { if (recording && seconds >= MAX_SECONDS) stop(); }, [seconds]); // eslint-disable-line react-hooks/exhaustive-deps
  // Closing the sheet mid-recording must release the microphone.
  useEffect(() => () => { clearTimer(); if (active.current) { active.current = false; recorder.stop().catch(() => {}); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <View style={s.wrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording' : 'Start recording'} disabled={disabled && !recording} onPress={recording ? () => stop() : start} style={[s.mic, recording && s.micOn, disabled && !recording && { opacity: 0.45 }]}>
      <Ionicons name={recording ? 'stop' : 'mic'} size={34} color="#FFFFFF" />
    </Pressable>
    <Text style={s.hint}>{recording ? `Listening ${seconds}s, tap to stop` : 'Tap and tell me what you ate'}</Text>
  </View>;
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  mic: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  micOn: { backgroundColor: colors.red },
  hint: { color: colors.muted, fontSize: 13 },
});
