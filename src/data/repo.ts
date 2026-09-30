// 작품 저장소. 메모리의 작품 목록을 들고 있고, 바뀌면 기기에 저장하고 구독자에게 알린다.
// 화면(React)도 동기화도 이 객체만 거쳐서 작품을 읽고 바꾼다.
import { normalize, now, uid } from '@/domain/project';
import type { Project } from '@/domain/types';
import type { LocalRecord, LocalStore } from './local';

export type RepoState = { ready: boolean; projects: Project[]; error: string };

type Listener = () => void;

export class Repo {
  private records = new Map<string, LocalRecord>();
  private state: RepoState = { ready: false, projects: [], error: '' };
  private listeners = new Set<Listener>();
  private writing = Promise.resolve();
  private channel?: BroadcastChannel;
  /** 기기에서 작품을 고칠 때마다 불린다(동기화 예약용) */
  onLocalChange: () => void = () => {};

  constructor(readonly local: LocalStore) {}

  // ── 구독(React의 useSyncExternalStore와 맞춘 모양) ──
  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getState = () => this.state;
  private emit() {
    const projects = [...this.records.values()].filter((r) => !r.deleted).map((r) => r.project).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    this.state = { ...this.state, ready: true, projects };
    this.listeners.forEach((f) => f());
  }
  private fail(e: unknown) {
    this.state = { ...this.state, error: e instanceof Error ? e.message : String(e) };
    this.listeners.forEach((f) => f());
  }

  async load(seed: () => Project[]) {
    let all = await this.local.loadAll();
    if (all.length === 0) {
      const legacy = await this.local.legacyProjects().catch(() => []);
      const projects = legacy.length ? legacy : seed();
      all = projects.map((p) => ({ id: p.id, project: normalize(p), cloudRev: 0, dirty: true, deleted: false, seq: 1 }));
      await this.local.put(all);
    }
    this.records = new Map(all.map((r) => [r.id, r]));
    this.listenOtherTabs();
    this.emit();
  }

  /** 다른 탭에서 저장하면 그 작품을 다시 읽는다. */
  private listenOtherTabs() {
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel('scene-card:' + this.local.name);
    this.channel.onmessage = async () => {
      const all = await this.local.loadAll();
      this.records = new Map(all.map((r) => [r.id, r]));
      this.emit();
    };
  }

  /** 저장은 한 줄로 세워 차례대로 한다. */
  private persist(put: LocalRecord[], remove: string[] = []) {
    this.writing = this.writing
      .then(async () => { await this.local.put(put); await this.local.remove(remove); this.channel?.postMessage('changed'); })
      .catch((e) => this.fail(new Error('기기에 저장하지 못했어요. 백업을 내려받아 주세요. (' + (e as Error).message + ')')));
    return this.writing;
  }
  flush = () => this.writing;

  records_() { return [...this.records.values()]; }
  get(id: string) { return this.records.get(id); }

  // ── 화면에서 쓰는 변경 ──
  update(id: string, fn: (p: Project) => Project): boolean {
    const r = this.records.get(id);
    if (!r || r.deleted) return false;
    const next = fn(r.project);
    if (next === r.project) return false;
    const rec = { ...r, project: { ...normalize(next), updatedAt: now() }, dirty: true, seq: r.seq + 1 };
    this.records.set(id, rec);
    this.emit();
    void this.persist([rec]);
    this.onLocalChange();
    return true;
  }

  create(project: Project) {
    const rec: LocalRecord = { id: project.id, project: normalize(project), cloudRev: 0, dirty: true, deleted: false, seq: 1 };
    this.records.set(rec.id, rec);
    this.emit();
    void this.persist([rec]);
    this.onLocalChange();
  }

  /** 작품 삭제. 서버에 있던 작품이면 삭제 표시만 해 두고 동기화 때 서버에서도 지운다. */
  async remove(id: string) {
    const r = this.records.get(id);
    if (!r) return;
    await this.local.keep(r.project, '작품 삭제');
    if (r.cloudRev === 0) { this.records.delete(id); this.emit(); await this.persist([], [id]); return; }
    const rec = { ...r, deleted: true, dirty: true, seq: r.seq + 1 };
    this.records.set(id, rec);
    this.emit();
    await this.persist([rec]);
    this.onLocalChange();
  }

  /** 한 작품을 통째로 되돌린다(되돌리기용). */
  restore(project: Project) { this.update(project.id, () => project); }

  // ── 동기화에서 쓰는 변경 ──
  markSynced(id: string, seq: number, revision: number) {
    const r = this.records.get(id);
    if (!r) return;
    const rec = { ...r, cloudRev: revision, dirty: r.seq !== seq ? r.dirty : false };
    this.records.set(id, rec);
    void this.persist([rec]);
  }

  /** 서버 내용으로 바꾼다. 기기에서 고친 게 남아 있으면 건드리지 않는다. */
  acceptRemote(id: string, project: Project, revision: number) {
    const r = this.records.get(id);
    if (r?.dirty) return false;
    const rec: LocalRecord = { id, project: normalize(project), cloudRev: revision, dirty: false, deleted: false, seq: (r?.seq ?? 0) + 1 };
    this.records.set(id, rec);
    this.emit();
    void this.persist([rec]);
    return true;
  }

  /** 서버에서 지워진 작품. 기기에서 고친 게 없으면 기기에서도 지운다. */
  dropRemote(id: string) {
    const r = this.records.get(id);
    if (!r || r.dirty) return false;
    this.records.delete(id);
    this.emit();
    void this.persist([], [id]);
    return true;
  }

  /** 서버에 없는 작품이 된 경우(서버 초기화 등): 다시 올리도록 표시 */
  markUnsent(id: string) {
    const r = this.records.get(id);
    if (!r) return;
    const rec = { ...r, cloudRev: 0, dirty: true };
    this.records.set(id, rec);
    void this.persist([rec]);
  }

  /** 삭제를 서버에 알렸으니 기기에서도 완전히 지운다. */
  purge(id: string) {
    this.records.delete(id);
    void this.persist([], [id]);
  }

  /**
   * 충돌: 같은 작품을 두 기기에서 고쳤다. 원래 자리는 서버 내용으로 두고,
   * 이 기기에서 고친 내용은 '· 이 기기 사본'이라는 새 작품으로 살린다.
   */
  async fork(id: string, remote: Project | null, revision: number): Promise<string | null> {
    const r = this.records.get(id);
    if (!r) return null;
    await this.local.keep(r.project, '동기화 충돌');
    const copy: Project = r.deleted ? r.project : {
      ...r.project, id: uid(), title: r.project.title + ' · 이 기기 사본', createdAt: now(), updatedAt: now(),
    };
    const put: LocalRecord[] = [];
    const remove: string[] = [];
    if (remote) {
      const rec: LocalRecord = { id, project: normalize(remote), cloudRev: revision, dirty: false, deleted: false, seq: r.seq + 1 };
      this.records.set(id, rec);
      put.push(rec);
    } else {
      this.records.delete(id);
      remove.push(id);
    }
    let copyId: string | null = null;
    if (!r.deleted) {
      const rec: LocalRecord = { id: copy.id, project: copy, cloudRev: 0, dirty: true, deleted: false, seq: 1 };
      this.records.set(copy.id, rec);
      put.push(rec);
      copyId = copy.id;
    }
    this.emit();
    await this.persist(put, remove);
    return copyId;
  }

  /** 다른 계정으로 바꿀 때: 지금 원고를 복구 사본으로 남기고 비운다. */
  async clearAll() {
    for (const r of this.records.values()) if (!r.deleted) await this.local.keep(r.project, '계정 변경');
    const ids = [...this.records.keys()];
    this.records.clear();
    this.emit();
    await this.persist([], ids);
  }
}
