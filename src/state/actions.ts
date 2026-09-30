// 사용자 동작. 화면은 작품을 직접 고치지 않고 여기 함수를 부른다.
// 되돌릴 수 있는 동작은 바꾸기 전 작품을 들고 있다가 알림의 '되돌리기'로 되살린다.
import * as ch from '@/domain/chapters';
import { lensActive, matches } from '@/domain/lens';
import { newProject } from '@/domain/project';
import { sampleProject } from '@/domain/sample';
import * as sc from '@/domain/scenes';
import { josa, quote } from '@/domain/text';
import type { Project, Scene, Stage } from '@/domain/types';
import { STAGE_LABEL } from '@/domain/types';
import { local, notify, repo, ui } from './app';
import { go } from './nav';
import { prefs } from './prefs';

export const currentProject = (): Project | undefined => {
  const { projects } = repo.getState();
  return projects.find((p) => p.id === prefs.get().projectId) ?? projects[0];
};

/** 작품을 고친다. label을 주면 되돌리기 알림을 띄운다. */
export function edit(fn: (p: Project) => Project, label?: string) {
  const before = currentProject();
  if (!before) return false;
  const changed = repo.update(before.id, fn);
  if (changed && label) notify(label, { label: '되돌리기', run: () => { repo.restore(before); notify('되돌렸어요.'); } });
  return changed;
}

/** 입력 중 자주 부르는 수정(되돌리기 알림 없음). 본문은 1분마다 이력에 남긴다. */
const lastCheckpoint = new Map<string, number>();
export function patchScene(id: string, patch: Partial<Scene>) {
  const needs = 'body' in patch && Date.now() - (lastCheckpoint.get(id) ?? 0) > 60_000;
  if (needs) lastCheckpoint.set(id, Date.now());
  edit((p) => sc.updateScene(p, id, patch, { checkpoint: needs }));
}

// ── 카드 ───────────────────────────────────────────────────────────────────
/** 새 카드를 보드에서 바로 편집 상태로 연다. */
export function addCard(place?: sc.Place) {
  const p = currentProject();
  if (!p) return;
  const where: sc.Place = place ?? { chapterId: p.chapters.at(-1)?.id ?? null, at: 'end' };
  const r = sc.addScene(p, where);
  edit(() => r.project);
  const { lens } = ui.get();
  if (lensActive(lens) && !matches(r.project.scenes.find((s) => s.id === r.id)!, lens) && prefs.get().lensMode === 'hide') {
    ui.set({ lens: { ...lens, stages: [], povs: [], places: [], query: '' } });
    notify('렌즈를 끄고 새 카드를 보여줘요.');
  }
  ui.set({ bucket: 'active', editingId: r.id, draftId: r.id, selection: [] });
  return r.id;
}

/** 집필 화면에서 지금 카드 다음에 새 카드를 만들고 바로 연다. */
export function addCardAfterAndWrite(id: string) {
  const p = currentProject();
  if (!p) return;
  const r = sc.addScene(p, { after: id });
  edit(() => r.project);
  go({ view: 'write', sceneId: r.id });
}

export const restoreVersion = (id: string, index: number) => edit((p) => sc.restoreVersion(p, id, index), '이 이력으로 되돌렸어요.');

export function openScene(id: string) { go({ view: 'write', sceneId: id }); }

export function setStage(ids: string[], stage: Stage) {
  edit((p) => sc.setStage(p, ids, stage), ids.length > 1 ? `${ids.length}장을 ${STAGE_LABEL[stage]} 단계로 바꿨어요.` : undefined);
}

export function trash(ids: string[]) {
  const p = currentProject();
  const first = p && sc.findScene(p, ids[0]);
  const label = ids.length > 1 ? `카드 ${ids.length}장을 휴지통으로 옮겼어요.` : `${quote(first?.title ?? '')}${josa(first?.title || '제목 없는 씬', '을/를')} 휴지통으로 옮겼어요.`;
  edit((x) => sc.trashScenes(x, ids), label);
  ui.set((s) => ({ selection: s.selection.filter((x) => !ids.includes(x)) }));
}

export function restore(ids: string[]) { edit((p) => sc.restoreScenes(p, ids), '되돌렸어요.'); }

export async function purge(ids: string[]) {
  const p = currentProject();
  if (!p) return;
  await local.keep(p, '영구 삭제 전');
  edit((x) => sc.purgeScenes(x, ids), ids.length > 1 ? `${ids.length}장을 영구 삭제했어요.` : '영구 삭제했어요.');
}

export async function emptyTrash() {
  const p = currentProject();
  if (!p) return;
  await local.keep(p, '휴지통 비우기 전');
  edit(sc.emptyTrash, '휴지통을 비웠어요.');
  ui.set({ bucket: 'active' });
}

export function move(ids: string[], place: sc.Place, label = ids.length > 1 ? `카드 ${ids.length}장을 옮겼어요.` : '카드를 옮겼어요.') {
  edit((p) => sc.moveScenes(p, ids, place), label);
}

export function duplicate(id: string) {
  const p = currentProject();
  const r = p && sc.duplicateScene(p, id);
  if (r) edit(() => r.project, '카드를 복제했어요.');
}

export function mergeWithNext(id: string) {
  const p = currentProject();
  const next = p && sc.neighbor(p, id, 1);
  if (!next) return;
  edit((x) => sc.mergeWithNext(x, id), `${quote(next.title)}${josa(next.title || '제목 없는 씬', '과/와')} 합쳤어요. 합쳐진 카드는 휴지통에 있어요.`);
}

export function split(id: string, pos: number) {
  const p = currentProject();
  const r = p && sc.splitScene(p, id, pos);
  if (!r) { notify('나눌 자리에 커서를 놓고 다시 골라 주세요.'); return; }
  edit(() => r.project, '커서 위치에서 카드를 나눴어요.');
  go({ view: 'write', sceneId: r.id });
}

// ── 장 ─────────────────────────────────────────────────────────────────────
export function splitChapterAt(sceneId: string) {
  const p = currentProject();
  const r = p && ch.splitChapterAt(p, sceneId);
  if (!r) return;
  edit(() => r.project, '장을 나눴어요.');
  ui.set({ editingChapterId: r.id });
}

export function addChapter(opts: { after?: string; before?: string } = {}) {
  const p = currentProject();
  if (!p) return;
  const r = ch.addChapter(p, opts);
  edit(() => r.project);
  ui.set({ editingChapterId: r.id });
}

export const renameChapter = (id: string, title: string) => edit((p) => ch.renameChapter(p, id, title));
export const mergeChapter = (id: string) => edit((p) => ch.mergeWithPrevious(p, id), '앞 장과 합쳤어요.');
export const removeChapter = (id: string, trashCards: boolean) =>
  edit((p) => ch.removeChapter(p, id, { trash: trashCards }), trashCards ? '장과 카드를 지웠어요. 카드는 휴지통에 있어요.' : '장 구분을 지웠어요.');
export const moveChapter = (id: string, to: number) => edit((p) => ch.moveChapter(p, id, to));
export const clearChapters = () => edit(ch.clearChapters, '장 구분을 모두 없앴어요.');

// ── 작품 ───────────────────────────────────────────────────────────────────
export function openProject(id: string) {
  prefs.set({ projectId: id });
  ui.set({ selection: [], editingId: '', bucket: 'active', dialog: null });
  go({ view: 'board', sceneId: '' });
}

export function createProject(example = false) {
  const p = example ? sampleProject() : newProject({ title: '제목 없는 이야기' });
  repo.create(p);
  openProject(p.id);
  if (!example) ui.set({ dialog: { kind: 'project' } });
}

export async function deleteProject(id: string) {
  const title = repo.getState().projects.find((p) => p.id === id)?.title ?? '';
  await repo.remove(id);
  const rest = repo.getState().projects;
  if (rest.length === 0) createProject();
  else if (prefs.get().projectId === id || !rest.some((p) => p.id === prefs.get().projectId)) openProject(rest[0].id);
  notify(`${quote(title, '작품')}${josa(title || '작품', '을/를')} 삭제했어요. 설정 → 내보내기·백업의 복구 사본에 남아 있어요.`);
}

export const editProjectInfo = (patch: Partial<Pick<Project, 'title' | 'subtitle'>>) => edit((p) => ({ ...p, ...patch }));

/** 장이 없는 작품: 지금 카드를 모두 1장으로 묶고 제목을 바로 고친다. */
export function startChapters() {
  const p = currentProject();
  if (!p || p.chapters.length) return;
  const next = ch.ensureChapters(p);
  edit(() => next);
  ui.set({ editingChapterId: next.chapters[0].id });
}

// ── 선택 ───────────────────────────────────────────────────────────────────
export function toggleSelect(id: string) {
  ui.set((s) => ({ selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] }));
}
export const clearSelection = () => ui.set({ selection: [] });
/** 선택한 카드를 이야기 순서대로 */
export function selectedInOrder(): string[] {
  const p = currentProject();
  const set = new Set(ui.get().selection);
  return p ? p.scenes.filter((s) => set.has(s.id)).map((s) => s.id) : [];
}

// ── 보드 편집 ─────────────────────────────────────────────────────────────
export function startEdit(id: string) { ui.set({ editingId: id, draftId: '' }); }

/** 편집을 마친다. 새로 만든 빈 카드를 취소하면 지운다. */
export function endEdit(how: 'save' | 'cancel' | 'blur', before?: { title: string; summary: string }) {
  const { editingId, draftId } = ui.get();
  ui.set({ editingId: '', draftId: '' });
  const p = currentProject();
  const s = p && sc.findScene(p, editingId);
  if (!s) return;
  if (draftId === editingId && !s.title.trim() && !s.summary.trim() && !s.body.trim() && how !== 'save') {
    edit((x) => sc.purgeScenes(x, [editingId]));
    return;
  }
  if (how === 'cancel' && before && draftId !== editingId) edit((x) => sc.updateScene(x, editingId, before));
}
