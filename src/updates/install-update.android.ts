import { requireNativeModule } from 'expo-modules-core';
import type { AppUpdate } from './update-policy';

export async function installUpdate(update: AppUpdate): Promise<void> {
  const installer = requireNativeModule<{
    downloadAndInstall(url: string, version: string): Promise<void>;
  }>('BananaUpdate');
  await installer.downloadAndInstall(update.apkUrl, update.version);
}
