/** @jest-environment jsdom */
import React, { act } from 'react';
import { PaperProvider } from 'react-native-paper';
import { ScrollableTextInput } from '../../src/components/scrollable-text-input';
import { lightTheme } from '../../src/theme';

jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaInsetsContext: jest.requireActual<typeof import('react')>('react').createContext({
    top: 0, right: 0, bottom: 0, left: 0,
  }),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { __esModule: true, default: () => React.createElement('span', { 'aria-hidden': true }, 'icon') };
});

interface DomRoot {
  render(node: React.ReactNode): void;
  unmount(): void;
}
const { createRoot } = jest.requireActual<{ createRoot(container: Element): DomRoot }>('react-dom/client');

beforeAll(() => {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true, writable: true,
    value: jest.fn(async () => { throw new Error('Unexpected network request in text input test.'); }),
  });
});

it('keeps the label outside the clipped textarea viewport across focus and long dictation updates', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const renderInput = (value: string) => root.render(
    <PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}>
      <ScrollableTextInput label="Recipe" mode="outlined" value={value} onChangeText={jest.fn()} />
    </PaperProvider>,
  );
  try {
    await act(async () => renderInput(''));
    const frame = container.querySelector<HTMLElement>('[data-testid="scrollable-text-input"]')!;
    const label = container.querySelector<HTMLElement>('[data-testid="scrollable-text-input-label"]')!;
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Recipe"]')!;
    expect(label.textContent).toBe('Recipe');
    expect(frame.contains(label)).toBe(false);
    expect(frame.contains(textarea)).toBe(true);
    expect(frame.style.height).toBe(`${lightTheme.spacing[10] * 2}px`);
    expect(getComputedStyle(frame).overflowX).toBe('hidden');
    expect(getComputedStyle(frame).overflowY).toBe('hidden');
    const inputHeight = textarea.style.height;
    expect(parseFloat(inputHeight)).toBeGreaterThan(0);
    expect(parseFloat(inputHeight)).toBeLessThanOrEqual(lightTheme.spacing[10] * 2);
    await act(async () => textarea.focus());
    textarea.scrollTop = 200;
    await act(async () => renderInput('A long dictated recipe.\n'.repeat(500)));
    expect(container.querySelector('[data-testid="scrollable-text-input-label"]')).toBe(label);
    expect(container.querySelector('textarea')).toBe(textarea);
    expect(container.querySelector('[data-testid="text-input-outlined-label-active"]')).toBeNull();
    expect(textarea.style.height).toBe(inputHeight);
    expect(frame.style.height).toBe(`${lightTheme.spacing[10] * 2}px`);
    expect(textarea.scrollTop).toBe(200);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
