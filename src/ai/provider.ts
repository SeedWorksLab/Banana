export type AiRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiCompletionRequest {
  messages: readonly AiMessage[];
  temperature?: number;
}

export interface AiCompletion {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletion>;
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}
