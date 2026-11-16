import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { OptionField } from '../../src/components/option-field';
import { lightTheme } from '../../src/theme';

it('opens the menu from the whole labelled field, without pressing the arrow', async () => {
  await render(
    <PaperProvider theme={lightTheme}>
      <OptionField label="Unit" value="g" options={[{ value: 'g', label: 'Grams' }]}
        onChange={jest.fn()} />
    </PaperProvider>
  );
  const field = screen.getByRole('button', { name: 'Unit: Grams' });
  expect(field.props.accessibilityState.expanded).toBe(false);
  await fireEvent.press(field);
  expect(screen.getByTestId('option-Unit').props.accessibilityState.expanded).toBe(true);
});
