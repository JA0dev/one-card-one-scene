import { describe, expect, it } from 'vitest';
import { fromV1, isProject, newProject, newScene, normalize } from '@/domain/project';
import { activeScenes, addScene, duplicateScene, emptyTrash, mergeWithNext, moveScenes, purgeExpired, restoreScenes, setStage, splitScene, trashScenes, updateScene } from '@/domain/scenes';
import { addChapter, clearChapters, groupByChapter, mergeWithPrevious, moveChapter, removeChapter, renameChapter, splitChapterAt } from '@/domain/chapters';
import { emptyLens, facets, matches, names } from '@/domain/lens';
import { josa } from '@/domain/text';
import { sampleProject } from '@/domain/sample';
import type { Project } from '@/domain/types';

const titles = (p: Project) => activeScenes(p).map((s) => s.title);
const flat = (...t: string[]) => newProject({ scenes: t.map((title) => newScene({ title })) });
const byTitle = (p: Project, t: string) => p.scenes.find((s) => s.title === t)!.id;
const layout = (p: Project) => groupByChapter(p).map((g) => g.scenes.map((s) => s.title).join(''));

describe('카드', () => {
  it('자리에 맞춰 넣고 옮긴다', () => {
    let p = flat('A', 'B', 'C');
    p = addScene(p, { after: byTitle(p, 'A') }, { title: 'X' }).project;
    expect(titles(p)).toEqual(['A', 'X', 'B', 'C']);
    p = moveScenes(p, [byTitle(p, 'C'), byTitle(p, 'A')], { before: byTitle(p, 'X') });
    expect(titles(p)).toEqual(['A', 'C', 'X', 'B']);
    expect(moveScenes(p, [byTitle(p, 'A')], { before: byTitle(p, 'A') })).toBe(p);
  });

  it('바뀐 게 없으면 같은 객체를 돌려준다', () => {
    const p = flat('A');
    expect(updateScene(p, byTitle(p, 'A'), { title: 'A' })).toBe(p);
    expect(setStage(p, [byTitle(p, 'A')], 'idea')).toBe(p);
  });

  it('나누기와 합치기', () => {
    let p = flat('A', 'B');
    p = updateScene(p, byTitle(p, 'A'), { body: '첫 문단\n\n둘째 문단' });
    const r = splitScene(p, byTitle(p, 'A'), 4)!;
    expect(titles(r.project)).toEqual(['A', 'A · 다음', 'B']);
    expect(r.project.scenes[0].body).toBe('첫 문단');
    expect(r.project.scenes[0].versions[0].body).toBe('첫 문단\n\n둘째 문단');
    expect(splitScene(p, byTitle(p, 'A'), 0)).toBeNull();
    const m = mergeWithNext(r.project, byTitle(r.project, 'A'));
    expect(m.scenes[0].body).toBe('첫 문단\n\n둘째 문단');
    expect(titles(m)).toEqual(['A', 'B']);
  });

  it('휴지통: 넣기, 되돌리기, 비우기, 오래된 것 지우기', () => {
    let p = flat('A', 'B', 'C');
    p = trashScenes(p, [byTitle(p, 'B')], '2026-01-01T00:00:00.000Z');
    expect(titles(p)).toEqual(['A', 'C']);
    expect(restoreScenes(p, [byTitle(p, 'B')]).scenes.every((s) => !s.trashedAt)).toBe(true);
    expect(purgeExpired(p, 30, Date.parse('2026-01-20')).scenes).toHaveLength(3);
    expect(purgeExpired(p, 30, Date.parse('2026-02-01')).scenes).toHaveLength(2);
    expect(emptyTrash(p).scenes).toHaveLength(2);
  });

  it('복제는 바로 뒤에 넣는다', () => {
    const p = flat('A', 'B');
    expect(titles(duplicateScene(p, byTitle(p, 'A'))!.project)).toEqual(['A', 'A (사본)', 'B']);
  });
});

describe('장', () => {
  it('장이 없는 작품을 카드 사이에서 나누면 앞부분이 1장이 된다', () => {
    const p = flat('A', 'B', 'C', 'D');
    const r = splitChapterAt(p, byTitle(p, 'C'))!;
    expect(layout(r.project)).toEqual(['AB', 'CD']);
    expect(splitChapterAt(r.project, byTitle(r.project, 'C'))).toBeNull();
    expect(splitChapterAt(p, byTitle(p, 'A'))).toBeNull();
  });

  it('새 장, 이름, 합치기, 삭제, 순서', () => {
    let p = splitChapterAt(flat('A', 'B', 'C'), '')?.project ?? flat('A', 'B', 'C');
    const a = addChapter(p);
    p = a.project;
    expect(layout(p)).toEqual(['ABC', '']);
    p = renameChapter(p, a.id, '흔적');
    expect(p.chapters[1].title).toBe('흔적');
    p = moveScenes(p, [byTitle(p, 'C')], { chapterId: a.id, at: 'end' });
    expect(layout(p)).toEqual(['AB', 'C']);
    p = moveChapter(p, a.id, 0);
    expect(layout(p)).toEqual(['C', 'AB']);
    expect(titles(p)).toEqual(['C', 'A', 'B']);
    const merged = mergeWithPrevious(p, p.chapters[1].id);
    expect(layout(merged)).toEqual(['CAB']);
    const removed = removeChapter(p, p.chapters[0].id, { trash: true });
    expect(titles(removed)).toEqual(['A', 'B']);
    expect(removed.chapters).toHaveLength(1);
    expect(removeChapter(removed, removed.chapters[0].id, { trash: false }).chapters).toHaveLength(0);
    expect(clearChapters(p).scenes.every((s) => s.chapterId === null)).toBe(true);
  });

  it('빈 작품에 새 장을 만들면 장 하나', () => {
    const p = newProject({ scenes: [] });
    const r = addChapter(p, { title: '도착' });
    expect(r.project.chapters.map((c) => c.title)).toEqual(['도착']);
  });

  it('normalize는 카드를 장 순서대로 모으고 모르는 장은 첫 장으로', () => {
    const p = sampleProject();
    const shuffled = { ...p, scenes: [...p.scenes].reverse().map((s, i) => (i === 0 ? { ...s, chapterId: 'nope' } : s)) };
    const n = normalize(shuffled);
    expect(n.scenes[0].chapterId).toBe(p.chapters[0].id);
    const order = n.scenes.map((s) => p.chapters.findIndex((c) => c.id === s.chapterId));
    expect([...order].sort()).toEqual(order);
  });
});

describe('렌즈', () => {
  it('단계·인물·장소·검색을 조합한다', () => {
    const p = sampleProject();
    const s = activeScenes(p);
    expect(names('윤서, 해진')).toEqual(['윤서', '해진']);
    expect(s.filter((x) => matches(x, { ...emptyLens, povs: ['해진'] })).map((x) => x.title)).toEqual(['민박집 주인', '사진 속 얼굴']);
    expect(s.filter((x) => matches(x, { ...emptyLens, stages: ['idea'], places: ['등대'] })).map((x) => x.title)).toEqual(['잠긴 계단', '등대지기']);
    expect(s.filter((x) => matches(x, { ...emptyLens, query: '찻잔' }))).toHaveLength(1);
    expect(facets(s).povs[0]).toEqual({ value: '윤서', count: 7 });
  });
});

describe('형식', () => {
  it('예시 작품과 옮긴 원고는 올바른 형식이다', () => {
    expect(isProject(sampleProject())).toBe(true);
    const [p] = fromV1({ schema: 1, projects: [{ id: 'abc', title: 'T', subtitle: '', scenes: [
      { id: 's1', title: 'A', summary: '', body: '', notes: '', pov: '', place: '', time: '', stage: '초고', bucket: 'held', versions: [] },
    ] }] });
    expect(isProject(p)).toBe(true);
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.scenes[0]).toMatchObject({ stage: 'draft', chapterId: null });
    expect(p.scenes[0].trashedAt).not.toBeNull();
  });

  it('조사', () => {
    expect(josa('등대', '을/를')).toBe('를');
    expect(josa('민박집 주인', '을/를')).toBe('을');
    expect(josa('Scene', '을/를')).toBe('을(를)');
    expect(josa('바다', '으로/로')).toBe('로');
    expect(josa('불빛', '으로/로')).toBe('으로');
    expect(josa('서울', '으로/로')).toBe('로');
  });
});
