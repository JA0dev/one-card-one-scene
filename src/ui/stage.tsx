// 진행 단계 색 점. 누르면 단계를 고르는 작은 판이 열린다.
import { useState } from 'react';
import { STAGES, STAGE_LABEL, type Stage } from '@/domain/types';
import { Pop, cx } from './kit';

export function StageDot({ stage, size = 'md' }: { stage: Stage; size?: 'sm' | 'md' | 'lg' }) {
  return <i className={cx('stage-dot', `dot-${size}`)} data-stage={stage} role="img" aria-label={'진행 단계 ' + STAGE_LABEL[stage]} />;
}

export function StagePicker({ stage, onChange, size = 'md', align = 'start' }: { stage: Stage; onChange: (s: Stage) => void; size?: 'sm' | 'md' | 'lg'; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      align={align}
      className="stage-pop"
      trigger={
        <button type="button" className="stage-btn" aria-label={`진행 단계: ${STAGE_LABEL[stage]} · 바꾸기`} title={STAGE_LABEL[stage]} data-no-drag>
          <StageDot stage={stage} size={size} />
        </button>
      }
    >
      <div role="radiogroup" aria-label="진행 단계" className="stage-options">
        {STAGES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={s === stage} className={cx('stage-option', s === stage && 'is-on')} onClick={() => { onChange(s); setOpen(false); }}>
            <StageDot stage={s} size="lg" />
            <span>{STAGE_LABEL[s]}</span>
          </button>
        ))}
      </div>
    </Pop>
  );
}

/** 카드 색을 이어 붙인 진척 막대 */
export function StageBar({ stages, label }: { stages: Stage[]; label: string }) {
  if (!stages.length) return null;
  const done = stages.filter((s) => s === 'done').length;
  return (
    <span className="stage-bar" role="img" aria-label={`${label} 진척: ${stages.length}장 중 ${done}장 완료`}>
      {stages.map((s, i) => <i key={i} data-stage={s} />)}
    </span>
  );
}
