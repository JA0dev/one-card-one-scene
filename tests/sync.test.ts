import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LocalStore } from '@/data/local';
import type { Remote, RemoteRow, SaveResult } from '@/data/remote';
import { Repo } from '@/data/repo';
import { SyncEngine } from '@/data/sync';
import { newProject, newScene } from '@/domain/project';
import { updateScene } from '@/domain/scenes';
import type { Project } from '@/domain/types';

/** 서버 흉내: Supabase 함수와 같은 규칙(번호표가 맞을 때만 저장) */
class FakeServer {
  rows = new Map<string, { owner: string; payload: Project; revision: number; deleted: boolean }>();
  as(user: string | null): Remote {
    return {
      userId: async () => user,
      heads: async () => [...this.rows].filter(([, r]) => r.owner === user).map(([id, r]) => ({ id, revision: r.revision, deleted: r.deleted })),
      fetch: async (ids) => ids.flatMap((id): RemoteRow[] => { const r = this.rows.get(id); return r ? [{ id, revision: r.revision, deleted: r.deleted, payload: structuredClone(r.payload) }] : []; }),
      save: async (p, expected): Promise<SaveResult> => {
        const r = this.rows.get(p.id);
        if (!r) { this.rows.set(p.id, { owner: user!, payload: structuredClone(p), revision: 1, deleted: false }); return { ok: true, revision: 1 }; }
        if (r.revision !== expected) return { ok: false, revision: r.revision, deleted: r.deleted, payload: r.deleted ? null : structuredClone(r.payload) };
        Object.assign(r, { payload: structuredClone(p), revision: r.revision + 1, deleted: false });
        return { ok: true, revision: r.revision };
      },
      remove: async (id, expected): Promise<SaveResult> => {
        const r = this.rows.get(id);
        if (!r) return { ok: true, revision: 0 };
        if (r.revision !== expected) return { ok: false, revision: r.revision, deleted: r.deleted, payload: structuredClone(r.payload) };
        Object.assign(r, { deleted: true, revision: r.revision + 1 });
        return { ok: true, revision: r.revision };
      },
    };
  }
}

let n = 0;
async function device(server: FakeServer, user: string | null, seed: Project[] = []) {
  const local = new LocalStore('test-' + ++n);
  const repo = new Repo(local);
  await repo.load(() => seed);
  const sync = new SyncEngine(repo, local, server.as(user));
  const notices: string[] = [];
  sync.onNotice = (m) => notices.push(m);
  return { local, repo, sync, notices, titles: () => repo.getState().projects.map((p) => p.title).sort() };
}

const project = (title: string) => newProject({ title, scenes: [newScene({ title: '첫 장면' })] });
const rename = (p: Project, title: string) => ({ ...p, title });

describe('기기 저장', () => {
  it('고친 작품은 다시 열어도 남아 있다', async () => {
    const local = new LocalStore('persist');
    const repo = new Repo(local);
    const p = project('A');
    await repo.load(() => [p]);
    repo.update(p.id, (x) => updateScene(x, x.scenes[0].id, { body: '안녕하세요' }));
    await repo.flush();
    const again = new Repo(local);
    await again.load(() => []);
    expect(again.getState().projects[0].scenes[0].body).toBe('안녕하세요');
    expect(again.get(p.id)!.dirty).toBe(true);
  });
});

describe('동기화', () => {
  it('로그인 전에는 기기에만 둔다', async () => {
    const s = new FakeServer();
    const a = await device(s, null, [project('A')]);
    await a.sync.run();
    expect(a.sync.status.kind).toBe('local');
    expect(s.rows.size).toBe(0);
  });

  it('두 기기가 같은 작품 목록을 본다', async () => {
    const s = new FakeServer();
    const a = await device(s, 'u1', [project('A')]);
    await a.sync.run();
    const b = await device(s, 'u1', [project('B')]);
    await b.sync.run();
    await a.sync.run();
    expect(a.titles()).toEqual(['A', 'B']);
    expect(b.titles()).toEqual(['A', 'B']);
    expect(a.sync.status.kind).toBe('synced');
  });

  it('다른 작품을 동시에 고쳐도 충돌하지 않는다', async () => {
    const s = new FakeServer();
    const [pa, pb] = [project('A'), project('B')];
    const a = await device(s, 'u1', [pa, pb]);
    await a.sync.run();
    const b = await device(s, 'u1');
    await b.sync.run();
    a.repo.update(pa.id, (p) => rename(p, 'A2'));
    b.repo.update(pb.id, (p) => rename(p, 'B2'));
    await a.sync.run(); await b.sync.run(); await a.sync.run();
    expect(a.titles()).toEqual(['A2', 'B2']);
    expect(b.titles()).toEqual(['A2', 'B2']);
    expect(a.notices).toEqual([]);
  });

  it('같은 작품을 동시에 고치면 양쪽 다 남긴다', async () => {
    const s = new FakeServer();
    const p = project('A');
    const a = await device(s, 'u1', [p]);
    await a.sync.run();
    const b = await device(s, 'u1');
    await b.sync.run();
    a.repo.update(p.id, (x) => rename(x, '폰에서'));
    b.repo.update(p.id, (x) => rename(x, 'PC에서'));
    await a.sync.run();
    await b.sync.run();
    expect(b.titles()).toEqual(['PC에서 · 이 기기 사본', '폰에서']);
    expect(b.notices).toHaveLength(1);
    await a.sync.run();
    expect(a.titles()).toEqual(['PC에서 · 이 기기 사본', '폰에서']);
    expect((await b.local.recoveries())[0].project.title).toBe('PC에서');
  });

  it('보내는 동안 또 고치면 다음에 다시 보낸다', async () => {
    const s = new FakeServer();
    const p = project('A');
    const a = await device(s, 'u1', [p]);
    const seq = a.repo.get(p.id)!.seq;
    a.repo.update(p.id, (x) => rename(x, 'A2'));
    a.repo.markSynced(p.id, seq, 1);
    expect(a.repo.get(p.id)!.dirty).toBe(true);
  });

  it('작품 삭제가 다른 기기에도 반영된다', async () => {
    const s = new FakeServer();
    const p = project('A');
    const a = await device(s, 'u1', [p, project('B')]);
    await a.sync.run();
    const b = await device(s, 'u1');
    await b.sync.run();
    await a.repo.remove(p.id);
    await a.sync.run();
    await b.sync.run();
    expect(a.titles()).toEqual(['B']);
    expect(b.titles()).toEqual(['B']);
    expect(s.rows.get(p.id)!.deleted).toBe(true);
  });

  it('다른 계정의 원고가 있으면 멈추고, 넘기기로 하면 복구 사본을 남기고 바꾼다', async () => {
    const s = new FakeServer();
    const a = await device(s, 'u1', [project('A')]);
    await a.sync.run();
    const other = new SyncEngine(a.repo, a.local, s.as('u2'));
    await other.run();
    expect(other.status.kind).toBe('mismatch');
    await other.adoptAccount('u2');
    expect(a.titles()).toEqual([]);
    expect((await a.local.recoveries()).map((r) => r.project.title)).toContain('A');
    expect(other.status.kind).toBe('synced');
  });
});
