import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { Reminder } from './types';

type Notif = typeof import('expo-notifications');
let loaded: Notif | null | undefined;
// Expo Go on Android no longer supports notifications, so skip loading the module there.
async function load(): Promise<Notif | null> {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (loaded = null);
  try {
    const mod = await import('expo-notifications');
    mod.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
    loaded = mod;
  } catch { loaded = null; }
  return loaded;
}

const messages = [
  ['A small check-in?', 'One quick entry can make today easier to understand.'],
  ['Your day, your pace', 'See one useful step for today in Nourish.'],
  ['A little progress counts', 'Your assistant has a fresh check-in ready.'],
  ['Make a moment for you', 'A meal or movement note is enough to start.'],
  ['Hello from Nourish', 'What is one thing you would like to notice today?'],
  ['Your next small win', 'Open your Today card for a gentle nudge.'],
  ['Let’s keep the rhythm', 'A quick check-in can help you spot patterns.'],
];

async function schedule(reminder: Reminder) {
  const Notifications = await load();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (reminder === 'off') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('check-in', { name: 'Daily check-ins', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const hour = reminder === 'morning' ? 9 : 18;
  for (let day = 0; day < 14; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    date.setHours(hour, 0, 0, 0);
    if (date.getTime() <= Date.now()) continue;
    const [title, body] = messages[day % messages.length];
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: Platform.OS === 'android' ? 'check-in' : undefined } });
  }
}

export async function updateReminder(reminder: Reminder): Promise<'scheduled' | 'off' | 'denied' | 'error'> {
  try {
    if (reminder === 'off') { await schedule('off'); return 'off'; }
    const Notifications = await load();
    if (!Notifications) return 'error';
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return 'denied';
    await schedule(reminder);
    return 'scheduled';
  } catch {
    return 'error';
  }
}

export async function refreshReminder(reminder: Reminder) {
  if (reminder === 'off') return;
  const Notifications = await load();
  if (!Notifications) return;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) await schedule(reminder);
}
