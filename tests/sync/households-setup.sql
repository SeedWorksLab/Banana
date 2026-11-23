create role authenticated;
create role service_role;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create publication supabase_realtime;
insert into auth.users values
  ('00000000-0000-4000-8000-000000000001', 'one@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'two@example.test'),
  ('00000000-0000-4000-8000-000000000003', 'outsider@example.test');
