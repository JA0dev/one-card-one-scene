// 작품 정보, 빠른 이동(⌘K)
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Plus, Search } from 'lucide-react';
import { chapterLabel } from '@/domain/chapters';
import { activeScenes } from '@/domain/scenes';
import { pad } from '@/domain/text';
import { addCard, editProjectInfo, openScene } from '@/state/actions';
import { ui, useProject } from '@/state/app';
import { go } from '@/state/nav';
import { Button, Modal, cx } from '@/ui/kit';
import { StageDot } from '@/ui/stage';

export function ProjectDialog() {
  const open = ui.use((s) => s.dialog?.kind === 'project');
  const project = useProject();
  if (!project) return null;
  return (
    <Modal open={open} onOpenChange={(o) => !o && ui.set({ dialog: null })} title="작품 정보" size="sm">
      <div className="form">
        <label className="field-input">제목<input autoFocus value={project.title} placeholder="제목 없는 이야기" onChange={(e) => editProjectInfo({ title: e.target.value })} /></label>
        <label className="field-input">한 줄 설명<input value={project.subtitle} placeholder="선택 사항" onChange={(e) => editProjectInfo({ subtitle: e.target.value })} /></label>
        <div className="modal-actions"><Button variant="primary" onClick={() => ui.set({ dialog: null })}>완료</Button></div>
      </div>
    </Modal>
  );
}

/** 제목·요약·본문으로 카드를 찾아 바로 연다. 검색어로 보드를 거를 수도 있다. */
export function QuickJump() {
  const open = ui.use((s) => s.dialog?.kind === 'jump');
  const project = useProject();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => { if (open) { setQ(''); setI(0); } }, [open]);

  const results = useMemo(() => {
    if (!project) return [];
    const all = activeScenes(project).map((s, n) => ({ s, n: n + 1 }));
    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, 40).map((r) => ({ ...r, hit: '' }));
    return all.flatMap((r) => {
      const t = r.s.title.toLowerCase().includes(needle) ? 3 : r.s.summary.toLowerCase().includes(needle) ? 2 : r.s.body.toLowerCase().includes(needle) ? 1 : 0;
      if (!t) return [];
      const at = r.s.body.toLowerCase().indexOf(needle);
      const hit = t === 1 && at >= 0 ? '…' + r.s.body.slice(Math.max(0, at - 16), at + needle.length + 30).replace(/\s+/g, ' ') + '…' : '';
      return [{ ...r, rank: t, hit }];
    }).sort((a, b) => (b as { rank: number }).rank - (a as { rank: number }).rank).slice(0, 40);
  }, [project, q]);

  const close = () => ui.set({ dialog: null });
  const choose = (id: string) => { close(); openScene(id); };
  const filter = () => { ui.set((s) => ({ dialog: null, lens: { ...s.lens, query: q.trim() } })); go({ view: 'board', sceneId: '' }); };
  const count = results.length + (q.trim() ? 1 : 0) + 1;

  const keys = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => (x + 1) % count); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => (x - 1 + count) % count); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (i < results.length) choose(results[i].s.id);
      else if (q.trim() && i === results.length) filter();
      else { close(); go({ view: 'board', sceneId: '' }); addCard(); }
    }
  };
  useEffect(() => { list.current?.querySelector<HTMLElement>('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' }); }, [i]);

  return (
    <Modal open={open} onOpenChange={(o) => !o && close()} title="찾기" className="jump" size="md">
      <div className="jump-input">
        <Search size={18} />
        <input autoFocus role="combobox" aria-expanded aria-controls="jump-list" aria-activedescendant={`jump-${i}`} placeholder="씬 제목이나 문장으로 찾기" value={q}
          onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={keys} />
        <kbd>esc</kbd>
      </div>
      <ul id="jump-list" ref={list} role="listbox" className="jump-list">
        {results.map((r, n) => (
          <li key={r.s.id} id={`jump-${n}`} role="option" aria-selected={i === n} className={cx('jump-row', i === n && 'is-on')} onMouseEnter={() => setI(n)} onClick={() => choose(r.s.id)}>
            <span className="jump-num">{pad(r.n)}</span><StageDot stage={r.s.stage} size="sm" />
            <span className="jump-main"><strong>{r.s.title || '제목 없는 씬'}</strong>{r.hit ? <small>{r.hit}</small> : r.s.summary && <small>{r.s.summary}</small>}</span>
            <span className="jump-meta">{project && chapterLabel(project, r.s.chapterId)}</span>
            {i === n && <CornerDownLeft size={14} className="jump-enter" />}
          </li>
        ))}
        {q.trim() && (
          <li id={`jump-${results.length}`} role="option" aria-selected={i === results.length} className={cx('jump-row is-command', i === results.length && 'is-on')} onMouseEnter={() => setI(results.length)} onClick={filter}>
            <Search size={15} /><span className="jump-main"><strong>보드에서 “{q.trim()}” 카드만 보기</strong></span>
          </li>
        )}
        <li id={`jump-${count - 1}`} role="option" aria-selected={i === count - 1} className={cx('jump-row is-command', i === count - 1 && 'is-on')} onMouseEnter={() => setI(count - 1)} onClick={() => { close(); go({ view: 'board', sceneId: '' }); addCard(); }}>
          <Plus size={15} /><span className="jump-main"><strong>새 카드</strong></span>
        </li>
      </ul>
    </Modal>
  );
}
