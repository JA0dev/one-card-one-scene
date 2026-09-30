import { describe, expect, it } from 'vitest';
import { copyProject, fromMarkdown, importFile, manuscriptText } from '@/io/transfer';
import { isProject } from '@/domain/project';
import { activeScenes } from '@/domain/scenes';
import { sampleProject } from '@/domain/sample';

describe('내보내기·가져오기', () => {
  it('Markdown으로 내보낸 원고를 다시 가져오면 장과 씬이 그대로다', () => {
    const p = sampleProject();
    const back = fromMarkdown('x', manuscriptText(p, true));
    expect(back.title).toBe('등대의 밤');
    expect(back.chapters.map((c) => c.title)).toEqual(['도착', '흔적', '불빛']);
    expect(activeScenes(back).map((s) => s.title)).toEqual(activeScenes(p).map((s) => s.title));
    expect(activeScenes(back)[0].body).toBe(activeScenes(p)[0].body);
  });

  it('장 제목이 없는 글은 * * * 로 씬을 나눈다', () => {
    const p = fromMarkdown('메모', '첫 문단\n\n* * *\n\n둘째 장면');
    expect(p.chapters).toHaveLength(0);
    expect(activeScenes(p).map((s) => s.body)).toEqual(['첫 문단', '둘째 장면']);
  });

  it('백업 파일은 새 id의 작품으로 가져온다', () => {
    const p = sampleProject();
    const [copy] = importFile('b.json', JSON.stringify({ kind: 'scene-card-backup', schema: 2, exportedAt: '', projects: [p] }));
    expect(isProject(copy)).toBe(true);
    expect(copy.id).not.toBe(p.id);
    expect(copy.title).toBe('등대의 밤 · 가져옴');
    expect(new Set(copy.scenes.map((s) => s.chapterId))).toEqual(new Set(copy.chapters.map((c) => c.id)));
  });

  it('예전 앱 백업도 가져온다', () => {
    const v1 = { schema: 1, projects: [{ id: 'a', title: '옛 작품', subtitle: '', scenes: [{ id: 's', title: '장면', summary: '', body: '본문', notes: '', pov: '', place: '', time: '', stage: '완료', bucket: 'active', versions: [] }] }] };
    const [p] = importFile('old.json', JSON.stringify(v1));
    expect(p.scenes[0]).toMatchObject({ title: '장면', stage: 'done' });
  });

  it('잘못된 파일은 알아듣게 거절한다', () => {
    expect(() => importFile('x.json', '{')).toThrow('백업 파일을 읽을 수 없어요.');
    expect(() => importFile('x.json', '{"a":1}')).toThrow('씬 카드 백업 파일이 아니에요.');
    expect(copyProject(sampleProject(), ' · 사본').title).toContain('사본');
  });
});
