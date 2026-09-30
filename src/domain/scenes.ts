// 카드 조작. 모두 순수 함수이고 새 Project를 돌려준다(바뀐 게 없으면 같은 객체).
import { newScene, normalize, now, uid } from './project';
import type { Project, Scene, Stage } from './types';

export const isActive = (s: Scene) => s.trashedAt === null;
export const activeScenes = (p: Project) => p.scenes.filter(isActive);
export const trashedScenes = (p: Project) => p.scenes.filter((s) => !isActive(s));
export const findScene = (p: Project, id: string) => p.scenes.find((s) => s.id === id);

/** 본문 변경 전 모습을 이력에 남긴다(최근 50개). */
export function checkpoint(s: Scene): Scene {
  const last = s.versions[0];
  if (last && last.body === s.body && last.title === s.title) return s;
  if (!s.body && !s.title) return s;
  return { ...s, versions: [{ at: now(), title: s.title, body: s.body }, ...s.versions].slice(0, 50) };
}

function mapScenes(p: Project, ids: Iterable<string>, fn: (s: Scene) => Scene): Project {
  const set = new Set(ids);
  let changed = false;
  const scenes = p.scenes.map((s) => {
    if (!set.has(s.id)) return s;
    const next = fn(s);
    if (next !== s) changed = true;
    return next;
  });
  return changed ? { ...p, scenes } : p;
}

export function updateScene(p: Project, id: string, patch: Partial<Omit<Scene, 'id'>>, opts: { checkpoint?: boolean } = {}): Project {
  return mapScenes(p, [id], (s) => {
    const base = opts.checkpoint ? checkpoint(s) : s;
    const same = (Object.keys(patch) as (keyof Scene)[]).every((k) => base[k] === patch[k as keyof typeof patch]);
    return same && base === s ? s : { ...base, ...patch, updatedAt: now() };
  });
}

export const setStage = (p: Project, ids: string[], stage: Stage) =>
  mapScenes(p, ids, (s) => (s.stage === stage ? s : { ...s, stage, updatedAt: now() }));

/** 카드를 놓을 자리 */
export type Place = { before: string } | { after: string } | { chapterId: string | null; at: 'start' | 'end' };

/** 자리를 배열 위치와 장으로 바꾼다. list는 옮길 카드를 뺀 목록. */
function resolve(list: Scene[], place: Place): { index: number; chapterId: string | null } {
  if ('before' in place || 'after' in place) {
    const target = 'before' in place ? place.before : place.after;
    const i = list.findIndex((s) => s.id === target);
    if (i < 0) return { index: list.length, chapterId: list.at(-1)?.chapterId ?? null };
    return { index: 'before' in place ? i : i + 1, chapterId: list[i].chapterId };
  }
  const inChapter = list.map((s, i) => [s, i] as const).filter(([s]) => s.chapterId === place.chapterId);
  if (inChapter.length === 0) return { index: list.length, chapterId: place.chapterId };
  return { index: place.at === 'start' ? inChapter[0][1] : inChapter.at(-1)![1] + 1, chapterId: place.chapterId };
}

export function insertScene(p: Project, scene: Scene, place: Place): Project {
  const list = [...p.scenes];
  const { index, chapterId } = resolve(list, place);
  list.splice(index, 0, { ...scene, chapterId: p.chapters.length ? chapterId ?? p.chapters[0].id : null });
  return normalize({ ...p, scenes: list });
}

export function addScene(p: Project, place: Place, patch: Partial<Scene> = {}): { project: Project; id: string } {
  const scene = newScene(patch);
  return { project: insertScene(p, scene, place), id: scene.id };
}

/** 여러 카드를 원래 순서를 지키며 한 자리로 옮긴다. */
export function moveScenes(p: Project, ids: string[], place: Place): Project {
  const set = new Set(ids);
  if ('before' in place && set.has(place.before)) return p;
  if ('after' in place && set.has(place.after)) return p;
  const moving = p.scenes.filter((s) => set.has(s.id));
  if (moving.length === 0) return p;
  const rest = p.scenes.filter((s) => !set.has(s.id));
  const { index, chapterId } = resolve(rest, place);
  const chapter = p.chapters.length ? chapterId ?? p.chapters[0].id : null;
  const placed = moving.map((s) => (s.chapterId === chapter ? s : { ...s, chapterId: chapter, updatedAt: now() }));
  rest.splice(index, 0, ...placed);
  const next = normalize({ ...p, scenes: rest });
  return next.scenes.every((s, i) => s === p.scenes[i]) ? p : next;
}

export const moveScene = (p: Project, id: string, place: Place) => moveScenes(p, [id], place);

export function trashScenes(p: Project, ids: string[], at = now()): Project {
  return mapScenes(p, ids, (s) => (s.trashedAt ? s : { ...checkpoint(s), trashedAt: at, updatedAt: at }));
}

export function restoreScenes(p: Project, ids: string[]): Project {
  return mapScenes(p, ids, (s) => (s.trashedAt ? { ...s, trashedAt: null, updatedAt: now() } : s));
}

export function purgeScenes(p: Project, ids: string[]): Project {
  const set = new Set(ids);
  return p.scenes.some((s) => set.has(s.id)) ? { ...p, scenes: p.scenes.filter((s) => !set.has(s.id)) } : p;
}

export const emptyTrash = (p: Project) => purgeScenes(p, trashedScenes(p).map((s) => s.id));

/** 휴지통에서 days일이 지난 카드를 지운다. */
export function purgeExpired(p: Project, days: number, nowMs = Date.now()): Project {
  const limit = nowMs - days * 864e5;
  return purgeScenes(p, p.scenes.filter((s) => s.trashedAt && Date.parse(s.trashedAt) < limit).map((s) => s.id));
}

/** 사용 중인 카드 중 바로 앞·뒤 */
export function neighbor(p: Project, id: string, delta: -1 | 1): Scene | undefined {
  const list = activeScenes(p);
  const i = list.findIndex((s) => s.id === id);
  return i < 0 ? undefined : list[i + delta];
}

/** 본문 pos 위치에서 카드를 둘로 나눈다. 뒤쪽이 새 카드가 된다. */
export function splitScene(p: Project, id: string, pos: number): { project: Project; id: string } | null {
  const s = findScene(p, id);
  if (!s || pos <= 0 || pos >= s.body.length) return null;
  const head = s.body.slice(0, pos).replace(/\s+$/, '');
  const tail = s.body.slice(pos).replace(/^\s+/, '');
  if (!head || !tail) return null;
  const next = newScene({ title: (s.title || '제목 없는 씬') + ' · 다음', body: tail, stage: s.stage, pov: s.pov, place: s.place, time: s.time });
  const split = updateScene(p, id, { body: head }, { checkpoint: true });
  return { project: insertScene(split, next, { after: id }), id: next.id };
}

/** 바로 다음 카드의 본문을 이어 붙이고, 다음 카드는 휴지통으로 보낸다. */
export function mergeWithNext(p: Project, id: string): Project {
  const next = neighbor(p, id, 1);
  const s = findScene(p, id);
  if (!s || !next) return p;
  const merged = updateScene(p, id, { body: [s.body, next.body].filter((b) => b.trim()).join('\n\n') }, { checkpoint: true });
  return trashScenes(merged, [next.id]);
}

export function duplicateScene(p: Project, id: string): { project: Project; id: string } | null {
  const s = findScene(p, id);
  if (!s) return null;
  const copy: Scene = { ...s, id: uid(), title: s.title ? s.title + ' (사본)' : '', versions: [], trashedAt: null, updatedAt: now() };
  return { project: insertScene(p, copy, { after: id }), id: copy.id };
}
