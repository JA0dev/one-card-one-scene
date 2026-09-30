'use client';
import {useEffect,useLayoutEffect,useRef} from 'react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
export function Choice({value,onChange,items,label}:{value:string;onChange:(v:string)=>void;items:string[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>}
export function IconButton({children,label,onClick,disabled=false}:{children:React.ReactNode;label:string;onClick:()=>void;disabled?:boolean}){return <button className="icon-button" title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>}
export function ManuscriptField({value,label,onChange}:{value:string;label:string;onChange:(value:string)=>void}){
 const ref=useRef<HTMLTextAreaElement>(null);
 useLayoutEffect(()=>{const el=ref.current;if(!el)return;const resize=()=>{el.style.height='0px';el.style.height=el.scrollHeight+'px';};resize();},[value]);
 useEffect(()=>{const el=ref.current;if(!el)return;let alive=true;const resize=()=>{if(!alive)return;el.style.height='0px';el.style.height=el.scrollHeight+'px';};const observer=new ResizeObserver(resize);if(el.parentElement)observer.observe(el.parentElement);document.fonts.ready.then(resize);return()=>{alive=false;observer.disconnect();};},[]);
 return <textarea ref={ref} className="full-manuscript-editor" rows={1} aria-label={label} placeholder="본문" value={value} onChange={e=>onChange(e.target.value)}/>;
}
