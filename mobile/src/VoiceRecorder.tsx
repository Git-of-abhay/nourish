import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { requestRecordingPermissionsAsync, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './ui';

const MAX_SECONDS = 30;

/** Tap to start, tap to stop. Hands back the recording's file location. */
export function VoiceRecorder({ onRecorded, onError }: { onRecorded: (uri: string) => void; onError: (message: string) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRecording(false);
    try {
      await recorder.stop();
      if (recorder.uri) onRecorded(recorder.uri); else onError('Nothing was recorded. Try again.');
    } catch { onError('Couldn’t save that recording. Try again.'); }
  }

  async function start() {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return onError('No microphone access. You can allow it in settings, or type the meal instead.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setSeconds(0); setRecording(true);
      timer.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch { onError('Couldn’t start the microphone. You can type the meal instead.'); }
  }

  useEffect(() => { if (recording && seconds >= MAX_SECONDS) stop(); }, [seconds]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  return <View style={s.wrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording' : 'Start recording'} onPress={recording ? stop : start} style={[s.mic, recording && s.micOn]}>
      <Ionicons name={recording ? 'stop' : 'mic'} size={34} color="#FFFFFF" />
    </Pressable>
    <Text style={s.hint}>{recording ? `Listening ${seconds}s (tap to stop)` : 'Tap and tell me what you ate'}</Text>
  </View>;
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  mic: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  micOn: { backgroundColor: colors.red },
  hint: { color: colors.muted, fontSize: 13 },
});
