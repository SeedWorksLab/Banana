/** @jest-environment jsdom */
import React, { act } from 'react';
import { PaperProvider } from 'react-native-paper';
import { OptionField } from '../../src/components/option-field';
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
    value: jest.fn(async () => { throw new Error('Unexpected network request in dropdown test.'); }),
  });
});

it('renders a single HTML button without nested interactive elements or React nesting errors', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const errors = jest.spyOn(console, 'error');
  try {
    await act(async () => {
      root.render(
        <PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}>
          <OptionField label="Recognition engine" value="android" nullable={false}
            options={[{ value: 'android', label: 'Android (offline)' }]} onChange={jest.fn()} />
        </PaperProvider>,
      );
    });
    const button = container.querySelector('button[aria-label="Recognition engine: Android (offline)"]');
    expect(button).not.toBeNull();
    expect(button!.querySelector('button, input, select, textarea, a[href]')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(button!.getAttribute('aria-expanded')).toBe('false');
    await act(async () => { (button as HTMLButtonElement).click(); });
    expect(button!.getAttribute('aria-expanded')).toBe('true');
    expect(errors.mock.calls.filter((args) => /nest|descendant|hydration/i.test(args.map(String).join(' ')))).toEqual([]);
  } finally {
    await act(async () => root.unmount());
    errors.mockRestore();
    container.remove();
  }
});
