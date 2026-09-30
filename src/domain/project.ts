import { SCHEMA, STAGES, type Chapter, type Project, type Scene, type Stage } from './types';

export const uid = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : // RFC 4122 v4 형식. 서버의 uuid 열에 그대로 들어간다.
      (() => {
        const b = crypto.getRandomValues(new Uint8Array(16));
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
      })();

export const now = () => new Date().toISOString();

export function newScene(patch: Partial<Scene> = {}): Scene {
  return {
    id: uid(), title: '', summary: '', body: '', notes: '', pov: '', place: '', time: '',
    stage: 'idea', chapterId: null, trashedAt: null, versions: [], updatedAt: now(), ...patch,
  };
}

export const newChapter = (title = ''): Chapter => ({ id: uid(), title });

export function newProject(patch: Partial<Project> = {}): Project {
  const at = now();
  return { schema: SCHEMA, id: uid(), title: '제목 없는 이야기', subtitle: '', chapters: [], scenes: [newScene()], createdAt: at, updatedAt: at, ...patch };
}

/**
 * 불변식을 맞춘다.
 * - 장이 없으면 모든 카드의 chapterId는 null
 * - 장이 있으면 모든 카드는 존재하는 장에 속하고, scenes는 장 순서대로 모여 있다(같은 장 안의 순서는 유지)
 */
export function normalize(p: Project): Project {
  if (p.chapters.length === 0) {
    return p.scenes.every((s) => s.chapterId === null) ? p : { ...p, scenes: p.scenes.map((s) => (s.chapterId === null ? s : { ...s, chapterId: null })) };
  }
  const rank = new Map(p.chapters.map((c, i) => [c.id, i]));
  const first = p.chapters[0].id;
  const fixed = p.scenes.map((s) => (s.chapterId && rank.has(s.chapterId) ? s : { ...s, chapterId: first }));
  const sorted = fixed
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank.get(a.s.chapterId!)! - rank.get(b.s.chapterId!)! || a.i - b.i)
    .map((x) => x.s);
  const same = sorted.every((s, i) => s === p.scenes[i]);
  return same ? p : { ...p, scenes: sorted };
}

const str = (v: unknown) => typeof v === 'string';

export function isProject(v: unknown): v is Project {
  const p = v as Project;
  return (
    !!p && p.schema === SCHEMA && str(p.id) && str(p.title) && str(p.subtitle) && str(p.createdAt) && str(p.updatedAt) &&
    Array.isArray(p.chapters) && p.chapters.every((c) => str(c.id) && str(c.title)) &&
    Array.isArray(p.scenes) &&
    p.scenes.every(
      (s) =>
        ['id', 'title', 'summary', 'body', 'notes', 'pov', 'place', 'time', 'updatedAt'].every((k) => str((s as Record<string, unknown>)[k])) &&
        STAGES.includes(s.stage) && (s.chapterId === null || str(s.chapterId)) && (s.trashedAt === null || str(s.trashedAt)) &&
        Array.isArray(s.versions) && s.versions.every((x) => str(x.at) && str(x.title) && str(x.body)),
    ) &&
    new Set(p.scenes.map((s) => s.id)).size === p.scenes.length
  );
}

// ── 예전(schema 1) 원고 옮기기 ────────────────────────────────────────────
type V1Scene = { id: string; title: string; summary: string; body: string; notes: string; pov: string; place: string; time: string; stage: string; bucket: string; versions: { at: string; body: string; title: string }[] };
type V1Workspace = { schema: 1; projects: { id: string; title: string; subtitle: string; scenes: V1Scene[] }[] };

const V1_STAGE: Record<string, Stage> = { 구상: 'idea', 초고: 'draft', 퇴고: 'revise', 완료: 'done' };

export function isV1Workspace(v: unknown): v is V1Workspace {
  const w = v as V1Workspace;
  return !!w && w.schema === 1 && Array.isArray(w.projects) && w.projects.every((p) => str(p.id) && Array.isArray(p.scenes));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fromV1(w: V1Workspace): Project[] {
  const at = now();
  return w.projects.map((p) => ({
    schema: SCHEMA, id: UUID.test(p.id) ? p.id : uid(), title: p.title, subtitle: p.subtitle ?? '', chapters: [], createdAt: at, updatedAt: at,
    scenes: p.scenes.map((s) => ({
      id: s.id, title: s.title, summary: s.summary, body: s.body, notes: s.notes, pov: s.pov, place: s.place, time: s.time,
      stage: V1_STAGE[s.stage] ?? 'idea', chapterId: null, trashedAt: s.bucket === 'active' ? null : at,
      versions: s.versions ?? [], updatedAt: at,
    })),
  }));
}
