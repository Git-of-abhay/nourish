import { Alert, Platform } from 'react-native';

export function confirmAction(title: string, detail: string, action: () => void, labels = { cancel: 'Keep', ok: 'Remove', destructive: true }) {
  if (Platform.OS === 'web') {
    if (window.confirm(title + '\n' + detail)) action();
    return;
  }
  Alert.alert(title, detail, [
    { text: labels.cancel, style: 'cancel' },
    { text: labels.ok, style: labels.destructive ? 'destructive' : 'default', onPress: action },
  ]);
}
