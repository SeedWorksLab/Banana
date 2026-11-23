import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BatchMealSummary } from '../../src/components/batch-meal-summary';
import { batchSlot } from '../fixtures/batch-meals';

it('does not label an ordinary recipe as batch cooking', async () => {
  const slot = batchSlot();
  await render(<BatchMealSummary slot={slot} slots={[slot]} />);
  expect(screen.queryByTestId('batch-summary-1')).toBeNull();
});

it('flags unlinked leftovers without inventing a source or recipe', async () => {
  const slot = batchSlot({ kind: 'leftovers', recipeId: null, batchSourceUuid: 'missing', servings: 1 });
  await render(<BatchMealSummary slot={slot} slots={[slot]} />);
  expect(screen.getByText('Leftovers · choose a source meal')).toBeTruthy();
  expect(screen.getByText('Eat 1 portion · No cooking')).toBeTruthy();
});
