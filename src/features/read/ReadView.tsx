// 이어보기: 원고 전체를 장·씬 순서로 이어서 읽고 바로 고친다.
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, List, PenLine } from 'lucide-react';
import { chapterTitle, groupByChapter } from '@/domain/chapters';
import { lensActive, matches } from '@/domain/lens';
import { activeScenes } from '@/domain/scenes';
import { count, fmt, pad } from '@/domain/text';
import type { Chapter, Project, Scene } from '@/domain/types';
import * as act from '@/state/actions';
import { ui, useProject } from '@/state/app';
import { useRoute } from '@/state/nav';
import { prefs } from '@/state/prefs';
import { LensBar } from '@/features/lens/Lens';
import { AutoText, Modal, cx } from '@/ui/kit';
import { StageDot } from '@/ui/stage';

type Group = { chapter: Chapter | null; scenes: Scene[] };

export function ReadView() {
  const project = useProject();
  const lens = ui.use((s) => s.lens);
  const { font, line, serif } = prefs.use((p) => p);
  const route = useRoute();
  const [current, setCurrent] = useState('');

  const all = useMemo(() => (project ? activeScenes(project) : []), [project]);
  const number = useMemo(() => new Map(all.map((s, i) => [s.id, i + 1])), [all]);
  const on = lensActive(lens);
  const shown = on ? all.filter((s) => matches(s, lens)) : all;
  const groups: Group[] = project ? groupByChapter(project, shown).filter((g) => !on || g.scenes.length) : [];

  // #/read/<id>로 오면 그 씬으로
  useEffect(() => {
    if (!route.sceneId) return;
    requestAnimationFrame(() => document.getElementById('scene-' + route.sceneId)?.scrollIntoView({ block: 'start' }));
  }, [route.sceneId]);

  // 지금 읽는 씬을 목차에 표시
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setCurrent(top.target.id.replace('scene-', ''));
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.ms-scene').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [shown.length, project?.id]);

  if (!project) return null;
  const total = shown.reduce((n, s) => n + count(s.body), 0);

  return (
    <div className="read">
      <aside className="outline-side" aria-label="목차">
        <Outline project={project} groups={groups} number={number} current={current} />
        <p className="outline-total">{on ? `${shown.length}장 · ` : ''}전체 {fmt(total)}자</p>
      </aside>
      <div className="read-main">
        <LensBar matched={shown.length} total={all.length} />
        <button type="button" className="outline-open" onClick={() => ui.set({ dialog: { kind: 'outline' } })}><List size={16} />목차</button>
        <article className={cx('ms', serif && 'serif')} style={{ fontSize: font, lineHeight: line }}>
          <h1 className="ms-title">{project.title}</h1>
          {groups.map(({ chapter, scenes }) => (
            <section key={chapter?.id ?? 'flat'} className="ms-chapter">
              {chapter && (
                <header className="ms-chapter-head">
                  <span>{project.chapters.indexOf(chapter) + 1}장</span>
                  <h2>{chapterTitle(chapter)}</h2>
                </header>
              )}
              {scenes.map((s) => (
                <section key={s.id} id={'scene-' + s.id} className={cx('ms-scene', current === s.id && 'is-current')} tabIndex={-1}>
                  <div className="ms-scene-head">
                    <span className="ms-num">{pad(number.get(s.id)!)}</span>
                    <span className="ms-name">{s.title || '제목 없는 씬'}</span>
                    <span className="ms-rule" />
                    <button type="button" className="ms-open" onClick={() => act.openScene(s.id)}><PenLine size={13} />카드로 열기</button>
                  </div>
                  <AutoText className="ms-body" aria-label={`${pad(number.get(s.id)!)} ${s.title} 본문`} placeholder="아직 쓰지 않은 장면이에요." value={s.body}
                    onChange={(e) => act.patchScene(s.id, { body: e.target.value })} style={{ fontSize: font, lineHeight: line }} />
                </section>
              ))}
            </section>
          ))}
          {groups.length === 0 && <p className="empty">렌즈에 맞는 카드가 없어요.</p>}
        </article>
      </div>
      <OutlineDialog project={project} groups={groups} number={number} current={current} />
    </div>
  );
}

function Outline({ project, groups, number, current, onPick }: { project: Project; groups: Group[]; number: Map<string, number>; current: string; onPick?: () => void }) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const jump = (id: string) => { onPick?.(); requestAnimationFrame(() => { const el = document.getElementById('scene-' + id); el?.scrollIntoView({ block: 'start', behavior: 'smooth' }); el?.focus({ preventScroll: true }); }); };
  return (
    <nav className="outline">
      {groups.map(({ chapter, scenes }) => {
        const key = chapter?.id ?? 'flat';
        const isClosed = closed.has(key);
        return (
          <div key={key} className="outline-group">
            {chapter && (
              <button type="button" className="outline-chapter" aria-expanded={!isClosed}
                onClick={() => setClosed((c) => { const n = new Set(c); if (n.has(key)) n.delete(key); else n.add(key); return n; })}>
                {isClosed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="outline-ch-num">{project.chapters.indexOf(chapter) + 1}장</span>
                <strong>{chapterTitle(chapter)}</strong>
                <span className="outline-count">{scenes.length}</span>
              </button>
            )}
            {!isClosed && (
              <ol>
                {scenes.map((s) => (
                  <li key={s.id}>
                    <button type="button" className={cx('outline-scene', current === s.id && 'is-on')} aria-current={current === s.id ? 'location' : undefined} onClick={() => jump(s.id)}>
                      <span className="outline-num">{pad(number.get(s.id)!)}</span>
                      <span className="outline-name">{s.title || '제목 없는 씬'}</span>
                      <StageDot stage={s.stage} size="sm" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function OutlineDialog(props: { project: Project; groups: Group[]; number: Map<string, number>; current: string }) {
  const open = ui.use((s) => s.dialog?.kind === 'outline');
  return (
    <Modal open={open} onOpenChange={(o) => !o && ui.set({ dialog: null })} title="목차">
      <Outline {...props} onPick={() => ui.set({ dialog: null })} />
    </Modal>
  );
}
