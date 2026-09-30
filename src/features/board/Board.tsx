// 펼쳐보기(보드): 장마다 카드를 펼쳐 놓는다.
import { useEffect, useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Layers, Plus, Scissors, Trash2, X } from 'lucide-react';
import { groupByChapter } from '@/domain/chapters';
import { lensActive, matches } from '@/domain/lens';
import { activeScenes, trashedScenes } from '@/domain/scenes';
import type { Place } from '@/domain/scenes';
import type { Scene } from '@/domain/types';
import * as act from '@/state/actions';
import { TRASH_DAYS, ui, useProject } from '@/state/app';
import { useRoute } from '@/state/nav';
import { prefs } from '@/state/prefs';
import { Button, Confirm, cx } from '@/ui/kit';
import { LensBar } from '@/features/lens/Lens';
import { Card, DragCard } from './Card';
import { ChapterHeader } from './ChapterHeader';
import { SelectionBar } from './BoardTools';

export function Board() {
  const project = useProject();
  const { lens, bucket, selection, editingId } = ui.use((s) => s);
  const { showMeta, density, lensMode } = prefs.use((p) => p);
  const route = useRoute();
  const [dragId, setDragId] = useState('');
  const [purge, setPurge] = useState<Scene | 'all' | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const active = useMemo(() => (project ? activeScenes(project) : []), [project]);
  const number = useMemo(() => new Map(active.map((s, i) => [s.id, i + 1])), [active]);
  const on = lensActive(lens);
  const hit = (s: Scene) => !on || matches(s, lens);
  const matched = on ? active.filter(hit).length : active.length;

  // Esc로 선택 해제
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && ui.get().selection.length && !ui.get().dialog) act.clearSelection(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  // 집필에서 돌아오면 그 카드를 보이게
  useEffect(() => {
    if (!route.sceneId) return;
    const el = document.querySelector<HTMLElement>(`[data-scene-id="${route.sceneId}"]`);
    el?.scrollIntoView({ block: 'center' });
    el?.querySelector<HTMLElement>('.card-body')?.focus({ preventScroll: true });
  }, [route.sceneId]);

  if (!project) return null;

  if (bucket === 'trash') {
    const list = trashedScenes(project).sort((a, b) => (b.trashedAt ?? '').localeCompare(a.trashedAt ?? ''));
    return (
      <div className="board">
        <div className="trash-head">
          <div><h2>휴지통</h2><p>{TRASH_DAYS}일이 지나면 자동으로 지워져요.</p></div>
          <div className="button-row">
            {list.length > 0 && <Button variant="quiet" onClick={() => setPurge('all')}>휴지통 비우기</Button>}
            <Button onClick={() => ui.set({ bucket: 'active' })}><X size={15} />닫기</Button>
          </div>
        </div>
        {list.length === 0 ? <Empty title="휴지통이 비어 있어요" /> : (
          <div className={cx('grid', density === 'title' && 'is-compact')} role="list">
            {list.map((s, i) => (
              <Card key={s.id} s={s} number={i + 1} trash showMeta={false} dim={false} selected={false} selecting={false} chosen={false} editing={false} canSplitChapter={false} hasNext={false} onPurge={setPurge} />
            ))}
          </div>
        )}
        <Confirm open={!!purge} onOpenChange={(o) => !o && setPurge(null)}
          title={purge === 'all' ? '휴지통을 비울까요?' : '영구 삭제할까요?'}
          description={purge === 'all' ? `카드 ${list.length}장과 저장 이력이 지워져요. 이 기기의 복구 사본에는 남아요.` : '카드와 저장 이력이 지워져요. 이 기기의 복구 사본에는 남아요.'}
          confirm={purge === 'all' ? '휴지통 비우기' : '영구 삭제'}
          onConfirm={() => void (purge === 'all' ? act.emptyTrash() : purge && act.purge([purge.id]))} />
      </div>
    );
  }

  const groups = groupByChapter(project, active);
  const selecting = selection.length > 0;
  const trashCount = trashedScenes(project).length;

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragId('');
    const from = String(e.active.id);
    const over = e.over ? String(e.over.id) : '';
    if (!over || over === from) return;
    const ids = selection.includes(from) ? act.selectedInOrder() : [from];
    let place: Place;
    if (over.startsWith('end:')) {
      const chapterId = over.slice(4) || null;
      place = { chapterId, at: 'end' };
    } else {
      const a = number.get(from) ?? 0, b = number.get(over) ?? 0;
      place = a < b ? { after: over } : { before: over };
    }
    act.move(ids, place);
  };

  const dragged = dragId ? project.scenes.find((s) => s.id === dragId) : undefined;

  return (
    <div className="board">
      <LensBar matched={matched} total={active.length} />
      {active.length === 0 && project.chapters.length === 0 ? (
        <Empty title="첫 카드를 써 볼까요?" action={<Button variant="primary" onClick={() => act.addCard()}><Plus size={16} />새 카드</Button>} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragId('')}
          accessibility={{ announcements: {
            onDragStart: () => '카드를 들었어요.', onDragOver: ({ over }) => (over ? '이 자리로 옮겨요.' : undefined),
            onDragEnd: () => '카드를 놓았어요.', onDragCancel: () => '옮기기를 취소했어요.' } }}>
          {groups.map(({ chapter, scenes }, gi) => {
            const visible = on && lensMode === 'hide' ? scenes.filter(hit) : scenes;
            if (on && lensMode === 'hide' && visible.length === 0 && chapter) return null;
            return (
              <section key={chapter?.id ?? 'flat'} className="chapter" aria-label={chapter ? `${gi + 1}장` : '카드'}>
                {chapter && <ChapterHeader chapter={chapter} index={gi} scenes={scenes} total={scenes.length} />}
                <SortableContext items={visible.map((s) => s.id)} strategy={rectSortingStrategy}>
                  <div className={cx('grid', density === 'title' && 'is-compact')} role="list">
                    {visible.map((s, i) => (
                      <Card key={s.id} s={s} number={number.get(s.id)!} showMeta={showMeta && density === 'card'} dim={on && lensMode === 'dim' && !hit(s)}
                        selected={selection.includes(s.id)} selecting={selecting} chosen={route.sceneId === s.id} editing={editingId === s.id}
                        canSplitChapter={i > 0} hasNext={number.get(s.id)! < active.length}
                        gap={i > 0 && !dragId && !editingId ? <Gap before={s.id} canSplit={!on} /> : null} />
                    ))}
                    <EndTile chapterId={chapter?.id ?? null} />
                  </div>
                </SortableContext>
              </section>
            );
          })}
          <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
            {dragged && <DragCard s={dragged} number={number.get(dragged.id) ?? 0} more={selection.includes(dragged.id) ? selection.length - 1 : 0} />}
          </DragOverlay>
        </DndContext>
      )}
      <div className="board-foot">
        {project.chapters.length === 0
          ? active.length > 1 && <button type="button" className="foot-btn" onClick={act.startChapters}><Layers size={16} />장으로 나누기</button>
          : <button type="button" className="foot-btn" onClick={() => act.addChapter()}><Plus size={16} />새 장</button>}
        <span className="foot-space" />
        {trashCount > 0 && <button type="button" className="foot-btn is-quiet" onClick={() => ui.set({ bucket: 'trash', selection: [] })}><Trash2 size={15} />휴지통 {trashCount}</button>}
      </div>
      <SelectionBar />
    </div>
  );
}

/** 카드 사이 틈. 마우스를 올리면 '여기에 카드'와 '여기서 장 나누기'가 나타난다. */
function Gap({ before, canSplit }: { before: string; canSplit: boolean }) {
  return (
    <div className="gap" aria-hidden>
      <div className="gap-tools">
        <button type="button" tabIndex={-1} title="여기에 새 카드" onClick={() => act.addCard({ before })}><Plus size={14} /></button>
        {canSplit && <button type="button" tabIndex={-1} title="여기서 장 나누기" onClick={() => act.splitChapterAt(before)}><Scissors size={14} /></button>}
      </div>
    </div>
  );
}

function EndTile({ chapterId }: { chapterId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'end:' + (chapterId ?? '') });
  return (
    <button ref={setNodeRef} type="button" className={cx('end-tile', isOver && 'is-over')} onClick={() => act.addCard({ chapterId, at: 'end' })} aria-label="이 장 끝에 새 카드">
      <Plus size={20} />
    </button>
  );
}

function Empty({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="empty"><h2>{title}</h2>{action}</div>;
}
