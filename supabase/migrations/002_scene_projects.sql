-- 씬 카드 v2: 작품마다 한 줄로 저장한다.
-- Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여 넣고 Run 한 번.
-- 여러 번 실행해도 안전하다. (예전 앱의 scene_workspaces 표는 2026-09에 원고를 옮긴 뒤 지웠다)

-- 1. 작품 표 ────────────────────────────────────────────────────────────
create table if not exists public.scene_projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists scene_projects_user_idx on public.scene_projects(user_id);

-- 서버 쪽 되돌리기용 이전 판. 작품마다 최근 50개.
create table if not exists public.scene_project_versions (
  id bigint generated always as identity primary key,
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists scene_project_versions_project_idx on public.scene_project_versions(project_id, id desc);

-- 2. 권한: 내 것만 읽는다. 쓰기는 아래 함수로만 한다 ──────────────────────
alter table public.scene_projects enable row level security;
alter table public.scene_project_versions enable row level security;
drop policy if exists "owner read" on public.scene_projects;
create policy "owner read" on public.scene_projects for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "owner read" on public.scene_project_versions;
create policy "owner read" on public.scene_project_versions for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.scene_projects, public.scene_project_versions from anon, authenticated;
grant select on public.scene_projects, public.scene_project_versions to authenticated;

-- 3. 저장: 번호표(expected)가 맞을 때만 저장하고 번호표를 1 올린다 ───────────
create or replace function public.save_scene_project(p_id uuid, p_payload jsonb, p_expected bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  cur public.scene_projects;
  next_rev bigint;
begin
  if u is null then raise exception 'Authentication required'; end if;
  if p_payload->>'schema' is distinct from '2'
     or p_payload->>'id' is distinct from p_id::text
     or jsonb_typeof(p_payload->'scenes') is distinct from 'array'
     or jsonb_typeof(p_payload->'chapters') is distinct from 'array' then
    raise exception 'Invalid project';
  end if;
  if pg_column_size(p_payload) > 20 * 1024 * 1024 then raise exception 'Project too large'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into cur from public.scene_projects where id = p_id;

  if found then
    if cur.user_id <> u then raise exception 'Forbidden'; end if;
    -- 응답을 못 받고 다시 보낸 경우: 같은 내용이면 성공으로 본다.
    if not cur.deleted and cur.payload = p_payload then
      return jsonb_build_object('ok', true, 'revision', cur.revision);
    end if;
    if cur.revision <> p_expected then
      return jsonb_build_object('ok', false, 'revision', cur.revision, 'deleted', cur.deleted,
                                'payload', case when cur.deleted then null else cur.payload end);
    end if;
    insert into public.scene_project_versions(project_id, user_id, payload, revision)
      values (p_id, u, cur.payload, cur.revision);
    next_rev := cur.revision + 1;
    update public.scene_projects set payload = p_payload, revision = next_rev, deleted = false, updated_at = now() where id = p_id;
  else
    next_rev := 1;
    insert into public.scene_projects(id, user_id, payload, revision) values (p_id, u, p_payload, next_rev);
  end if;

  delete from public.scene_project_versions
   where project_id = p_id
     and id not in (select id from public.scene_project_versions where project_id = p_id order by id desc limit 50);
  return jsonb_build_object('ok', true, 'revision', next_rev);
end; $$;

-- 4. 삭제: 내용은 이전 판으로 남기고 삭제 표시만 한다 ──────────────────────
create or replace function public.delete_scene_project(p_id uuid, p_expected bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  cur public.scene_projects;
begin
  if u is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into cur from public.scene_projects where id = p_id;
  if not found then return jsonb_build_object('ok', true, 'revision', 0); end if;
  if cur.user_id <> u then raise exception 'Forbidden'; end if;
  if cur.deleted then return jsonb_build_object('ok', true, 'revision', cur.revision); end if;
  if cur.revision <> p_expected then
    return jsonb_build_object('ok', false, 'revision', cur.revision, 'deleted', false, 'payload', cur.payload);
  end if;
  insert into public.scene_project_versions(project_id, user_id, payload, revision) values (p_id, u, cur.payload, cur.revision);
  update public.scene_projects set deleted = true, revision = cur.revision + 1, updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'revision', cur.revision + 1);
end; $$;

revoke all on function public.save_scene_project(uuid, jsonb, bigint) from public, anon;
revoke all on function public.delete_scene_project(uuid, bigint) from public, anon;
grant execute on function public.save_scene_project(uuid, jsonb, bigint) to authenticated;
grant execute on function public.delete_scene_project(uuid, bigint) to authenticated;

-- 5. 실시간 알림: 다른 기기에서 저장하면 바로 받아 온다 ─────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scene_projects') then
    alter publication supabase_realtime add table public.scene_projects;
  end if;
end $$;
