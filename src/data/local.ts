// 기기 저장소(IndexedDB). 작품마다 한 레코드이고, 서버와 맞추기 위한 표시를 함께 둔다.
import { fromV1, isProject, isV1Workspace } from '@/domain/project';
import type { Project } from '@/domain/types';

export type LocalRecord = {
  id: string;
  project: Project;
  /** 마지막으로 서버와 맞춘 번호표. 0이면 아직 서버에 없다. */
  cloudRev: number;
  /** 서버에 보내야 할 변경이 있다 */
  dirty: boolean;
  /** 지웠지만 서버에 아직 알리지 않았다 */
  deleted: boolean;
  /** 기기에서 고칠 때마다 1씩 오른다. 보내는 동안 또 고쳤는지 확인할 때 쓴다. */
  seq: number;
};

export type Recovery = { key: number; project: Project; at: string; reason: string };

const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error ?? new Error('기기 저장이 취소되었습니다.')); });

export class LocalStore {
  private db?: Promise<IDBDatabase>;
  constructor(readonly name = 'scene-card') {}

  private open() {
    return (this.db ??= new Promise<IDBDatabase>((res, rej) => {
      const q = indexedDB.open(this.name, 1);
      q.onupgradeneeded = () => {
        q.result.createObjectStore('projects', { keyPath: 'id' });
        q.result.createObjectStore('meta');
        q.result.createObjectStore('recovery', { autoIncrement: true });
      };
      q.onsuccess = () => res(q.result);
      q.onerror = () => { this.db = undefined; rej(q.error); };
    }));
  }

  async loadAll(): Promise<LocalRecord[]> {
    const db = await this.open();
    const all = await req<LocalRecord[]>(db.transaction('projects').objectStore('projects').getAll());
    return all.filter((r) => isProject(r.project));
  }

  async put(records: LocalRecord[]) {
    if (!records.length) return;
    const db = await this.open();
    const tx = db.transaction('projects', 'readwrite');
    for (const r of records) tx.objectStore('projects').put(r);
    await done(tx);
  }

  async remove(ids: string[]) {
    if (!ids.length) return;
    const db = await this.open();
    const tx = db.transaction('projects', 'readwrite');
    for (const id of ids) tx.objectStore('projects').delete(id);
    await done(tx);
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const db = await this.open();
    return req<T | undefined>(db.transaction('meta').objectStore('meta').get(key));
  }

  async setMeta(key: string, value: unknown) {
    const db = await this.open();
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put(value, key);
    await done(tx);
  }

  /** 덮어쓰기 전에 사본을 남긴다. 최근 30개만 둔다. */
  async keep(project: Project, reason: string) {
    const db = await this.open();
    const tx = db.transaction('recovery', 'readwrite');
    const store = tx.objectStore('recovery');
    store.add({ project, at: new Date().toISOString(), reason });
    const keys = await req(store.getAllKeys());
    for (const k of keys.slice(0, Math.max(0, keys.length - 30))) store.delete(k);
    await done(tx);
  }

  async recoveries(): Promise<Recovery[]> {
    const db = await this.open();
    const store = db.transaction('recovery').objectStore('recovery');
    const [keys, values] = await Promise.all([req(store.getAllKeys()), req<Omit<Recovery, 'key'>[]>(store.getAll())]);
    return values.map((v, i) => ({ ...v, key: keys[i] as number })).reverse();
  }

  /** 예전 앱(scene-studio-v1)에 원고가 있으면 한 번 옮겨 온다. 예전 저장소는 지우지 않는다. */
  async legacyProjects(): Promise<Project[]> {
    if (typeof indexedDB.databases === 'function') {
      const list = await indexedDB.databases();
      if (!list.some((d) => d.name === 'scene-studio-v1')) return [];
    }
    return new Promise((res) => {
      const q = indexedDB.open('scene-studio-v1');
      q.onupgradeneeded = () => { q.transaction?.abort(); };
      q.onerror = () => res([]);
      q.onsuccess = () => {
        const db = q.result;
        if (!db.objectStoreNames.contains('state')) { db.close(); res([]); return; }
        const g = db.transaction('state').objectStore('state').get('main');
        g.onsuccess = () => { db.close(); const data = g.result?.data; res(isV1Workspace(data) ? fromV1(data) : []); };
        g.onerror = () => { db.close(); res([]); };
      };
    });
  }
}
