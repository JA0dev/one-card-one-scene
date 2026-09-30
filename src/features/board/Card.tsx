// 보드의 카드 한 장. 누르면 집필로, 색 점을 누르면 단계를, 메뉴로 나머지 동작을.
import { useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRightLeft, Check, Copy, Merge, MoreHorizontal, PencilLine, Plus, RotateCcw, Scissors, SquareCheck, Trash2, X } from 'lucide-react';
import { names } from '@/domain/lens';
import { count, fmt, pad, when } from '@/domain/text';
import type { Scene } from '@/domain/types';
import * as act from '@/state/actions';
import { ui } from '@/state/app';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, cx } from '@/ui/kit';
import { StagePicker } from '@/ui/stage';

export type CardProps = {
  s: Scene;
  number: number;
  showMeta: boolean;
  dim: boolean;
  selected: boolean;
  selecting: boolean;
  chosen: boolean;
  editing: boolean;
  canSplitChapter: boolean;
  hasNext: boolean;
  trash?: boolean;
  onPurge?: (s: Scene) => void;
  /** 이 카드 앞 틈에 보일 도구 */
  gap?: React.ReactNode;
};

export function Card(props: CardProps) {
  const { s, trash } = props;
  const sortable = useSortable({ id: s.id, disabled: props.editing || trash });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  const open = (e: React.MouseEvent) => {
    if (trash) return;
    if (props.selecting || e.shiftKey || e.metaKey || e.ctrlKey) { e.preventDefault(); act.toggleSelect(s.id); return; }
    act.openScene(s.id);
  };
  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      data-scene-id={s.id}
      className={cx('card', props.dim && 'is-dim', props.selected && 'is-selected', props.chosen && 'is-chosen', props.editing && 'is-editing', sortable.isDragging && 'is-dragging', trash && 'is-trash')}
      {...sortable.attributes}
      {...(props.editing ? {} : sortable.listeners)}
      role="listitem"
      aria-roledescription="카드"
      tabIndex={-1}
    >
      {props.gap}
      <div className="card-top">
        <span className="card-num">{pad(props.number)}</span>
        {trash ? <span className="card-when">{when(s.trashedAt!)}</span> : <StagePicker stage={s.stage} onChange={(st) => act.setStage([s.id], st)} size="md" />}
        <span className="card-top-space" />
        {props.selected && <span className="card-check" aria-hidden><Check size={13} /></span>}
        {!props.editing && <CardMenu {...props} />}
      </div>
      {props.editing ? <Editor s={s} /> : (
        <button type="button" className="card-body" onClick={open} aria-label={`${pad(props.number)} ${s.title || '제목 없는 씬'}${props.selected ? ', 선택됨' : ''}. ${trash ? '' : '집필 열기'}`}>
          <h3 className={cx('card-title', !s.title && 'is-empty')}>{s.title || '제목 없는 씬'}</h3>
          <p className={cx('card-summary', !s.summary && 'is-empty')}>{s.summary || (s.body ? s.body.slice(0, 120) : '요약을 적어 보세요')}</p>
        </button>
      )}
      {props.showMeta && !props.editing && (
        <footer className="card-foot">
          <span className="card-meta">{[names(s.pov).join(', '), s.place].filter(Boolean).join(' · ') || ' '}</span>
          <span className="card-count">{fmt(count(s.body))}자</span>
        </footer>
      )}
    </article>
  );
}

function CardMenu({ s, trash, canSplitChapter, hasNext, onPurge }: CardProps) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className="card-more" aria-label="카드 메뉴" data-no-drag onPointerDown={(e) => e.stopPropagation()}><MoreHorizontal size={17} /></button>
      </MenuTrigger>
      <MenuContent>
        {trash ? (
          <>
            <MenuItem icon={<RotateCcw size={15} />} onSelect={() => act.restore([s.id])}>되돌리기</MenuItem>
            <MenuItem icon={<X size={15} />} danger onSelect={() => onPurge?.(s)}>영구 삭제</MenuItem>
          </>
        ) : (
          <>
            <MenuItem icon={<PencilLine size={15} />} onSelect={() => act.startEdit(s.id)}>제목 · 요약 고치기</MenuItem>
            <MenuItem icon={<Plus size={15} />} onSelect={() => act.addCard({ after: s.id })}>다음에 새 카드</MenuItem>
            <MenuItem icon={<Scissors size={15} />} disabled={!canSplitChapter} onSelect={() => act.splitChapterAt(s.id)}>여기서 장 나누기</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<ArrowRightLeft size={15} />} onSelect={() => ui.set({ dialog: { kind: 'move', sceneIds: [s.id] } })}>옮기기…</MenuItem>
            <MenuItem icon={<Merge size={15} />} disabled={!hasNext} onSelect={() => act.mergeWithNext(s.id)}>다음 카드와 합치기</MenuItem>
            <MenuItem icon={<Copy size={15} />} onSelect={() => act.duplicate(s.id)}>복제</MenuItem>
            <MenuItem icon={<SquareCheck size={15} />} onSelect={() => act.toggleSelect(s.id)}>여러 장 고르기</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 size={15} />} danger onSelect={() => act.trash([s.id])}>휴지통으로</MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

/** 보드에서 제목·요약 고치기. Enter: 다음 칸/마침, Esc: 취소, 바깥 누르면 마침 */
function Editor({ s }: { s: Scene }) {
  const title = useRef<HTMLInputElement>(null);
  const summary = useRef<HTMLTextAreaElement>(null);
  const before = useRef({ title: s.title, summary: s.summary });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = title.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, []);
  // 바깥을 누르면 마친다. (포커스가 '아무 데도 아닌 곳'으로 빠지는 경우는 무시한다)
  useEffect(() => {
    const down = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) finish('blur'); };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  });
  const finish = (how: 'save' | 'cancel' | 'blur') => {
    act.endEdit(how, before.current);
    if (how !== 'blur') requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-scene-id="${s.id}"] .card-body`)?.focus());
  };
  const keys = (e: React.KeyboardEvent, enter: () => void) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish('cancel'); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enter(); }
  };
  return (
    <div ref={box} className="card-editor" onBlur={(e) => { const to = e.relatedTarget as Node | null; if (to && !e.currentTarget.contains(to)) finish('blur'); }}>
      <input ref={title} className="card-title-input" aria-label="씬 제목" placeholder="씬 제목" value={s.title}
        onChange={(e) => act.patchScene(s.id, { title: e.target.value })} onKeyDown={(e) => keys(e, () => summary.current?.focus())} />
      <textarea ref={summary} className="card-summary-input" rows={3} aria-label="씬 요약" placeholder="이 장면에서 무엇이 달라지나요?" value={s.summary}
        onChange={(e) => act.patchScene(s.id, { summary: e.target.value })} onKeyDown={(e) => keys(e, () => finish('save'))} />
    </div>
  );
}

/** 드래그하는 동안 손가락 아래 보이는 카드 */
export function DragCard({ s, number, more }: { s: Scene; number: number; more: number }) {
  return (
    <div className="card is-overlay">
      <div className="card-top"><span className="card-num">{pad(number)}</span><StagePickerStatic stage={s.stage} /></div>
      <div className="card-body"><h3 className="card-title">{s.title || '제목 없는 씬'}</h3><p className="card-summary">{s.summary}</p></div>
      {more > 0 && <span className="drag-count">+{more}</span>}
    </div>
  );
}
const StagePickerStatic = ({ stage }: { stage: Scene['stage'] }) => <i className="stage-dot dot-md" data-stage={stage} />;
