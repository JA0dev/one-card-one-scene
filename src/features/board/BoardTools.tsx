// 보드 보조 도구: 여러 장 고르기 막대, 옮기기 대화상자, 장 순서 대화상자
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRightLeft, ArrowUp, Trash2, X } from 'lucide-react';
import { chapterTitle, groupByChapter } from '@/domain/chapters';
import { activeScenes } from '@/domain/scenes';
import { pad } from '@/domain/text';
import { STAGES, STAGE_LABEL } from '@/domain/types';
import * as act from '@/state/actions';
import { ui, useProject } from '@/state/app';
import { Button, IconButton, Modal, Pop, cx } from '@/ui/kit';
import { StageDot } from '@/ui/stage';

export function SelectionBar() {
  const selection = ui.use((s) => s.selection);
  if (!selection.length) return null;
  const ids = () => act.selectedInOrder();
  return (
    <div className="selection-bar" role="toolbar" aria-label="고른 카드">
      <span className="selection-count">{selection.length}장 고름</span>
      <Pop align="center" trigger={<button type="button" className="sel-btn">단계</button>}>
        <div className="stage-options">
          {STAGES.map((s) => (
            <button key={s} type="button" className="stage-option" onClick={() => act.setStage(ids(), s)}><StageDot stage={s} size="lg" /><span>{STAGE_LABEL[s]}</span></button>
          ))}
        </div>
      </Pop>
      <button type="button" className="sel-btn" onClick={() => ui.set({ dialog: { kind: 'move', sceneIds: ids() } })}><ArrowRightLeft size={15} />옮기기</button>
      <button type="button" className="sel-btn is-danger" onClick={() => act.trash(ids())}><Trash2 size={15} />휴지통</button>
      <IconButton label="고르기 끝내기 (Esc)" onClick={act.clearSelection}><X size={17} /></IconButton>
    </div>
  );
}

/** 옮길 자리를 고른다: 어느 카드 앞, 또는 어느 장의 끝 */
export function MoveDialog() {
  const d = ui.use((s) => s.dialog);
  const project = useProject();
  const ids = d?.kind === 'move' ? d.sceneIds : [];
  const [q, setQ] = useState('');
  const groups = useMemo(() => (project ? groupByChapter(project, activeScenes(project)) : []), [project]);
  const number = useMemo(() => new Map(project ? activeScenes(project).map((s, i) => [s.id, i + 1]) : []), [project]);
  if (!project) return null;
  const close = () => { ui.set({ dialog: null }); setQ(''); };
  const moving = new Set(ids);
  const title = ids.length > 1 ? `카드 ${ids.length}장 옮기기` : `${pad(number.get(ids[0]) ?? 0)} ${project.scenes.find((s) => s.id === ids[0])?.title || '제목 없는 씬'} 옮기기`;
  const needle = q.trim().toLowerCase();
  return (
    <Modal open={d?.kind === 'move'} onOpenChange={(o) => !o && close()} title={title} description="어디로 옮길까요?">
      <input className="move-search" placeholder="카드 제목으로 찾기" value={q} onChange={(e) => setQ(e.target.value)} aria-label="카드 제목으로 찾기" />
      <div className="move-list">
        {groups.map(({ chapter, scenes }, gi) => {
          const shown = scenes.filter((s) => !needle || s.title.toLowerCase().includes(needle));
          return (
            <div key={chapter?.id ?? 'flat'} className="move-group">
              {chapter && <div className="move-chapter">{gi + 1}장 {chapterTitle(chapter)}</div>}
              {shown.map((s) => (
                <button key={s.id} type="button" className="move-row" disabled={moving.has(s.id)} onClick={() => { act.move(ids, { before: s.id }); close(); }}>
                  <span className="move-num">{pad(number.get(s.id)!)}</span><span className="move-title">{s.title || '제목 없는 씬'}</span><span className="move-hint">앞으로</span>
                </button>
              ))}
              <button type="button" className="move-row is-end" onClick={() => { act.move(ids, { chapterId: chapter?.id ?? null, at: 'end' }); close(); }}>
                <span className="move-title">{chapter ? `${gi + 1}장 맨 끝으로` : '맨 끝으로'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/** 장 순서 바꾸기 · 이름 · 장 구분 없애기 */
export function ChaptersDialog() {
  const open = ui.use((s) => s.dialog?.kind === 'chapters');
  const project = useProject();
  if (!project) return null;
  const counts = new Map(groupByChapter(project).map((g) => [g.chapter?.id, g.scenes.length]));
  return (
    <Modal open={open} onOpenChange={(o) => !o && ui.set({ dialog: null })} title="장 편집" size="sm">
      <ol className="chapter-list">
        {project.chapters.map((c, i) => (
          <li key={c.id} className="chapter-row">
            <span className="chapter-row-num">{i + 1}장</span>
            <input className="chapter-row-title" value={c.title} placeholder="제목 없는 장" aria-label={`${i + 1}장 제목`} onChange={(e) => act.renameChapter(c.id, e.target.value)} />
            <span className="chapter-row-count">{counts.get(c.id) ?? 0}</span>
            <IconButton label={`${i + 1}장을 위로`} disabled={i === 0} onClick={() => act.moveChapter(c.id, i - 1)}><ArrowUp size={16} /></IconButton>
            <IconButton label={`${i + 1}장을 아래로`} disabled={i === project.chapters.length - 1} onClick={() => act.moveChapter(c.id, i + 1)}><ArrowDown size={16} /></IconButton>
          </li>
        ))}
      </ol>
      <div className={cx('modal-actions', 'is-split')}>
        <Button variant="quiet" onClick={() => { act.clearChapters(); ui.set({ dialog: null }); }}>장 구분 모두 없애기</Button>
        <Button variant="primary" onClick={() => ui.set({ dialog: null })}>완료</Button>
      </div>
    </Modal>
  );
}
