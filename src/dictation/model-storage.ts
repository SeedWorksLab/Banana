import * as FileSystem from 'expo-file-system/legacy';
import type { WhisperModelId } from '../models/dictation';
import { getWhisperModel } from './model-catalog';
import { nativeSpeech, isNativeSpeechAvailable } from './native-speech';

let download: { id: WhisperModelId; task: FileSystem.DownloadResumable | null; cancelled: boolean } | null = null;
let usedModel: WhisperModelId | null = null;
const deletingModels = new Set<WhisperModelId>();

export const supportsModelDownloads = isNativeSpeechAvailable;

async function modelPath(id: WhisperModelId): Promise<string> {
  return (await nativeSpeech().modelDirectory()) + getWhisperModel(id).fileName;
}

export async function isModelInstalled(id: WhisperModelId): Promise<boolean> {
  if (!supportsModelDownloads()) return false;
  return await nativeSpeech().fileSize(await modelPath(id)) === getWhisperModel(id).bytes;
}

export async function verifiedModelPath(id: WhisperModelId): Promise<string> {
  const path = await modelPath(id);
  if (!(await isModelInstalled(id))) throw new Error('Download this Whisper model in Settings → Dictation first.');
  if (await nativeSpeech().sha256(path) !== getWhisperModel(id).sha256) {
    throw new Error('The Whisper model failed verification. Delete it and download it again in Dictation settings.');
  }
  return path;
}

export function acquireModel(id: WhisperModelId): () => void {
  if (usedModel || download?.id === id || deletingModels.has(id)) throw new Error('Another local dictation or model operation is running.');
  usedModel = id;
  return () => { usedModel = null; };
}

export async function deleteModel(id: WhisperModelId): Promise<void> {
  if (usedModel === id || download?.id === id || deletingModels.has(id)) throw new Error('Stop dictation or cancel the download before deleting this model.');
  deletingModels.add(id);
  try { await nativeSpeech().deleteFile(await modelPath(id)); }
  finally { deletingModels.delete(id); }
}

export async function downloadModel(id: WhisperModelId, onProgress: (fraction: number) => void): Promise<void> {
  if (download || usedModel === id || deletingModels.has(id)) throw new Error('Another download or dictation is using this model.');
  const operation = { id, task: null as FileSystem.DownloadResumable | null, cancelled: false };
  download = operation;
  let temporary: string | null = null;
  try {
    if (await isModelInstalled(id)) return;
    const model = getWhisperModel(id);
    const destination = await modelPath(id);
    if (!FileSystem.cacheDirectory) throw new Error('Temporary model storage is unavailable.');
    temporary = `${FileSystem.cacheDirectory}${model.fileName}.partial`;
    if (await FileSystem.getFreeDiskStorageAsync() < model.bytes + 32 * 1024 * 1024) {
      throw new Error('Not enough free storage for this model. Free some space and retry.');
    }
    await FileSystem.deleteAsync(temporary, { idempotent: true });
    if (operation.cancelled) throw new Error('Model download cancelled.');
    operation.task = FileSystem.createDownloadResumable(model.url, temporary, {}, (progress) => {
      onProgress(Math.min(1, progress.totalBytesWritten / model.bytes));
    });
    const result = await operation.task.downloadAsync();
    if (operation.cancelled || !result) throw new Error('Model download cancelled.');
    if (result.status !== 200) throw new Error(`Model download failed (${result.status}). Please retry.`);
    const info = await FileSystem.getInfoAsync(temporary);
    if (!info.exists || info.isDirectory || info.size !== model.bytes ||
        await nativeSpeech().sha256(temporary) !== model.sha256) {
      throw new Error('Model download failed integrity verification. Please retry.');
    }
    if (operation.cancelled) throw new Error('Model download cancelled.');
    await nativeSpeech().moveFile(temporary, destination);
    onProgress(1);
  } finally {
    try {
      if (temporary) await FileSystem.deleteAsync(temporary, { idempotent: true });
    } finally { download = null; }
  }
}

export async function cancelModelDownload(): Promise<void> {
  const operation = download;
  if (!operation) return;
  operation.cancelled = true;
  await operation.task?.cancelAsync();
}
