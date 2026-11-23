import { WHISPER_MODELS } from '../../src/dictation/model-catalog';
import { acquireModel, cancelModelDownload, deleteModel, downloadModel, isModelInstalled, verifiedModelPath } from '../../src/dictation/model-storage';

const model = WHISPER_MODELS[0];
const mockFiles = new Map<string, number>();
const mockHash = jest.fn();
const mockMove = jest.fn(async (from: string, to: string) => {
  mockFiles.set(to, mockFiles.get(from)!);
  mockFiles.delete(from);
});
const mockDelete = jest.fn(async (uri: string) => { mockFiles.delete(uri); });
const mockCancel = jest.fn(async () => {});
const mockDownload = jest.fn();
const mockCreate = jest.fn((_url: string, _uri: string, _options: unknown, _progress: unknown) => ({
  downloadAsync: () => mockDownload(), cancelAsync: mockCancel,
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: async (uri: string) => mockFiles.has(uri)
    ? { exists: true, isDirectory: false, size: mockFiles.get(uri) } : { exists: false },
  getFreeDiskStorageAsync: async () => 1000000000,
  createDownloadResumable: (...args: [string, string, unknown, unknown]) => mockCreate(...args),
  deleteAsync: (uri: string) => mockDelete(uri),
}));
jest.mock('../../src/dictation/native-speech', () => ({
  isNativeSpeechAvailable: () => true,
  nativeSpeech: () => ({
    modelDirectory: async () => 'file:///no_backup/whisper-models/',
    sha256: (uri: string) => mockHash(uri),
    fileSize: async (uri: string) => mockFiles.get(uri) ?? null,
    moveFile: (from: string, to: string) => mockMove(from, to),
    deleteFile: (uri: string) => mockDelete(uri),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFiles.clear();
  mockHash.mockResolvedValue(model.sha256);
  mockDownload.mockImplementation(async () => {
    mockFiles.set(`file:///cache/${model.fileName}.partial`, model.bytes);
    return { status: 200 };
  });
});

it('downloads only the pinned public model, verifies it, and installs outside cache', async () => {
  await downloadModel('base', jest.fn());
  expect(mockCreate).toHaveBeenCalledWith(model.url, `file:///cache/${model.fileName}.partial`, {}, expect.any(Function));
  expect(mockHash).toHaveBeenCalled();
  expect(await isModelInstalled('base')).toBe(true);
  expect(await verifiedModelPath('base')).toBe(`file:///no_backup/whisper-models/${model.fileName}`);
  expect(mockFiles.has(`file:///cache/${model.fileName}.partial`)).toBe(false);
});

it('reuses installed models without network requests across repeated calls', async () => {
  await downloadModel('base', jest.fn());
  mockCreate.mockClear();
  await downloadModel('base', jest.fn());
  expect(mockCreate).not.toHaveBeenCalled();
});

it('rejects a corrupt download and cleans only the partial model', async () => {
  mockHash.mockResolvedValue('wrong-digest');
  await expect(downloadModel('base', jest.fn())).rejects.toThrow('integrity');
  expect(await isModelInstalled('base')).toBe(false);
  expect(mockMove).not.toHaveBeenCalled();
  expect(mockFiles.size).toBe(0);
});

it('keeps an installed model when a different download fails', async () => {
  await downloadModel('base', jest.fn());
  mockDownload.mockRejectedValue(new Error('Offline'));
  await expect(downloadModel('small', jest.fn())).rejects.toThrow('Offline');
  expect(await isModelInstalled('base')).toBe(true);
});

it('cancels an in-flight download without installing its result', async () => {
  let resolve!: (value: { status: number }) => void;
  mockDownload.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const pending = downloadModel('base', jest.fn());
  while (!mockDownload.mock.calls.length) await Promise.resolve();
  await cancelModelDownload();
  resolve({ status: 200 });
  await expect(pending).rejects.toThrow('cancelled');
  expect(mockCancel).toHaveBeenCalledTimes(1);
  expect(await isModelInstalled('base')).toBe(false);
});

it('prevents deleting models used for inference and verifies again before use', async () => {
  await downloadModel('base', jest.fn());
  const release = acquireModel('base');
  await expect(deleteModel('base')).rejects.toThrow('Stop dictation');
  expect(() => acquireModel('small')).toThrow('Another local dictation');
  release();
  mockHash.mockResolvedValue('corrupt');
  await expect(verifiedModelPath('base')).rejects.toThrow('verification');
  await deleteModel('base');
  expect(await isModelInstalled('base')).toBe(false);
});
