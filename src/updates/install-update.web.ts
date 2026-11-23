import { Linking } from 'react-native';
import type { AppUpdate } from './update-policy';

export async function installUpdate(update: AppUpdate): Promise<void> {
  await Linking.openURL(update.url);
}
