import { Alert, Platform } from 'react-native';

export function confirmAction(title: string, detail: string, action: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(title + '\n' + detail)) action();
    return;
  }
  Alert.alert(title, detail, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: action },
  ]);
}
