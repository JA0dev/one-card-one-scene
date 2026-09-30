// 동기화 엔진. 기기(Repo)와 서버(Remote)를 오가며 작품을 맞춘다.
// 1) 기기에서 바뀐 작품을 보낸다  2) 서버에서 바뀐 작품을 받는다
// 충돌하면 서버 내용을 원래 자리에 두고, 기기 내용은 사본 작품으로 살린다.
import { josa } from '@/domain/text';
import type { LocalStore } from './local';
import type { Remote } from './remote';
import type { Repo } from './repo';

export type SyncStatus =
  | { kind: 'local' } // 로그인 전: 기기에만 저장
  | { kind: 'syncing' }
  | { kind: 'synced'; at: number }
  | { kind: 'offline' } // 기기에 저장됨, 연결되면 보냄
  | { kind: 'error'; message: string }
  | { kind: 'mismatch'; owner: string; user: string }; // 이 기기 원고가 다른 계정 것

type Listener = (s: SyncStatus) => void;

export class SyncEngine {
  status: SyncStatus = { kind: 'local' };
  private listeners = new Set<Listener>();
  private running: Promise<void> | null = null;
  private again = false;
  private timer?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private stopWatch?: () => void;
  private watching = '';
  /** 충돌 등 사용자에게 알릴 일 */
  onNotice: (message: string) => void = () => {};

  constructor(private repo: Repo, private local: LocalStore, private remote: Remote) {}

  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  private set(s: SyncStatus) { this.status = s; this.listeners.forEach((f) => f(s)); }

  /** 잠시 뒤 동기화한다. 연달아 불러도 한 번만 돈다. */
  request(delay = 1200) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), delay);
  }

  /** 지금 동기화. 이미 돌고 있으면 끝난 뒤 한 번 더 돈다. */
  run(): Promise<void> {
    if (this.running) { this.again = true; return this.running; }
    this.running = (async () => {
      try {
        do { this.again = false; await this.once(); } while (this.again);
        this.failures = 0;
      } catch (e) {
        this.failures++;
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        this.set(offline ? { kind: 'offline' } : { kind: 'error', message: e instanceof Error ? e.message : String(e) });
        if (!offline) this.request(Math.min(60_000, 5_000 * 3 ** (this.failures - 1)));
      } finally { this.running = null; }
    })();
    return this.running;
  }

  private async once() {
    const user = await this.remote.userId();
    if (!user) { this.set({ kind: 'local' }); this.unwatch(); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.set({ kind: 'offline' }); return; }

    // 이 기기 원고가 어느 계정 것인지 확인한다. 처음 로그인하면 지금 계정이 주인이 된다.
    const owner = await this.local.getMeta<string>('owner');
    if (owner && owner !== user) { this.set({ kind: 'mismatch', owner, user }); return; }
    if (!owner) await this.local.setMeta('owner', user);

    this.set({ kind: 'syncing' });
    await this.repo.flush();
    const heads = new Map((await this.remote.heads()).map((h) => [h.id, h]));

    // 1) 보내기
    for (const r of this.repo.records_()) {
      if (!r.dirty) continue;
      const head = heads.get(r.id);
      if (r.deleted) {
        if (!head || head.deleted) { this.repo.purge(r.id); continue; }
        const res = await this.remote.remove(r.id, r.cloudRev);
        if (res.ok) { this.repo.purge(r.id); heads.set(r.id, { id: r.id, revision: res.revision, deleted: true }); }
        else {
          await this.repo.fork(r.id, res.payload, res.revision);
          heads.set(r.id, { id: r.id, revision: res.revision, deleted: res.deleted });
          this.onNotice(`다른 기기에서 고친 작품이라 지우지 않았어요.`);
        }
        continue;
      }
      const res = await this.remote.save(r.project, head?.deleted ? head.revision : r.cloudRev);
      if (res.ok) {
        this.repo.markSynced(r.id, r.seq, res.revision);
        heads.set(r.id, { id: r.id, revision: res.revision, deleted: false });
      } else {
        await this.repo.fork(r.id, res.deleted ? null : res.payload, res.revision);
        this.again = true; // 살린 사본을 이어서 보낸다
        heads.set(r.id, { id: r.id, revision: res.revision, deleted: res.deleted });
        this.onNotice(`‘${r.project.title}’${josa(r.project.title, '을/를')} 두 기기에서 고쳤어요. 이 기기에서 쓴 내용은 사본 작품으로 남겼어요.`);
      }
    }

    // 2) 받기
    const want: string[] = [];
    for (const h of heads.values()) {
      const r = this.repo.get(h.id);
      if (r?.dirty) continue;
      if (h.deleted) { if (r) this.repo.dropRemote(h.id); continue; }
      if (!r || h.revision > r.cloudRev) want.push(h.id);
    }
    for (let i = 0; i < want.length; i += 20) {
      for (const row of await this.remote.fetch(want.slice(i, i + 20))) {
        if (row.deleted || !row.payload) this.repo.dropRemote(row.id);
        else this.repo.acceptRemote(row.id, row.payload, row.revision);
      }
    }

    // 3) 서버에서 사라진 작품(서버 초기화 등)은 다시 올린다
    let lost = false;
    for (const r of this.repo.records_()) if (r.cloudRev > 0 && !heads.has(r.id)) { this.repo.markUnsent(r.id); lost = true; }
    if (lost) this.again = true;

    await this.repo.flush();
    this.set({ kind: 'synced', at: Date.now() });
    this.watch(user);
  }

  private watch(user: string) {
    if (this.watching === user || !this.remote.watch) return;
    this.unwatch();
    this.watching = user;
    this.stopWatch = this.remote.watch(user, () => this.request(300));
  }
  private unwatch() { this.stopWatch?.(); this.stopWatch = undefined; this.watching = ''; }

  /** 다른 계정 원고가 남아 있을 때: 복구 사본으로 남기고 비운 뒤 지금 계정으로 받는다. */
  async adoptAccount(user: string) {
    await this.repo.clearAll();
    await this.local.setMeta('owner', user);
    await this.run();
  }

  /** 주기적 확인과 연결 복구 시 동기화. 해제 함수를 돌려준다. */
  start() {
    const tick = () => void this.run();
    const visible = () => { if (document.visibilityState === 'visible') this.request(200); };
    const every = setInterval(tick, 60_000);
    window.addEventListener('online', tick);
    window.addEventListener('offline', () => this.set({ kind: 'offline' }));
    document.addEventListener('visibilitychange', visible);
    this.request(300);
    return () => { clearInterval(every); window.removeEventListener('online', tick); document.removeEventListener('visibilitychange', visible); this.unwatch(); };
  }
}
