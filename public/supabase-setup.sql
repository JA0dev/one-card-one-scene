-- Supabase SQL Editor에서 실행하세요. 이메일 회원가입을 허용하면
-- 앱 설정의 회원가입 버튼으로 본인 계정을 만들 수 있습니다.
create table if not exists public.scene_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table if not exists public.scene_workspace_versions (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null,
 revision bigint not null,
 created_at timestamptz not null default now()
);
alter table public.scene_workspaces enable row level security;
alter table public.scene_workspace_versions enable row level security;
drop policy if exists "owner read" on public.scene_workspaces;
create policy "owner read" on public.scene_workspaces for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "owner versions" on public.scene_workspace_versions;
create policy "owner versions" on public.scene_workspace_versions for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.scene_workspaces from anon, authenticated;
revoke all on public.scene_workspace_versions from anon, authenticated;
grant select on public.scene_workspaces,public.scene_workspace_versions to authenticated;
create or replace function public.save_scene_workspace(p_payload jsonb,p_expected bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); current_row public.scene_workspaces; next_rev bigint;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if p_payload->>'schema' is distinct from '1' or jsonb_typeof(p_payload->'projects') is distinct from 'array' then raise exception 'Invalid document'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into current_row from public.scene_workspaces where user_id=u;
 if found then
  -- Retry after an interrupted response is idempotent.
  if current_row.payload=p_payload then return jsonb_build_object('ok',true,'revision',current_row.revision); end if;
  if current_row.revision<>p_expected then return jsonb_build_object('ok',false,'revision',current_row.revision,'payload',current_row.payload); end if;
  insert into public.scene_workspace_versions(user_id,payload,revision) values(u,current_row.payload,current_row.revision);
  next_rev:=current_row.revision+1;
  update public.scene_workspaces set payload=p_payload,revision=next_rev,updated_at=now() where user_id=u;
 else
  if p_expected<>0 then raise exception 'Server document is missing; export a backup before reconnecting'; end if;
  next_rev:=1;
  insert into public.scene_workspaces(user_id,payload,revision) values(u,p_payload,next_rev);
 end if;
 -- Retain the most recent 100 workspace revisions for server-side recovery.
 delete from public.scene_workspace_versions where user_id=u and id not in(select id from public.scene_workspace_versions where user_id=u order by id desc limit 100);
 return jsonb_build_object('ok',true,'revision',next_rev);
end; $$;
revoke all on function public.save_scene_workspace(jsonb,bigint) from public,anon;
grant execute on function public.save_scene_workspace(jsonb,bigint) to authenticated;
