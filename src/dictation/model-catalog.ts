import type { WhisperModelId } from '../models/dictation';

export interface WhisperModel {
  id: WhisperModelId;
  name: string;
  fileName: string;
  bytes: number;
  sha256: string;
  url: string;
}

export const WHISPER_MODELS: readonly WhisperModel[] = [
  {
    id: 'base', name: 'Whisper Base', fileName: 'ggml-base-q5_1.bin',
    bytes: 59707625,
    sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base-q5_1.bin',
  },
  {
    id: 'small', name: 'Whisper Small', fileName: 'ggml-small-q5_1.bin',
    bytes: 190085487,
    sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small-q5_1.bin',
  },
];

export function getWhisperModel(id: WhisperModelId): WhisperModel {
  const model = WHISPER_MODELS.find((item) => item.id === id);
  if (!model) throw new Error('Unknown Whisper model.');
  return model;
}
