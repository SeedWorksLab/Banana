export function useLeafletRecording(_language: string, _contextualStrings: string[]) {
  return {
    recording: false,
    busy: false,
    hasRecording: false,
    error: 'Background leaflet recording requires Android 13 or newer with on-device speech recognition.',
    start: async () => {},
    stopAndTranscribe: async (): Promise<string | null> => null,
    discard: async () => {},
  };
}
