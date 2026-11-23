import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollableTextInput } from '../../src/components/scrollable-text-input';
import { lightTheme } from '../../src/theme';

it('keeps long multiline content inside a fixed scrolling area with a scrollbar', async () => {
  await render(<ScrollableTextInput label="Message" mode="outlined" value={'A long recipe.\n'.repeat(500)} />);
  const input = screen.getByLabelText('Message');
  await fireEvent(input, 'contentSizeChange', { nativeEvent: { contentSize: { height: 5000, width: 300 } } });
  const viewport = screen.getByTestId('scrollable-text-input');
  expect(viewport.props.style).toEqual(expect.arrayContaining([
    expect.objectContaining({ height: lightTheme.spacing[10] * 2, flexGrow: 0 }),
  ]));
  expect(viewport.props.showsVerticalScrollIndicator).toBe(true);
  expect(viewport.props.persistentScrollbar).toBe(true);
  expect(input.props.scrollEnabled).toBe(false);
});
