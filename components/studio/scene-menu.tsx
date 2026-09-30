'use client';
import {MoreHorizontal,Copy,ArrowUp,ArrowDown,Scissors,Combine,Undo2,Archive,Trash2} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator} from '@/components/ui/dropdown-menu';
import type {Scene} from '@/lib/manuscript';

export type SceneMenuHandlers={
 duplicate:(s:Scene)=>void;
 shift:(s:Scene,delta:number)=>void;
 moveTo:(s:Scene)=>void;
 split:(s:Scene)=>void;
 merge:(s:Scene)=>void;
 moveBucket:(s:Scene,b:Scene['bucket'])=>void;
};

// mergeTarget: 합칠 다음 씬과 그 번호. 없으면 합치기 항목을 숨긴다.
export function SceneMenu({s,writing=false,mergeTarget,on}:{s:Scene;writing?:boolean;mergeTarget?:{scene:Scene;number:number};on:SceneMenuHandlers}){
 return <DropdownMenu><DropdownMenuTrigger asChild><button data-no-drag className="icon-button" aria-label={s.title+' 작업'}><MoreHorizontal size={18}/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>on.duplicate(s)}><Copy/>씬 복제</DropdownMenuItem><DropdownMenuItem onSelect={()=>on.shift(s,-1)}><ArrowUp/>앞으로 이동</DropdownMenuItem><DropdownMenuItem onSelect={()=>on.shift(s,1)}><ArrowDown/>뒤로 이동</DropdownMenuItem><DropdownMenuItem onSelect={()=>on.moveTo(s)}>특정 씬 앞으로 이동</DropdownMenuItem>{(writing||mergeTarget)&&<DropdownMenuSeparator/>}{writing&&<DropdownMenuItem onSelect={()=>on.split(s)}><Scissors/>커서 위치에서 나누기</DropdownMenuItem>}{mergeTarget&&<DropdownMenuItem onSelect={()=>on.merge(s)}><Combine/><span className="menu-two-line"><span>다음 씬과 합치기</span><small>{String(mergeTarget.number).padStart(2,'0')} {mergeTarget.scene.title||'제목 없는 씬'}</small></span></DropdownMenuItem>}<DropdownMenuSeparator/>{s.bucket!=='active'&&<DropdownMenuItem onSelect={()=>on.moveBucket(s,'active')}><Undo2/>사용 중으로 되돌리기</DropdownMenuItem>}{s.bucket==='active'&&<DropdownMenuItem onSelect={()=>on.moveBucket(s,'held')}><Archive/>보류함으로 이동</DropdownMenuItem>}{s.bucket!=='trash'&&<DropdownMenuItem onSelect={()=>on.moveBucket(s,'trash')}><Trash2/>휴지통으로 이동</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>;
}
