// 앱 전체가 함께 쓰는 객체들: 기기 저장소, 작품 저장소, 동기화, 화면 상태, 알림.
import { useSyncExternalStore } from 'react';
import type { User } from '@supabase/supabase-js';
import { LocalStore } from '@/data/local';
import { Repo } from '@/data/repo';
import { SyncEngine, type SyncStatus } from '@/data/sync';
import { auth, supabaseRemote } from '@/data/supabase';
import { emptyLens, type Lens } from '@/domain/lens';
import { newProject } from '@/domain/project';
import { purgeExpired } from '@/domain/scenes';
import { sampleProject } from '@/domain/sample';
import type { Project } from '@/domain/types';
import { prefs } from './prefs';
import { createStore } from './store';

export const TRASH_DAYS = 30;

export const local = new LocalStore();
export const repo = new Repo(local);
export const sync = new SyncEngine(repo, local, supabaseRemote);
repo.onLocalChange = () => sync.request();

// ── 화면 상태(저장하지 않음) ─────────────────────────────────────────────
export type DialogState =
  | null
  | { kind: 'settings'; page: 'home' | 'view' | 'backup' | 'account' }
  | { kind: 'project' }
  | { kind: 'chapters' }
  | { kind: 'notes'; sceneId: string }
  | { kind: 'history'; sceneId: string }
  | { kind: 'move'; sceneIds: string[] }
  | { kind: 'jump' }
  | { kind: 'outline' };

export type Ui = {
  lens: Lens;
  bucket: 'active' | 'trash';
  selection: string[];
  editingId: string;
  /** 새로 만들어 편집 중인 카드: Esc로 취소하면 지운다 */
  draftId: string;
  editingChapterId: string;
  dialog: DialogState;
};

export const ui = createStore<Ui>({ lens: emptyLens, bucket: 'active', selection: [], editingId: '', draftId: '', editingChapterId: '', dialog: null });

// ── 알림과 되돌리기 ───────────────────────────────────────────────────────
export type Toast = { id: number; message: string; action?: { label: string; run: () => void } };
export const toasts = createStore<{ list: Toast[] }>({ list: [] });
let toastId = 0;

export function notify(message: string, action?: Toast['action']) {
  const t = { id: ++toastId, message, action };
  toasts.set((s) => ({ list: [...s.list.slice(-2), t] }));
  setTimeout(() => toasts.set((s) => ({ list: s.list.filter((x) => x.id !== t.id) })), action ? 6500 : 3500);
}
export const dismiss = (id: number) => toasts.set((s) => ({ list: s.list.filter((x) => x.id !== id) }));

sync.onNotice = (m) => notify(m);

// ── 구독 훅 ───────────────────────────────────────────────────────────────
export const useRepo = () => useSyncExternalStore(repo.subscribe, repo.getState);

export function useProject(): Project | undefined {
  const { projects } = useRepo();
  const id = prefs.use((p) => p.projectId);
  return projects.find((p) => p.id === id) ?? projects[0];
}

let status: SyncStatus = sync.status;
sync.subscribe((s) => { status = s; });
export const useSyncStatus = () => useSyncExternalStore(sync.subscribe, () => status);

let user: User | null = null;
const userListeners = new Set<() => void>();
export const useUser = () => useSyncExternalStore((f) => { userListeners.add(f); return () => userListeners.delete(f); }, () => user);

// ── 시작 ──────────────────────────────────────────────────────────────────
let booting: Promise<void> | undefined;
/** 한 번만 실행된다(개발 모드에서 효과가 두 번 불려도). */
export const boot = () => (booting ??= start());

async function start() {
  // 처음 여는 기기에는 둘러볼 수 있게 예시 작품을 둔다.
  await repo.load(() => [sampleProject()]);
  if (repo.getState().projects.length === 0) repo.create(newProject());
  // 휴지통에서 오래된 카드 정리
  for (const p of repo.getState().projects) repo.update(p.id, (x) => purgeExpired(x, TRASH_DAYS));
  user = await auth.user().catch(() => null);
  userListeners.forEach((f) => f());
  auth.onChange((u) => {
    const changed = u?.id !== user?.id;
    user = u;
    userListeners.forEach((f) => f());
    if (changed) sync.request(100);
  });
  sync.start();
}
