import { Platform } from 'react-native';

export type StepResult = { status: 'connected'; count: number } | { status: 'unavailable' | 'denied' | 'error'; message: string };

export async function readTodaySteps(): Promise<StepResult> {
  if (Platform.OS !== 'android') return { status: 'unavailable', message: 'Health Connect is available on Android only.' };
  try {
    // This native module is available in the Android development build, not Expo Go.
    const hc = await import('react-native-health-connect');
    const status = await hc.getSdkStatus();
    if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return { status: 'unavailable', message: 'Health Connect is unavailable. Check Android settings or install its app.' };
    const ready = await hc.initialize();
    if (!ready) return { status: 'unavailable', message: 'Health Connect could not start on this phone.' };
    const granted = await hc.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
    if (!granted.some(p => p.accessType === 'read' && p.recordType === 'Steps')) return { status: 'denied', message: 'Steps permission was not granted. You can still log workouts manually.' };
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const result = await hc.aggregateRecord({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() } });
    return { status: 'connected', count: result.COUNT_TOTAL ?? 0 };
  } catch {
    return { status: 'error', message: 'Steps could not be read. Health Connect needs the Android development build; Expo Go cannot access it.' };
  }
}
