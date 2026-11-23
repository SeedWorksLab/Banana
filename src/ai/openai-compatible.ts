import {
  AiProviderError,
  type AiCompletion,
  type AiCompletionRequest,
  type AiProvider,
  type AiProviderConfig,
} from './provider';

const REQUEST_TIMEOUT_MS = 90_000;

export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  const url = new URL(trimmed);
  const path = url.pathname.replace(/\/$/, '');
  if (path.endsWith('/chat/completions')) {
    return url.toString();
  }
  url.pathname = path === '' || path === '/' ? '/v1/chat/completions' : `${path}/chat/completions`;
  return url.toString();
}

interface CompletionResponse {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function createOpenAiCompatibleProvider(config: AiProviderConfig): AiProvider {
  return {
    async complete(request: AiCompletionRequest): Promise<AiCompletion> {
      if (config.baseUrl.trim() === '' || config.model.trim() === '') {
        throw new AiProviderError('The AI provider is not configured');
      }
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AiProviderError('The AI provider timed out. Please try again.'));
          controller.abort();
        }, REQUEST_TIMEOUT_MS);
      });
      try {
        const response = await Promise.race([deadline, fetch(chatCompletionsUrl(config.baseUrl), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: request.messages,
             temperature: request.temperature ?? 0.2,
             stream: false,
          }),
          signal: controller.signal,
        })]);
        if (!response.ok) {
          throw new AiProviderError(`The AI provider returned ${response.status}. Check your provider settings.`);
        }
        const payload = (await Promise.race([deadline, response.json()])) as CompletionResponse;
        const text = payload.choices?.[0]?.message?.content ?? '';
        if (text.trim() === '') {
          throw new AiProviderError('The AI provider returned an empty response');
        }
        return {
          text,
          model: payload.model ?? config.model,
          inputTokens: payload.usage?.prompt_tokens ?? null,
          outputTokens: payload.usage?.completion_tokens ?? null,
        };
      } catch (caught) {
        if (caught instanceof AiProviderError) {
          throw caught;
        }
        if (caught instanceof Error && caught.name === 'AbortError') {
          throw new AiProviderError('The AI provider timed out');
        }
        throw new AiProviderError(
          caught instanceof Error ? caught.message : 'The AI provider request failed'
        );
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
