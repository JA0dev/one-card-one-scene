// Supabase 연결: 로그인과 서버 저장소(Remote) 구현.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { isProject } from '@/domain/project';
import type { Project } from '@/domain/types';
import type { Remote, RemoteRow, SaveResult } from './remote';

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://pxkhqndymobrxxsknzqr.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_S07_i3hMcTvaPHcIHHfW1w_QfOkeYeF';

let client: SupabaseClient | undefined;
export const supabase = () =>
  (client ??= createClient(URL, KEY, { auth: { storageKey: 'scene-card-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }));

// ── 로그인 ──────────────────────────────────────────────────────────────
const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, '이메일 또는 비밀번호가 맞지 않아요.'],
  [/email not confirmed/i, '메일함에서 가입 확인 링크를 먼저 눌러 주세요.'],
  [/already registered/i, '이미 가입된 이메일이에요. 로그인해 주세요.'],
  [/password should be at least/i, '비밀번호는 6자 이상이어야 해요.'],
  [/rate limit/i, '잠시 후 다시 시도해 주세요.'],
  [/failed to fetch|network/i, '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.'],
];
const korean = (e: { message: string }) => new Error(MESSAGES.find(([r]) => r.test(e.message))?.[1] ?? e.message);

export const auth = {
  async user(): Promise<User | null> {
    const { data } = await supabase().auth.getSession();
    return data.session?.user ?? null;
  },
  async signIn(email: string, password: string) {
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw korean(error);
  },
  /** 가입 확인 메일이 필요한 설정이면 false */
  async signUp(email: string, password: string): Promise<boolean> {
    const { data, error } = await supabase().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin } });
    if (error) throw korean(error);
    return !!data.session;
  },
  async resetPassword(email: string) {
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin });
    if (error) throw korean(error);
  },
  async signOut() { await supabase().auth.signOut(); },
  onChange(fn: (user: User | null) => void) {
    const { data } = supabase().auth.onAuthStateChange((_e, s) => fn(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  },
};

// ── 서버 저장소 ──────────────────────────────────────────────────────────
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw korean(r.error);
  return r.data;
}
const payloadOf = (v: unknown): Project | null => (isProject(v) ? v : null);

export const supabaseRemote: Remote = {
  async userId() { return (await auth.user())?.id ?? null; },

  async heads() {
    const rows = check(await supabase().from('scene_projects').select('id,revision,deleted'));
    return (rows ?? []).map((r) => ({ id: r.id as string, revision: Number(r.revision), deleted: !!r.deleted }));
  },

  async fetch(ids) {
    if (!ids.length) return [];
    const rows = check(await supabase().from('scene_projects').select('id,revision,deleted,payload').in('id', ids));
    return (rows ?? []).map((r): RemoteRow => ({ id: r.id, revision: Number(r.revision), deleted: !!r.deleted, payload: payloadOf(r.payload) }));
  },

  async save(project, expected) {
    const r = check(await supabase().rpc('save_scene_project', { p_id: project.id, p_payload: project, p_expected: expected })) as Record<string, unknown>;
    return toResult(r);
  },

  async remove(id, expected) {
    const r = check(await supabase().rpc('delete_scene_project', { p_id: id, p_expected: expected })) as Record<string, unknown>;
    return toResult(r);
  },

  watch(userId, onChange) {
    const channel = supabase()
      .channel('scene-projects:' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scene_projects', filter: 'user_id=eq.' + userId }, onChange)
      .subscribe();
    return () => void supabase().removeChannel(channel);
  },
};

function toResult(r: Record<string, unknown>): SaveResult {
  return r.ok
    ? { ok: true, revision: Number(r.revision) }
    : { ok: false, revision: Number(r.revision), deleted: !!r.deleted, payload: payloadOf(r.payload) };
}
