import { chatCompletionsUrl, createOpenAiCompatibleProvider } from '../../src/ai/openai-compatible';

const config = { baseUrl: 'https://ai.example.test/v1', apiKey: 'test-key', model: 'test-model' };
const request = { messages: [{ role: 'user' as const, content: 'Soup please' }] };
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

it.each([
  ['https://ai.example.test', 'https://ai.example.test/v1/chat/completions'],
  ['https://ai.example.test/v1/', 'https://ai.example.test/v1/chat/completions'],
  ['https://ai.example.test/v1/chat/completions', 'https://ai.example.test/v1/chat/completions'],
])('normalizes %s', (base, expected) => expect(chatCompletionsUrl(base)).toBe(expected));

it('sends a non-streaming request and reads its answer', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, json: async () => ({ choices: [{ message: { content: '{"recipes":[]}' } }] }),
  });
  expect(await createOpenAiCompatibleProvider(config).complete(request)).toMatchObject({ text: '{"recipes":[]}' });
  expect(global.fetch).toHaveBeenCalledWith(config.baseUrl + '/chat/completions',
    expect.objectContaining({ body: expect.stringContaining('"stream":false') }));
});

it.each(['request', 'body'])('enforces a deadline even if the %s ignores abort', async (stage) => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockImplementation(() => stage === 'request'
    ? new Promise(() => {})
    : Promise.resolve({ ok: true, json: () => new Promise(() => {}) }));
  const promise = createOpenAiCompatibleProvider(config).complete(request);
  const assertion = expect(promise).rejects.toThrow('timed out');
  await jest.advanceTimersByTimeAsync(90_000);
  await assertion;
  expect(jest.getTimerCount()).toBe(0);
});

it('reports authentication errors without echoing server-provided secrets', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  await expect(createOpenAiCompatibleProvider(config).complete(request)).rejects.toThrow('401');
});

it('rejects empty completions', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
  await expect(createOpenAiCompatibleProvider(config).complete(request)).rejects.toThrow('empty response');
});
