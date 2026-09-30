// 장 제목 줄: 번호 · 제목(눌러서 고치기) · 진척 막대 · 카드 수 · 장 메뉴
import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, ChevronsUp, MoreHorizontal, PencilLine, Plus, Trash2 } from 'lucide-react';
import { chapterTitle } from '@/domain/chapters';
import type { Chapter, Scene } from '@/domain/types';
import * as act from '@/state/actions';
import { ui } from '@/state/app';
import { Button, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal, cx } from '@/ui/kit';
import { StageBar } from '@/ui/stage';

export function ChapterHeader({ chapter, index, scenes, total }: { chapter: Chapter; index: number; scenes: Scene[]; total: number }) {
  const editing = ui.use((s) => s.editingChapterId === chapter.id);
  const [remove, setRemove] = useState(false);
  const label = `${index + 1}장`;
  return (
    <header className="chapter-head">
      <div className="chapter-name">
        <span className="chapter-num">{label}</span>
        {editing ? <TitleInput chapter={chapter} /> : (
          <button type="button" className={cx('chapter-title', !chapter.title.trim() && 'is-empty')} onClick={() => ui.set({ editingChapterId: chapter.id })} aria-label={`${label} ${chapterTitle(chapter)} · 제목 고치기`}>
            {chapterTitle(chapter)}
          </button>
        )}
      </div>
      <div className="chapter-side">
        <StageBar stages={scenes.map((s) => s.stage)} label={label} />
        <span className="chapter-count">{total}장</span>
        <Menu>
          <MenuTrigger asChild><button type="button" className="chapter-more" aria-label={`${label} 메뉴`}><MoreHorizontal size={17} /></button></MenuTrigger>
          <MenuContent>
            <MenuItem icon={<PencilLine size={15} />} onSelect={() => ui.set({ editingChapterId: chapter.id })}>이름 바꾸기</MenuItem>
            <MenuItem icon={<Plus size={15} />} onSelect={() => act.addChapter({ before: chapter.id })}>위에 새 장</MenuItem>
            <MenuItem icon={<Plus size={15} />} onSelect={() => act.addChapter({ after: chapter.id })}>아래에 새 장</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<ChevronsUp size={15} />} disabled={index === 0} onSelect={() => act.mergeChapter(chapter.id)}>앞 장과 합치기</MenuItem>
            <MenuItem icon={<ArrowUpDown size={15} />} onSelect={() => ui.set({ dialog: { kind: 'chapters' } })}>장 순서 바꾸기…</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 size={15} />} danger onSelect={() => (total ? setRemove(true) : act.removeChapter(chapter.id, false))}>장 삭제</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <Modal open={remove} onOpenChange={setRemove} size="sm" title={`${label}을 지울까요?`} description={`이 장에 카드가 ${total}장 있어요.`}>
        <div className="choice-list">
          <Button onClick={() => { setRemove(false); act.removeChapter(chapter.id, false); }}>장 구분만 지우기<small>카드는 {index === 0 ? '다음' : '앞'} 장으로 옮겨져요</small></Button>
          <Button variant="danger" onClick={() => { setRemove(false); act.removeChapter(chapter.id, true); }}>카드까지 휴지통으로</Button>
        </div>
      </Modal>
    </header>
  );
}

function TitleInput({ chapter }: { chapter: Chapter }) {
  const ref = useRef<HTMLInputElement>(null);
  const before = useRef(chapter.title);
  const [value, setValue] = useState(chapter.title);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const done = (save: boolean) => {
    if (save && value !== before.current) act.renameChapter(chapter.id, value.trim());
    ui.set({ editingChapterId: '' });
  };
  return (
    <input ref={ref} className="chapter-input" value={value} placeholder="장 제목" aria-label="장 제목"
      onChange={(e) => setValue(e.target.value)} onBlur={() => done(true)}
      onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); done(true); } if (e.key === 'Escape') { e.preventDefault(); done(false); } }} />
  );
}
