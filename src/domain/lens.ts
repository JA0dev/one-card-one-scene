// 렌즈: 이야기 순서는 그대로 두고 조건에 맞는 카드를 골라낸다.
// 보드는 맞지 않는 카드를 숨기지 않고 흐리게 보여줄 수 있다.
import type { Scene, Stage } from './types';

export type Lens = { stages: Stage[]; povs: string[]; places: string[]; query: string };

export const emptyLens: Lens = { stages: [], povs: [], places: [], query: '' };

export const lensActive = (l: Lens) => l.stages.length > 0 || l.povs.length > 0 || l.places.length > 0 || l.query.trim() !== '';
export const lensFilters = (l: Lens) => l.stages.length + l.povs.length + l.places.length;

/** "윤서, 해진" 같은 입력을 이름 목록으로 */
export const names = (v: string) => v.split(/[,，、/]/).map((x) => x.trim()).filter(Boolean);

export function matches(s: Scene, l: Lens): boolean {
  if (l.stages.length && !l.stages.includes(s.stage)) return false;
  if (l.povs.length && !names(s.pov).some((n) => l.povs.includes(n))) return false;
  if (l.places.length && !names(s.place).some((n) => l.places.includes(n))) return false;
  const q = l.query.trim().toLowerCase();
  if (q && ![s.title, s.summary, s.body, s.pov, s.place, s.time, s.notes].some((t) => t.toLowerCase().includes(q))) return false;
  return true;
}

export type Facet = { value: string; count: number };

/** 입력된 시점 인물·장소 값 목록. 많이 쓴 순, 같으면 처음 나온 순. */
export function facets(scenes: Scene[]): { povs: Facet[]; places: Facet[] } {
  const tally = (pick: (s: Scene) => string) => {
    const m = new Map<string, number>();
    for (const s of scenes) for (const n of new Set(names(pick(s)))) m.set(n, (m.get(n) ?? 0) + 1);
    return [...m].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  };
  return { povs: tally((s) => s.pov), places: tally((s) => s.place) };
}

export function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}
