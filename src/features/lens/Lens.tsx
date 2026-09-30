// 렌즈: 진행 단계·시점 인물·장소로 카드를 골라 본다. 보드에서는 맞지 않는 카드를 흐리게 둘 수 있다.
import { SlidersHorizontal, X } from 'lucide-react';
import { useMemo } from 'react';
import { emptyLens, facets, lensActive, lensFilters, toggle } from '@/domain/lens';
import { activeScenes } from '@/domain/scenes';
import { STAGES, STAGE_LABEL } from '@/domain/types';
import { ui, useProject } from '@/state/app';
import { prefs } from '@/state/prefs';
import { IconButton, Pop, cx } from '@/ui/kit';
import { StageDot } from '@/ui/stage';

export function LensButton() {
  const project = useProject();
  const lens = ui.use((s) => s.lens);
  const mode = prefs.use((p) => p.lensMode);
  const list = useMemo(() => (project ? facets(activeScenes(project)) : { povs: [], places: [] }), [project]);
  const set = (patch: Partial<typeof lens>) => ui.set({ lens: { ...lens, ...patch } });
  const n = lensFilters(lens);
  return (
    <Pop
      className="lens-pop"
      trigger={
        <IconButton label={n ? `렌즈 · ${n}개 켜짐` : '렌즈'} active={n > 0}>
          <SlidersHorizontal size={19} />
          {n > 0 && <span className="count-pip">{n}</span>}
        </IconButton>
      }
    >
      <section className="lens-section">
        <h3>진행 단계</h3>
        <div className="chip-row">
          {STAGES.map((s) => (
            <button key={s} type="button" className={cx('chip', lens.stages.includes(s) && 'is-on')} aria-pressed={lens.stages.includes(s)} onClick={() => set({ stages: toggle(lens.stages, s) })}>
              <StageDot stage={s} size="sm" />{STAGE_LABEL[s]}
            </button>
          ))}
        </div>
      </section>
      <FacetSection title="시점 인물" empty="카드 노트에 시점 인물을 적으면 여기서 고를 수 있어요." values={list.povs} on={lens.povs} toggle={(v) => set({ povs: toggle(lens.povs, v) })} />
      <FacetSection title="장소" empty="카드 노트에 장소를 적으면 여기서 고를 수 있어요." values={list.places} on={lens.places} toggle={(v) => set({ places: toggle(lens.places, v) })} />
      <section className="lens-section lens-foot">
        <div className="seg seg-sm" role="radiogroup" aria-label="맞지 않는 카드">
          {(['dim', 'hide'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={cx('seg-item', mode === m && 'is-on')} onClick={() => prefs.set({ lensMode: m })}>
              {m === 'dim' ? '나머지 흐리게' : '나머지 숨기기'}
            </button>
          ))}
        </div>
        <button type="button" className="link-btn" disabled={!lensActive(lens)} onClick={() => ui.set({ lens: emptyLens })}>모두 해제</button>
      </section>
    </Pop>
  );
}

function FacetSection({ title, values, on, toggle: flip, empty }: { title: string; values: { value: string; count: number }[]; on: string[]; toggle: (v: string) => void; empty: string }) {
  return (
    <section className="lens-section">
      <h3>{title}</h3>
      {values.length === 0 ? <p className="lens-empty">{empty}</p> : (
        <div className="chip-row">
          {values.map((f) => (
            <button key={f.value} type="button" className={cx('chip', on.includes(f.value) && 'is-on')} aria-pressed={on.includes(f.value)} onClick={() => flip(f.value)}>
              {f.value}<span className="chip-count">{f.count}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** 켜진 조건을 칩으로 보여주고 하나씩 또는 한꺼번에 끈다. */
export function LensBar({ matched, total }: { matched: number; total: number }) {
  const lens = ui.use((s) => s.lens);
  if (!lensActive(lens)) return null;
  const set = (patch: Partial<typeof lens>) => ui.set({ lens: { ...lens, ...patch } });
  return (
    <div className="lens-bar" role="region" aria-label="켜진 렌즈">
      {lens.query.trim() && <Chip onRemove={() => set({ query: '' })}>“{lens.query.trim()}”</Chip>}
      {lens.stages.map((s) => <Chip key={s} onRemove={() => set({ stages: lens.stages.filter((x) => x !== s) })}><StageDot stage={s} size="sm" />{STAGE_LABEL[s]}</Chip>)}
      {lens.povs.map((v) => <Chip key={'p' + v} onRemove={() => set({ povs: lens.povs.filter((x) => x !== v) })}>시점 · {v}</Chip>)}
      {lens.places.map((v) => <Chip key={'l' + v} onRemove={() => set({ places: lens.places.filter((x) => x !== v) })}>장소 · {v}</Chip>)}
      <span className="lens-count">{total}장 중 {matched}장</span>
      <button type="button" className="link-btn" onClick={() => ui.set({ lens: emptyLens })}>모두 해제</button>
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="chip is-on is-static">
      {children}
      <button type="button" className="chip-x" aria-label="이 조건 끄기" onClick={onRemove}><X size={12} /></button>
    </span>
  );
}
