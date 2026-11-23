import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BananaLogo } from '../../src/components/banana-logo';
import { LoadingScreen } from '../../src/components/loading-screen';

it('uses the actual bundled Banana artwork instead of a crescent path', async () => {
  await render(<BananaLogo size={72} />);
  const logo = screen.getByRole('image', { name: 'Banana logo' });
  expect(logo.props.source).toEqual(require('../../assets/banana-logo.jpg'));
  expect(logo.props.style).toMatchObject({ width: 72, height: 72 });
});
it('uses the same artwork on the loading screen', async () => {
  await render(<LoadingScreen />);
  expect(screen.getByRole('image', { name: 'Banana logo' })).toBeTruthy();
});
