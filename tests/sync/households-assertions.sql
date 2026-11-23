\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
select banana.invite_household('two@example.test', 'Test household');
select banana.resolve_data_identity() as household \gset
insert into banana.recipes(uuid, user_id, payload) values ('shared-soup', :'household', '{"name":"Shared soup"}');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', false);
do $$ begin
  if exists(select 1 from banana.recipes where uuid = 'shared-soup') then
    raise exception 'Outsider can read shared recipes';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
do $$ begin
  if exists(select 1 from banana.recipes where uuid = 'shared-soup') then
    raise exception 'Invitation alone grants access';
  end if;
end $$;
select (banana.household_status()->'invitations'->0->>'id') as invitation \gset
select banana.respond_household_invitation(:'invitation', true);
do $$ begin
  if not exists(select 1 from banana.recipes where uuid = 'shared-soup') then
    raise exception 'Accepted household cannot read shared recipes';
  end if;
end $$;
update banana.recipes set payload = '{"name":"Edited soup"}' where uuid = 'shared-soup';
select banana.leave_household();
do $$ begin
  if exists(select 1 from banana.recipes where uuid = 'shared-soup') then
    raise exception 'Former member retains access';
  end if;
  if banana.resolve_data_identity() <> auth.uid() then
    raise exception 'Leaving did not restore personal identity';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $$ begin
  if not exists(select 1 from banana.recipes where payload->>'name' = 'Edited soup') then
    raise exception 'Shared edit was lost';
  end if;
end $$;
