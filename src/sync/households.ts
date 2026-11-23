import { getClient } from './supabase';

export interface HouseholdStatus {
  identityId: string | null;
  name: string | null;
  members: { id: string; email: string }[];
  invitations: { id: string; name: string; inviterEmail: string }[];
}

export async function resolveDataIdentity(): Promise<string> {
  const { data, error } = await getClient().rpc('resolve_data_identity');
  if (error || typeof data !== 'string') throw new Error(error?.message ?? 'Could not resolve your data identity.');
  return data;
}

export async function getHouseholdStatus(): Promise<HouseholdStatus> {
  const { data, error } = await getClient().rpc('household_status');
  if (error || !data) throw new Error(error?.message ?? 'Could not load household.');
  return data as HouseholdStatus;
}

export async function inviteHousehold(email: string, name: string): Promise<void> {
  const { error } = await getClient().rpc('invite_household', { p_email: email.trim(), p_name: name.trim() });
  if (error) throw new Error(error.message);
}

export async function respondHouseholdInvitation(id: string, accept: boolean): Promise<void> {
  const { error } = await getClient().rpc('respond_household_invitation', { p_id: id, p_accept: accept });
  if (error) throw new Error(error.message);
}

export async function leaveHousehold(): Promise<void> {
  const { error } = await getClient().rpc('leave_household');
  if (error) throw new Error(error.message);
}
