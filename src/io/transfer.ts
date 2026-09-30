// 내보내기·가져오기. 원고 파일(Word·Markdown·텍스트)과 백업 파일(JSON).
import { groupByChapter, chapterTitle } from '@/domain/chapters';
import { fromV1, isProject, isV1Workspace, newChapter, newProject, newScene, normalize, now, uid } from '@/domain/project';
import { activeScenes } from '@/domain/scenes';
import { SCHEMA, type Backup, type Project } from '@/domain/types';

export type Format = 'docx' | 'md' | 'txt' | 'json';

export function download(name: string, content: Blob | string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** 원고를 장·씬 구조의 글로 만든다. */
export function manuscriptText(p: Project, md: boolean): string {
  const out: string[] = [md ? `# ${p.title}` : p.title];
  groupByChapter(p).forEach(({ chapter, scenes }, i) => {
    if (chapter) out.push(md ? `## ${i + 1}장 ${chapterTitle(chapter)}` : `${i + 1}장  ${chapterTitle(chapter)}`);
    scenes.forEach((s, j) => {
      if (md) out.push(`${chapter ? '###' : '##'} ${s.title || '제목 없는 씬'}`);
      else if (j > 0 || !chapter) out.push('* * *');
      if (s.body.trim()) out.push(s.body.trim());
    });
  });
  return out.join('\n\n') + '\n';
}

export async function exportProject(format: Format, p: Project, all: Project[]) {
  if (format === 'json') {
    const backup: Backup = { kind: 'scene-card-backup', schema: SCHEMA, exportedAt: now(), projects: all };
    download(`씬카드-백업-${now().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
    return;
  }
  if (format !== 'docx') { download(p.title + (format === 'md' ? '.md' : '.txt'), manuscriptText(p, format === 'md')); return; }
  try {
    const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, PageBreak } = await import('docx');
    const body = (text: string) => text.split('\n').map((line) => new Paragraph({ children: [new TextRun({ text: line, font: 'Batang', size: 22 })], spacing: { after: 120, line: 360 } }));
    const children = [new Paragraph({ text: p.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER })];
    groupByChapter(p).forEach(({ chapter, scenes }, i) => {
      if (chapter) {
        if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(new Paragraph({ text: `${i + 1}장  ${chapterTitle(chapter)}`, heading: HeadingLevel.HEADING_1 }));
      }
      scenes.forEach((s, j) => {
        if (j > 0) children.push(new Paragraph({ text: '*  *  *', alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 } }));
        if (s.body.trim()) children.push(...body(s.body.trim()));
      });
    });
    download(p.title + '.docx', await Packer.toBlob(new Document({ sections: [{ children }] })));
  } catch {
    throw new Error('Word 파일을 만들지 못했어요. Markdown이나 텍스트로 내보내 주세요.');
  }
}

/** 기존 작품을 덮지 않도록 모든 id를 새로 만든 사본 */
export function copyProject(p: Project, suffix: string): Project {
  const chapterIds = new Map(p.chapters.map((c) => [c.id, uid()]));
  return normalize({
    ...p, id: uid(), title: p.title + suffix, createdAt: now(), updatedAt: now(),
    chapters: p.chapters.map((c) => ({ ...c, id: chapterIds.get(c.id)! })),
    scenes: p.scenes.map((s) => ({ ...s, id: uid(), chapterId: s.chapterId ? chapterIds.get(s.chapterId) ?? null : null })),
  });
}

/** 가져오기. 항상 새 작품으로 추가한다. */
export function importFile(name: string, text: string): Project[] {
  if (name.toLowerCase().endsWith('.json')) {
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new Error('백업 파일을 읽을 수 없어요.'); }
    const b = data as Backup;
    if (b?.kind === 'scene-card-backup' && Array.isArray(b.projects) && b.projects.every(isProject)) return b.projects.map((p) => copyProject(p, ' · 가져옴'));
    if (isV1Workspace(data)) return fromV1(data).map((p) => copyProject(p, ' · 가져옴'));
    throw new Error('씬 카드 백업 파일이 아니에요.');
  }
  return [fromMarkdown(name.replace(/\.[^.]+$/, ''), text)];
}

/** "## 장" / "### 씬" 또는 "## 씬" 구조의 글을 작품으로. 제목이 없으면 빈 줄 세 개나 * * *로 나눈다. */
export function fromMarkdown(title: string, text: string): Project {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const hasScenes3 = lines.some((l) => /^###\s/.test(l));
  const chapters: ReturnType<typeof newChapter>[] = [];
  const scenes: ReturnType<typeof newScene>[] = [];
  let current: ReturnType<typeof newScene> | null = null;
  let docTitle = title;
  const push = () => { if (current) { current.body = current.body.trim(); scenes.push(current); } current = null; };
  for (const line of lines) {
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h && h[1] === '#') { docTitle = h[2].trim() || docTitle; continue; }
    if (h && h[1] === '##' && hasScenes3) { push(); chapters.push(newChapter(h[2].replace(/^\d+장\s*/, '').trim())); continue; }
    if (h) { push(); current = newScene({ title: h[2].trim(), chapterId: chapters.at(-1)?.id ?? null }); continue; }
    if (/^\s*\*\s*\*\s*\*\s*$/.test(line) && current?.body.trim()) { push(); current = newScene({ chapterId: chapters.at(-1)?.id ?? null }); continue; }
    current ??= newScene({ chapterId: chapters.at(-1)?.id ?? null });
    current.body += line + '\n';
  }
  push();
  const kept = scenes.filter((s) => s.title || s.body);
  return normalize(newProject({ title: docTitle, subtitle: '가져온 원고', chapters, scenes: kept.length ? kept : [newScene()] }));
}

export const stats = (p: Project) => {
  const list = activeScenes(p);
  return { scenes: list.length, chars: list.reduce((n, s) => n + [...s.body].length, 0) };
};
