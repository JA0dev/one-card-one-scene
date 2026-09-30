// 장 조작. 장은 카드 순서 사이에 꽂힌 경계다. 장이 없던 작품에 처음 장을 만들면
// 기존 카드는 모두 1장에 들어간다.
import { newChapter, normalize, now } from './project';
import { activeScenes, isActive, trashScenes } from './scenes';
import type { Chapter, Project, Scene } from './types';

export const chapterIndex = (p: Project, id: string | null) => p.chapters.findIndex((c) => c.id === id);
export const chapterLabel = (p: Project, id: string | null) => {
  const i = chapterIndex(p, id);
  return i < 0 ? '' : `${i + 1}장`;
};
export const chapterTitle = (c: Chapter) => c.title.trim() || '제목 없는 장';

/** 장이 없으면 모든 카드를 담은 1장을 만든다. */
export function ensureChapters(p: Project): Project {
  if (p.chapters.length) return p;
  const first = newChapter();
  return normalize({ ...p, chapters: [first], scenes: p.scenes.map((s) => ({ ...s, chapterId: first.id })) });
}

/** 장별 카드 묶음(휴지통 제외). 장이 없으면 null 장 하나. */
export function groupByChapter(p: Project, scenes: Scene[] = activeScenes(p)): { chapter: Chapter | null; scenes: Scene[] }[] {
  if (!p.chapters.length) return [{ chapter: null, scenes }];
  return p.chapters.map((chapter) => ({ chapter, scenes: scenes.filter((s) => s.chapterId === chapter.id) }));
}

/** 새 장. after를 주면 그 뒤에, 없으면 맨 끝에. */
export function addChapter(p: Project, opts: { after?: string; before?: string; title?: string } = {}): { project: Project; id: string } {
  const hadNone = p.chapters.length === 0;
  const base = ensureChapters(p);
  const c = newChapter(opts.title ?? '');
  // 빈 작품에 처음 만드는 장은 ensureChapters가 만든 1장 그대로 쓴다.
  if (hadNone && activeScenes(p).length === 0 && !opts.after && !opts.before) {
    const only = base.chapters[0];
    return { project: { ...base, chapters: [{ ...only, title: opts.title ?? '' }] }, id: only.id };
  }
  const chapters = [...base.chapters];
  const at = opts.before ? chapterIndex(base, opts.before) : opts.after ? chapterIndex(base, opts.after) + 1 : chapters.length;
  chapters.splice(at < 0 ? chapters.length : at, 0, c);
  return { project: normalize({ ...base, chapters }), id: c.id };
}

/** sceneId 카드부터 그 장의 끝까지를 새 장으로 나눈다. 장이 없으면 앞부분이 1장이 된다. */
export function splitChapterAt(p: Project, sceneId: string): { project: Project; id: string } | null {
  const base = ensureChapters(p);
  const scene = base.scenes.find((s) => s.id === sceneId);
  if (!scene || !isActive(scene)) return null;
  const inChapter = base.scenes.filter((s) => s.chapterId === scene.chapterId);
  const from = inChapter.findIndex((s) => s.id === sceneId);
  if (inChapter.slice(0, from).filter(isActive).length === 0) return null; // 이미 장의 첫 카드
  const c = newChapter();
  const moving = new Set(inChapter.slice(from).map((s) => s.id));
  const chapters = [...base.chapters];
  chapters.splice(chapterIndex(base, scene.chapterId) + 1, 0, c);
  const scenes = base.scenes.map((s) => (moving.has(s.id) ? { ...s, chapterId: c.id, updatedAt: now() } : s));
  return { project: normalize({ ...base, chapters, scenes }), id: c.id };
}

export function renameChapter(p: Project, id: string, title: string): Project {
  return { ...p, chapters: p.chapters.map((c) => (c.id === id ? { ...c, title } : c)) };
}

/** 장의 카드를 앞 장(첫 장이면 다음 장)으로 넘기고 장을 없앤다. 마지막 장이면 장 구분이 사라진다. */
function dissolve(p: Project, id: string): Project {
  const i = chapterIndex(p, id);
  if (i < 0) return p;
  if (p.chapters.length === 1) return normalize({ ...p, chapters: [] });
  const target = p.chapters[i > 0 ? i - 1 : 1].id;
  const scenes = p.scenes.map((s) => (s.chapterId === id ? { ...s, chapterId: target } : s));
  return normalize({ ...p, chapters: p.chapters.filter((c) => c.id !== id), scenes });
}

export function mergeWithPrevious(p: Project, id: string): Project {
  return chapterIndex(p, id) > 0 ? dissolve(p, id) : p;
}

/** 장을 지운다. trash면 그 장의 카드도 휴지통으로, 아니면 카드는 앞 장으로. */
export function removeChapter(p: Project, id: string, opts: { trash: boolean }): Project {
  const ids = p.scenes.filter((s) => s.chapterId === id && isActive(s)).map((s) => s.id);
  return dissolve(opts.trash ? trashScenes(p, ids) : p, id);
}

export function moveChapter(p: Project, id: string, to: number): Project {
  const from = chapterIndex(p, id);
  if (from < 0 || from === to || to < 0 || to >= p.chapters.length) return p;
  const chapters = [...p.chapters];
  chapters.splice(to, 0, chapters.splice(from, 1)[0]);
  return normalize({ ...p, chapters });
}

/** 장 구분을 모두 없앤다. 카드 순서는 그대로. */
export const clearChapters = (p: Project) => (p.chapters.length ? normalize({ ...p, chapters: [] }) : p);
