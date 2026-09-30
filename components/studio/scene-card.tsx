'use client';
import {type ReactNode,useEffect,useRef} from 'react';
import {SortableScene} from '@/components/sortable-scene';
import type {Scene} from '@/lib/manuscript';
import {count} from '@/lib/format';

export type EditEnd='save'|'cancel'|'blur';

// 보드 안에서 제목·요약을 고치는 입력. 입력은 바로 저장되고, Esc만 시작 전 값으로 되돌린다.
function CardEditor({s,onChange,onEnd}:{s:Scene;onChange:(patch:Partial<Scene>)=>void;onEnd:(how:EditEnd)=>void}){
 const title=useRef<HTMLInputElement>(null),summary=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{const el=title.current;if(!el)return;el.focus();el.setSelectionRange(el.value.length,el.value.length);},[]);
 const keys=(e:React.KeyboardEvent,enter:()=>void)=>{
  if(e.nativeEvent.isComposing||e.keyCode===229)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onEnd('cancel');}
  else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enter();}
 };
 return <div className="card-content card-editor" data-no-drag onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))onEnd('blur');}}><input ref={title} className="card-edit-title" aria-label="씬 제목" placeholder="씬 제목" value={s.title} onChange={e=>onChange({title:e.target.value})} onKeyDown={e=>keys(e,()=>summary.current?.focus())}/><span className="card-divider" aria-hidden="true"/><textarea ref={summary} className="card-edit-summary" rows={3} aria-label="씬 요약" placeholder="이 장면에서 무엇이 달라지나요?" value={s.summary} onChange={e=>onChange({summary:e.target.value})} onKeyDown={e=>keys(e,()=>onEnd('save'))}/></div>;
}

export const STAGE_KEYS:Record<string,string>={구상:'idea',초고:'draft',퇴고:'revise',완료:'done'};
// 진행 단계는 글자 없이 색 점으로만 보여준다. 밝은 색(구상)에서 짙은 색(완료)으로 차오른다.
export function StageMark({stage}:{stage:string}){ return <i className="stage-mark" data-stage={STAGE_KEYS[stage]||'idea'} role="img" aria-label={'진행 단계 '+stage} title={stage}/>; }

export function SceneCard({s,number,chosen,menu,onOpen,editing=false,onEdit,onEditEnd}:{s:Scene;number:number;chosen:boolean;menu:ReactNode;onOpen:()=>void;editing?:boolean;onEdit:(patch:Partial<Scene>)=>void;onEditEnd:(how:EditEnd)=>void}){
 return <SortableScene id={s.id} title={s.title} disabled={editing} className={'scene-card '+(chosen?'chosen ':'')+(editing?'editing':'')}><div className="card-top"><div><span className="card-number">{String(number).padStart(2,'0')}</span><StageMark stage={s.stage}/></div><div>{menu}</div></div>{editing?<CardEditor s={s} onChange={onEdit} onEnd={onEditEnd}/>:<button className="card-content" onClick={onOpen}><h2 title={s.title}>{s.title||'제목 없는 씬'}</h2><span className="card-divider" aria-hidden="true"/><p>{s.summary||s.body.slice(0,180)||''}</p></button>}<div className="card-bottom"><span>{s.pov||'시점 미지정'}{s.place&&' · '+s.place}</span><span>{count(s.body).toLocaleString()}자</span></div></SortableScene>;
}
