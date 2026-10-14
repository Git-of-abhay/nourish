import React, { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { Sparkline } from '../components';
import { describeTrend } from '../progress';
import { Dashboard, ReportAnalysis } from '../types';
import { Button, Card, colors, ErrorNote, styles, Subtle, Title } from '../ui';

export function Reports({ token, data, onChanged }: { token: string; data: Dashboard; onChanged: () => Promise<void> }) {
  const [analysis, setAnalysis] = useState<ReportAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chooseAndAnalyze() {
    setBusy(true); setError(null); setAnalysis(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets[0]) return;
      const file = result.assets[0];
      if (file.size && file.size > 5 * 1024 * 1024) return setError('Pick a file under 5 MB.');
      setAnalysis(await api.analyzeReport(token, { uri: file.uri, name: file.name, mimeType: file.mimeType || 'application/pdf' }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t read that. Try a clearer file.'); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!analysis) return;
    setBusy(true); setError(null);
    try { await api.saveReport(token, analysis); setAnalysis(null); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t save that.'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true); setError(null);
    try { await api.deleteReport(token, id); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t delete that.'); }
    finally { setBusy(false); }
  }

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={{ paddingTop: 15, gap: 5 }}><Text style={styles.eyebrow}>REPORTS</Text><Title>Make sense of your report</Title><Subtle>Upload one and I’ll pull out the numbers. Double check them against the original.</Subtle></View>
    <Card><Text style={styles.heading}>Add a report</Text><Subtle>Photo or PDF, up to 5 MB (first 3 pages of a PDF). It goes to Groq to be read and I only save the summary you confirm.</Subtle><Button title={busy ? 'Reading' : 'Choose report'} disabled={busy} onPress={chooseAndAnalyze} /><Subtle>Just a reading aid, not a diagnosis.</Subtle></Card>
    <ErrorNote message={error} />
    {analysis && <Card><Text style={styles.heading}>{analysis.title}</Text><Text style={styles.body}>{analysis.summary}</Text>{analysis.metrics.map((metric, index) => <View key={`${metric.name}-${index}`} style={{ borderTopWidth: 1, borderColor: '#F0E1D8', paddingTop: 8 }}><Text style={styles.body}>{metric.name}: {metric.value} {metric.unit}</Text><Subtle>{metric.reference ? `Report reference: ${metric.reference}` : 'No legible reference range'}</Subtle></View>)}<Subtle>Check the values against your report first.</Subtle><Button title={busy ? 'Saving' : 'Save summary'} disabled={busy} onPress={save} /><Button title="Discard" variant="quiet" onPress={() => setAnalysis(null)} /></Card>}
    {data.metric_trends.length > 0 && <>
      <Text style={styles.heading}>Your numbers</Text>
      {data.metric_trends.map(trend => { const text = describeTrend(trend); const flagged = trend.latest.status === 'above' || trend.latest.status === 'below'; return <Card key={trend.key}>
        <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.heading}>{trend.label}</Text><Text style={{ fontSize: 26, fontWeight: '800', color: colors.ink }}>{trend.latest.value} <Text style={{ fontSize: 13, fontWeight: '500', color: colors.muted }}>{trend.unit}</Text></Text></View><Sparkline values={trend.series} color={flagged ? colors.red : colors.teal} /></View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><View style={{ backgroundColor: flagged ? '#FCE0E4' : trend.latest.status === 'within' ? '#DDF1E4' : colors.line, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}><Text style={{ fontSize: 11, fontWeight: '800', color: flagged ? colors.red : colors.ink }}>{text.status}</Text></View><Subtle>{text.change}</Subtle></View>
        {trend.latest.reference ? <Subtle>Range on your report: {trend.latest.reference}</Subtle> : null}
        {trend.why ? <Text style={styles.body}>{trend.why}</Text> : null}
        {trend.goal_tip ? <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>{trend.goal_tip}</Text> : null}
      </Card>; })}
      <Subtle>These compare your values with the ranges printed on your reports. They aren’t a diagnosis, so talk to your doctor about anything that stands out.</Subtle>
    </>}
    <Text style={styles.heading}>Saved</Text>
    {data.reports.length === 0 ? <Card><Subtle>Nothing saved yet. Totally optional.</Subtle></Card> : data.reports.map(report => <Card key={report.id}><Text style={styles.heading}>{report.title}</Text><Subtle>{report.created_at.slice(0, 10)}</Subtle><Text style={styles.body}>{report.summary}</Text>{report.metrics.slice(0, 6).map((metric, index) => <Subtle key={index}>{metric.name}: {metric.value} {metric.unit}</Subtle>)}{report.metrics.length > 6 && <Subtle>+ {report.metrics.length - 6} more values</Subtle>}<Button title="Delete" variant="quiet" disabled={busy} onPress={() => remove(report.id)} /></Card>)}
  </ScrollView>;
}
