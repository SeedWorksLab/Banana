import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let handlerConfigured = false;

function configureHandler(): void {
  if (handlerConfigured) {
    return;
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function notifyPlanUpdated(body: string): Promise<boolean> {
  try {
    configureHandler();
    if (!(await requestNotificationPermission())) {
      return false;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('plan-updates', {
        name: 'Plan updates',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Banana updated your plan',
        body,
        sound: false,
      },
      trigger: null,
    });
    return true;
  } catch {
    // Notification permission or delivery must never fail a completed plan update.
    return false;
  }
}
