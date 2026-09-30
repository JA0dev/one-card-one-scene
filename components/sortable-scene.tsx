'use client';
import type {ReactNode} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

export function SortableScene({id,title,className,children}:{id:string;title:string;className:string;children:ReactNode}){
 const {attributes,listeners,setNodeRef,transform,transition,isDragging,isOver}=useSortable({id});
 const allowed=(event:React.SyntheticEvent)=>!(event.target as HTMLElement).closest('[data-no-drag]');
 return <article data-scene-id={id} ref={setNodeRef} {...attributes} role="group" aria-label={title+' 카드'} aria-roledescription="순서 변경 가능한 씬" className={className+(isDragging?' sorting-source':'')+(isOver&&!isDragging?' sorting-target':'')} style={{transform:CSS.Transform.toString(transform),transition}} onMouseDown={e=>{if(allowed(e))listeners?.onMouseDown?.(e);}} onTouchStart={e=>{if(allowed(e))listeners?.onTouchStart?.(e);}} onKeyDown={e=>{if(e.target===e.currentTarget)listeners?.onKeyDown?.(e);}} onContextMenu={e=>{if(allowed(e))e.preventDefault();}}>{children}</article>;
}
