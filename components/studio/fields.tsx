'use client';
import {useEffect,useLayoutEffect,useRef} from 'react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
export function Choice({value,onChange,items,label}:{value:string;onChange:(v:string)=>void;items:string[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>}
export function IconButton({children,label,onClick,disabled=false}:{children:React.ReactNode;label:string;onClick:()=>void;disabled?:boolean}){return <button className="icon-button" title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>}
// 내용 높이에 맞춰 늘고 줄어드는 textarea. 높이를 다시 잴 때 바깥 스크롤 위치는 그대로 둔다.
export function AutoTextarea(props:React.TextareaHTMLAttributes<HTMLTextAreaElement>&{value:string}){
 const ref=useRef<HTMLTextAreaElement>(null);
 const resize=()=>{const el=ref.current;if(!el)return;const kept:[Element,number][]=[];for(let a=el.parentElement;a;a=a.parentElement)if(a.scrollTop)kept.push([a,a.scrollTop]);el.style.height='0px';el.style.height=el.scrollHeight+'px';kept.forEach(([a,top])=>{a.scrollTop=top;});};
 useLayoutEffect(resize,[props.value]);
 useEffect(()=>{const el=ref.current;if(!el)return;let alive=true;const again=()=>{if(alive)resize();};const observer=new ResizeObserver(again);if(el.parentElement)observer.observe(el.parentElement);document.fonts.ready.then(again);return()=>{alive=false;observer.disconnect();};},[]);
 return <textarea ref={ref} rows={1} {...props}/>;
}
export function ManuscriptField({value,label,onChange}:{value:string;label:string;onChange:(value:string)=>void}){
 return <AutoTextarea className="full-manuscript-editor" aria-label={label} placeholder="본문" value={value} onChange={e=>onChange(e.target.value)}/>;
}
