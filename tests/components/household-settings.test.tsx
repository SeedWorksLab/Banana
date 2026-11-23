import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { HouseholdSettings } from '../../src/components/household-settings';
import { lightTheme } from '../../src/theme';
import { getHouseholdStatus, respondHouseholdInvitation, leaveHousehold } from '../../src/sync/households';

const mockSync = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/data/DataProvider', () => ({ useAppData: () => ({ syncSeedWorks: mockSync }) }));
jest.mock('../../src/sync/households', () => ({
  getHouseholdStatus: jest.fn(), inviteHousehold: jest.fn(),
  respondHouseholdInvitation: jest.fn().mockResolvedValue(undefined),
  leaveHousehold: jest.fn().mockResolvedValue(undefined),
}));
beforeEach(() => jest.clearAllMocks());

it('requires explicit invitation acceptance before joining', async () => {
  jest.mocked(getHouseholdStatus).mockResolvedValue({
    identityId: null, name: null, members: [],
    invitations: [{ id: 'invitation', name: 'Our home', inviterEmail: 'other@example.test' }],
  });
  await render(<PaperProvider theme={lightTheme}><HouseholdSettings /></PaperProvider>);
  const join = await screen.findByRole('button', { name: 'Join Our home' });
  expect(respondHouseholdInvitation).not.toHaveBeenCalled();
  await fireEvent.press(join);
  await waitFor(() => expect(respondHouseholdInvitation).toHaveBeenCalledWith('invitation', true));
});

it('confirms leaving before restoring personal data', async () => {
  jest.mocked(getHouseholdStatus).mockResolvedValue({
    identityId: 'shared', name: 'Our home', members: [], invitations: [],
  });
  await render(<PaperProvider theme={lightTheme}><HouseholdSettings /></PaperProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Leave household' }));
  expect(leaveHousehold).not.toHaveBeenCalled();
  await fireEvent.press(await screen.findByRole('button', { name: 'Confirm leave household' }));
  await waitFor(() => expect(leaveHousehold).toHaveBeenCalledTimes(1));
});
