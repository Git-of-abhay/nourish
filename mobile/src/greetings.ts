const morning = [
  'Morning, how are you feeling?', 'Hey, let’s start small', 'Good morning, take it easy',
  'A fresh day is here', 'Morning, ready when you are', 'Hey, we’ve got today',
  'Good morning, one thing at a time', 'What sounds good this morning?', 'Morning, let’s find your rhythm',
  'Hi there, glad you’re here', 'A little start is still a start', 'Morning, no rush',
  'Hey, let’s make today yours', 'Good morning, you’ve got this', 'Fresh morning, fresh page',
  'Morning, let’s keep it simple', 'Hey, what’s your first move?',
];
const afternoon = [
  'Hey, how’s your day going?', 'Afternoon check-in time', 'A little pause sounds good',
  'Still plenty of day left', 'Hey, let’s take a breath', 'Good afternoon, your pace is fine',
  'How about one small win?', 'Hi again, what do you need?', 'Afternoon, let’s keep it light',
  'Hey, you can start right here', 'A quick check-in feels good', 'Let’s see where you are',
  'Hi, the next step can be tiny', 'Afternoon, go easy on yourself', 'Hey, you’re doing okay',
  'Let’s make the rest feel nice', 'Your afternoon, your way',
];
const evening = [
  'Hey, how was today?', 'Evening, let’s wind down', 'A little check-in before rest',
  'Good evening, take it easy', 'Hey, what felt good today?', 'Time to slow things down',
  'Evening, no judgment here', 'Let’s look back gently', 'Hey, you made it through today',
  'A quiet moment for you', 'Good evening, how are you?', 'Let’s make tomorrow easier',
  'Hey, rest counts too', 'Evening, your pace was enough', 'Take a breath, you’re here',
  'Let’s end today softly',
];
export function greeting(now = new Date()): string {
  const hour = now.getHours();
  const list = hour < 12 ? morning : hour < 17 ? afternoon : evening;
  const day = Math.floor(now.getTime() / 86400000);
  return list[day % list.length];
}
export const greetingCount = morning.length + afternoon.length + evening.length;
