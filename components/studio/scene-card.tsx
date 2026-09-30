'use client';
import type {ReactNode} from 'react';
import {SortableScene} from '@/components/sortable-scene';
import type {Scene} from '@/lib/manuscript';
import {count} from '@/lib/format';

export function SceneCard({s,number,chosen,showMeta,menu,onOpen}:{s:Scene;number:number;chosen:boolean;showMeta:boolean;menu:ReactNode;onOpen:()=>void}){
 return <SortableScene id={s.id} title={s.title} className={'scene-card '+(chosen?'chosen':'')}><div className="card-top"><div><span className="card-number">{String(number).padStart(2,'0')}</span>{showMeta&&<span className="stage">{s.stage}</span>}</div><div>{menu}</div></div><button className="card-content" onClick={onOpen}><h2 title={s.title}>{s.title||'제목 없는 씬'}</h2><span className="card-divider" aria-hidden="true"/><p>{s.summary||s.body.slice(0,180)||''}</p></button><div className="card-bottom"><span>{s.pov||'시점 미지정'}{s.place&&' · '+s.place}</span><span>{count(s.body).toLocaleString()}자</span></div></SortableScene>;
}
