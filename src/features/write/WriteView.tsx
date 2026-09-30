// 집필: 카드 한 장을 집어 들고 쓴다. 왼쪽에는 같은 장의 카드들이 보인다.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRightLeft, ChevronLeft, ChevronRight, Copy, History, Merge, MoreHorizontal, NotebookPen, RotateCcw, Scissors, Trash2 } from 'lucide-react';
import { chapterIndex, chapterTitle } from '@/domain/chapters';
import { activeScenes, findScene, neighbor } from '@/domain/scenes';
import { count, countNoSpace, fmt, pad, when } from '@/domain/text';
import type { Project, Scene } from '@/domain/types';
import * as act from '@/state/actions';
import { ui, useProject } from '@/state/app';
import { go } from '@/state/nav';
import { prefs } from '@/state/prefs';
import { AutoText, Button, IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal, cx } from '@/ui/kit';
import { StageDot, StagePicker } from '@/ui/stage';

const positions = new Map<string, number>();
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function WriteView({ sceneId }: { sceneId: string }) {
  const project = useProject();
  const scene = project && findScene(project, sceneId);
  const { font, line, serif } = prefs.use((p) => p);
  const body = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (project && !scene) go({ view: 'board', sceneId: '' }, { replace: true }); }, [project, scene]);

  // 카드마다 쓰던 위치를 기억한다.
  useLayoutEffect(() => {
    window.scrollTo(0, positions.get(sceneId) ?? 0);
    const save = () => positions.set(sceneId, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [sceneId]);

  // 이전·다음 카드: ⌥⌘↑ / ⌥⌘↓ (Windows는 Ctrl+Alt)
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (!project || !(e.altKey && (isMac ? e.metaKey : e.ctrlKey))) return;
      const target = e.key === 'ArrowDown' ? neighbor(project, sceneId, 1) : e.key === 'ArrowUp' ? neighbor(project, sceneId, -1) : undefined;
      if (target) { e.preventDefault(); positions.delete(target.id); act.openScene(target.id); }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [project, sceneId]);

  if (!project || !scene) return null;
  const list = activeScenes(project);
  const index = list.findIndex((s) => s.id === scene.id);
  const trashed = !!scene.trashedAt;
  const chapter = project.chapters.find((c) => c.id === scene.chapterId) ?? null;
  const siblings = chapter ? list.filter((s) => s.chapterId === chapter.id) : list;
  const where = chapter ? `${chapterIndex(project, chapter.id) + 1}장 · ${siblings.indexOf(scene) + 1} / ${siblings.length}` : `${index + 1} / ${list.length}`;
  const prev = neighbor(project, scene.id, -1), next = neighbor(project, scene.id, 1);
  const move = (s?: Scene) => { if (s) { positions.delete(s.id); act.openScene(s.id); } };
  const back = () => go({ view: 'board', sceneId: scene.id });
  const patch = (p: Partial<Scene>) => act.patchScene(scene.id, p);
  const hint = isMac ? '⌥⌘↓' : 'Ctrl+Alt+↓';

  return (
    <div className="write">
      <Rail project={project} scene={scene} siblings={siblings} chapterLabel={chapter ? `${chapterIndex(project, chapter.id) + 1}장` : ''} chapterName={chapter ? chapterTitle(chapter) : '모든 카드'} onBack={back} />
      <article className="paper" key={scene.id}>
        <div className="paper-bar">
          <button type="button" className="paper-back" onClick={back}><ChevronLeft size={18} /><span>펼쳐보기</span></button>
          <span className="paper-where">{trashed ? '휴지통에 있는 카드' : where}</span>
          <span className="paper-space" />
          <StagePicker stage={scene.stage} onChange={(st) => act.setStage([scene.id], st)} size="lg" align="end" />
          <button type="button" className="paper-tool" onClick={() => ui.set({ dialog: { kind: 'notes', sceneId: scene.id } })} aria-label="노트">
            <NotebookPen size={17} /><span>노트</span>{scene.notes.trim() && <i className="note-mark" aria-label="메모 있음" />}
          </button>
          <WriteMenu scene={scene} canMerge={!!next} getCursor={() => body.current?.selectionStart ?? 0} />
          <span className="paper-nav">
            <IconButton label="이전 카드" disabled={!prev} onClick={() => move(prev)}><ChevronLeft size={18} /></IconButton>
            <IconButton label="다음 카드" disabled={!next} onClick={() => move(next)}><ChevronRight size={18} /></IconButton>
          </span>
        </div>
        {trashed && (
          <div className="paper-notice">휴지통에 있는 카드예요. <Button variant="quiet" onClick={() => act.restore([scene.id])}><RotateCcw size={14} />되돌리기</Button></div>
        )}
        <div className="paper-inner">
          <div className="scene-num">{pad(index + 1)}</div>
          <AutoText className="scene-title" aria-label="씬 제목" placeholder="씬 제목" value={scene.title} onChange={(e) => patch({ title: e.target.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); (e.currentTarget.parentElement?.querySelector('.scene-summary') as HTMLElement)?.focus(); } }} />
          <div className="scene-meta">
            <Meta label="시점 인물" value={scene.pov} onChange={(v) => patch({ pov: v })} />
            <Meta label="장소" value={scene.place} onChange={(v) => patch({ place: v })} />
            <Meta label="시간" value={scene.time} onChange={(v) => patch({ time: v })} />
          </div>
          <AutoText className="scene-summary" aria-label="요약" placeholder="요약 · 이 장면에서 무엇이 달라지나요?" value={scene.summary} onChange={(e) => patch({ summary: e.target.value })} />
          <AutoText ref={body} className={cx('scene-body', serif && 'serif')} style={{ fontSize: font, lineHeight: line }} aria-label="본문" placeholder="여기에 장면을 써 보세요." value={scene.body} onChange={(e) => patch({ body: e.target.value })} />
        </div>
        <footer className="paper-foot">
          <span className="paper-count">{fmt(count(scene.body))}자 <span className="muted">· 공백 제외 {fmt(countNoSpace(scene.body))}자</span></span>
          {next ? (
            <button type="button" className="next-scene" onClick={() => move(next)}>
              <span className="next-label">다음 장면 <kbd>{hint}</kbd></span><strong>{pad(index + 2)} {next.title || '제목 없는 씬'}</strong>
            </button>
          ) : (
            <button type="button" className="next-scene" onClick={back}><span className="next-label">마지막 카드예요</span><strong>펼쳐보기로 돌아가기</strong></button>
          )}
        </footer>
      </article>
      <NotesDialog />
      <HistoryDialog />
    </div>
  );
}

function Meta({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="meta-field">
      <span>{label}</span>
      <input value={value} placeholder="—" onChange={(e) => onChange(e.target.value)} size={Math.max(2, [...value].length + 1)} />
    </label>
  );
}

function Rail({ project, scene, siblings, chapterLabel, chapterName, onBack }: { project: Project; scene: Scene; siblings: Scene[]; chapterLabel: string; chapterName: string; onBack: () => void }) {
  const number = new Map(activeScenes(project).map((s, i) => [s.id, i + 1]));
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { ref.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' }); }, [scene.id]);
  return (
    <aside className="rail" aria-label="같은 장의 카드">
      <button type="button" className="rail-back" onClick={onBack}><ChevronLeft size={18} />펼쳐보기</button>
      <div className="rail-chapter">{chapterLabel && <span>{chapterLabel}</span>}<strong>{chapterName}</strong></div>
      <ol ref={ref} className="rail-list">
        {siblings.map((s) => (
          <li key={s.id}>
            <button type="button" className={cx('rail-card', s.id === scene.id && 'is-on')} aria-current={s.id === scene.id ? 'true' : undefined} onClick={() => { positions.delete(s.id); act.openScene(s.id); }}>
              <span className="rail-top"><span>{pad(number.get(s.id) ?? 0)}</span><StageDot stage={s.stage} size="sm" /></span>
              <span className="rail-title">{s.title || '제목 없는 씬'}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function WriteMenu({ scene, canMerge, getCursor }: { scene: Scene; canMerge: boolean; getCursor: () => number }) {
  return (
    <Menu>
      <MenuTrigger asChild><IconButton label="카드 메뉴"><MoreHorizontal size={18} /></IconButton></MenuTrigger>
      <MenuContent>
        <MenuItem icon={<Scissors size={15} />} disabled={!!scene.trashedAt} onSelect={() => act.split(scene.id, getCursor())}>커서 위치에서 나누기</MenuItem>
        <MenuItem icon={<Merge size={15} />} disabled={!canMerge || !!scene.trashedAt} onSelect={() => act.mergeWithNext(scene.id)}>다음 카드와 합치기</MenuItem>
        <MenuItem icon={<ArrowRightLeft size={15} />} disabled={!!scene.trashedAt} onSelect={() => ui.set({ dialog: { kind: 'move', sceneIds: [scene.id] } })}>옮기기…</MenuItem>
        <MenuItem icon={<Copy size={15} />} onSelect={() => act.duplicate(scene.id)}>복제</MenuItem>
        <MenuItem icon={<History size={15} />} onSelect={() => ui.set({ dialog: { kind: 'history', sceneId: scene.id } })}>저장 이력</MenuItem>
        <MenuSeparator />
        {scene.trashedAt
          ? <MenuItem icon={<RotateCcw size={15} />} onSelect={() => act.restore([scene.id])}>되돌리기</MenuItem>
          : <MenuItem icon={<Trash2 size={15} />} danger onSelect={() => { act.trash([scene.id]); go({ view: 'board', sceneId: '' }); }}>휴지통으로</MenuItem>}
      </MenuContent>
    </Menu>
  );
}

function NotesDialog() {
  const d = ui.use((s) => s.dialog);
  const project = useProject();
  const scene = d?.kind === 'notes' && project ? findScene(project, d.sceneId) : undefined;
  return (
    <Modal open={!!scene} onOpenChange={(o) => !o && ui.set({ dialog: null })} title="노트" description="자료, 고칠 점, 떠오른 생각을 적어 두세요. 원고에는 들어가지 않아요.">
      {scene && <AutoText className="notes-input" autoFocus placeholder="메모" value={scene.notes} onChange={(e) => act.patchScene(scene.id, { notes: e.target.value })} />}
    </Modal>
  );
}

function HistoryDialog() {
  const d = ui.use((s) => s.dialog);
  const project = useProject();
  const scene = d?.kind === 'history' && project ? findScene(project, d.sceneId) : undefined;
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Modal open={!!scene} onOpenChange={(o) => { if (!o) { ui.set({ dialog: null }); setOpen(null); } }} title="저장 이력" description="본문을 고치면 1분마다 이전 모습을 남겨요. 최근 50개까지 있어요.">
      {scene && (scene.versions.length === 0 ? <p className="muted">아직 남은 이력이 없어요.</p> : (
        <ul className="history-list">
          {scene.versions.map((v, i) => (
            <li key={v.at + i}>
              <button type="button" className="history-row" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <strong>{when(v.at)}</strong><span className="muted">{fmt(count(v.body))}자 · {v.title || '제목 없음'}</span>
              </button>
              {open === i && (
                <div className="history-preview">
                  <p>{v.body.slice(0, 600) || '(빈 본문)'}{v.body.length > 600 && '…'}</p>
                  <Button onClick={() => { act.restoreVersion(scene.id, i); ui.set({ dialog: null }); }}>
                    <RotateCcw size={14} />이 내용으로 되돌리기
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ))}
    </Modal>
  );
}
