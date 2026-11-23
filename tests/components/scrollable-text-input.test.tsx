import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ScrollableTextInput } from '../../src/components/scrollable-text-input';
import { lightTheme } from '../../src/theme';

it('scrolls the text inside a fixed input instead of scrolling its label and outline', async () => {
  await render(<ScrollableTextInput label="Message" mode="outlined" value={'A long recipe.\n'.repeat(500)} />);
  const input = screen.getByLabelText('Message');
  await fireEvent(input, 'contentSizeChange', { nativeEvent: { contentSize: { height: 5000, width: 300 } } });
  const viewport = screen.getByTestId('scrollable-text-input');
  expect(StyleSheet.flatten(viewport.props.style)).toEqual(expect.objectContaining({
    height: lightTheme.spacing[10] * 2, flexGrow: 0, overflow: 'hidden',
  }));
  expect(input.props.scrollEnabled).toBe(true);
  expect(input.props.textAlignVertical).toBe('top');
  expect(StyleSheet.flatten(input.props.style).height).toBeLessThanOrEqual(lightTheme.spacing[10] * 2);
  expect(screen.getByTestId('scrollable-text-input-label')).toBeTruthy();
  expect(within(viewport).queryByText('Message')).toBeNull();
});

it('keeps a static label when an empty field is focused and receives dictated text', async () => {
  const { rerender } = await render(<ScrollableTextInput label="Recipe" mode="outlined" value="" />);
  await fireEvent(screen.getByLabelText('Recipe'), 'focus', { nativeEvent: {} });
  await rerender(<ScrollableTextInput label="Recipe" mode="outlined" value={'Curry\n'.repeat(200)} />);
  expect(screen.getByTestId('scrollable-text-input-label').props.children).toBe('Recipe');
  expect(screen.queryByTestId('text-input-outlined-label-active')).toBeNull();
  expect(StyleSheet.flatten(screen.getByTestId('scrollable-text-input').props.style).height).toBe(lightTheme.spacing[10] * 2);
});

it('forwards editing callbacks without growing the field or forcing an outer scroll position', async () => {
  const onSelectionChange = jest.fn();
  const onContentSizeChange = jest.fn();
  const onChangeText = jest.fn();
  await render(<ScrollableTextInput label="Leaflet" accessibilityLabel="Leaflet text"
    value="Milk" onChangeText={onChangeText} onSelectionChange={onSelectionChange}
    onContentSizeChange={onContentSizeChange} />);
  const input = screen.getByLabelText('Leaflet text');
  const selection = { nativeEvent: { selection: { start: 4, end: 4 } } };
  const content = { nativeEvent: { contentSize: { height: 9000, width: 300 } } };
  await fireEvent(input, 'selectionChange', selection);
  await fireEvent(input, 'contentSizeChange', content);
  await fireEvent.changeText(input, 'Milk and bread');
  expect(onSelectionChange).toHaveBeenCalledWith(selection);
  expect(onContentSizeChange).toHaveBeenCalledWith(content);
  expect(onChangeText).toHaveBeenCalledWith('Milk and bread');
  expect(StyleSheet.flatten(screen.getByTestId('scrollable-text-input').props.style).height).toBe(lightTheme.spacing[10] * 2);
});
