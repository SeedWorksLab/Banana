import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { AppDialog } from './app-dialog';
import { useAppData } from '../data/DataProvider';
import { useAppTheme } from '../theme';
import {
  getHouseholdStatus, inviteHousehold, leaveHousehold, respondHouseholdInvitation,
  type HouseholdStatus,
} from '../sync/households';

export function HouseholdSettings() {
  const theme = useAppTheme();
  const { syncSeedWorks } = useAppData();
  const [status, setStatus] = useState<HouseholdStatus | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('Our household');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const load = useCallback(async () => {
    try { setStatus(await getHouseholdStatus()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load household.'); }
  }, []);
  useEffect(() => {
    let active = true;
    void getHouseholdStatus().then((next) => {
      if (active) setStatus(next);
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Could not load household.');
    });
    return () => { active = false; };
  }, []);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await syncSeedWorks();
      await action();
      await syncSeedWorks();
      await load();
      setMessage('Household updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update household.');
    } finally { setBusy(false); }
  }

  return <Card>
    <Card.Content style={{ gap: theme.spacing[3] }}>
      <Text variant="titleLarge">Shared life</Text>
      <Text>Share recipes, homes, pantries and plans. Personal data stays separate.
        Joining opens a separate shared household, not a merge of personal recipes.</Text>
      {status?.identityId ? <>
        <Text variant="titleMedium">{status.name}</Text>
        {status.members.map((member) => <Text key={member.id}>{member.email}</Text>)}
        <Button disabled={busy} onPress={() => setLeaving(true)}
          accessibilityRole="button" accessibilityLabel="Leave household">Leave household</Button>
      </> : <Text>Your personal data is currently active.</Text>}
      <TextInput label="Household name" value={name} onChangeText={setName} maxLength={80}
        accessibilityLabel="Household name" />
      <TextInput label="Other person's SeedWorks email" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" accessibilityLabel="Household invitation email" />
      <Text variant="bodySmall">Sending the first invitation opens a new, empty shared household.
        The recipient must accept. You can leave to return to your personal data.</Text>
      <Button disabled={busy || !status || !email.trim() || !name.trim()} loading={busy}
        onPress={() => void run(async () => { await inviteHousehold(email, name); setEmail(''); })}
        accessibilityRole="button" accessibilityLabel="Invite household member">Send invitation</Button>
      {status?.invitations.map((invitation) => <React.Fragment key={invitation.id}>
        <Text>{invitation.inviterEmail} invites you to {invitation.name}</Text>
        <Button disabled={busy} onPress={() => void run(() => respondHouseholdInvitation(invitation.id, true))}
          accessibilityRole="button" accessibilityLabel={`Join ${invitation.name}`}>Accept invitation</Button>
        <Button disabled={busy} onPress={() => void run(() => respondHouseholdInvitation(invitation.id, false))}
          accessibilityRole="button" accessibilityLabel={`Decline ${invitation.name}`}>Decline</Button>
      </React.Fragment>)}
      <Button disabled={busy} onPress={() => void load()} accessibilityRole="button"
        accessibilityLabel="Refresh household invitations">Refresh invitations</Button>
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    </Card.Content>
    <AppDialog visible={leaving} onDismiss={() => setLeaving(false)}>
      <AppDialog.Title>Leave this household?</AppDialog.Title>
      <AppDialog.Content><Text>Your personal data will return. Other members keep the shared data.</Text></AppDialog.Content>
      <AppDialog.Actions>
        <Button onPress={() => setLeaving(false)} accessibilityRole="button" accessibilityLabel="Keep household">Cancel</Button>
        <Button disabled={busy} onPress={() => { setLeaving(false); void run(leaveHousehold); }}
          accessibilityRole="button" accessibilityLabel="Confirm leave household">Leave</Button>
      </AppDialog.Actions>
    </AppDialog>
  </Card>;
}
