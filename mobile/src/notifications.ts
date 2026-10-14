import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

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
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) await schedule(reminder);
}
