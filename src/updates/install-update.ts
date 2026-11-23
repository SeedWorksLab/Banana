import type { AppUpdate } from './update-policy';

export async function installUpdate(_update: AppUpdate): Promise<void> {
  throw new Error('APK installation is available in the Android app.');
}
