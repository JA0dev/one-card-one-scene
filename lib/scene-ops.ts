import {type Project,type Scene,newScene,uid,checkpoint} from './manuscript';

// 받침에 따라 목적격 조사를 고른다. 한글이 아니면 '을(를)'.
export function objectJosa(name:string){const last=name.charCodeAt(name.length-1);return last>=0xAC00&&last<=0xD7A3?((last-0xAC00)%28?'을':'를'):'을(를)';}

export function splitScene(p:Project,id:string,pos:number):{project:Project;newId:string}|null{
 const s=p.scenes.find(x=>x.id===id);
 if(!s||pos<=0||pos>=s.body.length)return null;
 const next={...newScene((s.title||'제목 없는 씬')+' · 다음'),body:s.body.slice(pos).replace(/^\n+/,'')};
 return {project:{...p,scenes:p.scenes.flatMap(x=>x.id===id?[{...checkpoint(x),body:x.body.slice(0,pos).replace(/\n+$/,'')},next]:[x])},newId:next.id};
}

// 다음 씬의 본문을 이어 붙이고, 다음 씬 카드는 휴지통으로 보낸다.
export function mergeScenes(p:Project,id:string,nextId:string):Project{
 const next=p.scenes.find(x=>x.id===nextId);
 if(!next||id===nextId)return p;
 return {...p,scenes:p.scenes.map(x=>x.id===id?{...checkpoint(x),body:[x.body,next.body].filter(b=>b.trim()).join('\n\n')}:x.id===nextId?{...checkpoint(x),bucket:'trash'}:x)};
}

export function duplicateScene(p:Project,id:string):{project:Project;newId:string}|null{
 const s=p.scenes.find(x=>x.id===id);
 if(!s)return null;
 const c={...s,id:uid(),title:s.title+' (사본)',versions:[]};
 return {project:{...p,scenes:[...p.scenes,c]},newId:c.id};
}

export function setBucket(p:Project,id:string,bucket:Scene['bucket']):Project{
 return {...p,scenes:p.scenes.map(x=>x.id===id?{...checkpoint(x),bucket}:x)};
}

// 같은 보관함 안에서 delta만큼 떨어진 씬의 id. 없으면 undefined.
export function neighborInBucket(p:Project,id:string,delta:number){
 const list=p.scenes.filter(x=>x.bucket===p.scenes.find(s=>s.id===id)?.bucket),i=list.findIndex(x=>x.id===id);
 return i<0?undefined:list[i+delta]?.id;
}

// 저장해 둔 id 순서로 되돌린다. 그 뒤에 생긴 씬은 맨 뒤로.
export function restoreOrder(p:Project,order:string[]):Project{
 const rank=(id:string)=>{const i=order.indexOf(id);return i<0?1e9:i;};
 return {...p,scenes:[...p.scenes].sort((a,b)=>rank(a.id)-rank(b.id))};
}

// scene을 afterId 바로 뒤에 넣는다. afterId가 없으면 맨 뒤.
export function insertAfter(p:Project,afterId:string,scene:Scene):Project{
 const i=p.scenes.findIndex(x=>x.id===afterId),scenes=[...p.scenes];
 scenes.splice(i<0?scenes.length:i+1,0,scene);
 return {...p,scenes};
}

export function removeScene(p:Project,id:string):Project{return {...p,scenes:p.scenes.filter(x=>x.id!==id)};}

export function emptyTrash(p:Project):Project{return {...p,scenes:p.scenes.filter(x=>x.bucket!=='trash')};}

// from을 맨 뒤로 옮긴다.
export function moveToEnd(p:Project,from:string):Project{
 const moving=p.scenes.find(x=>x.id===from);
 return moving?{...p,scenes:[...p.scenes.filter(x=>x.id!==from),moving]}:p;
}

// from을 before 앞으로 옮긴다.
export function moveBefore(p:Project,from:string,before:string):Project{
 const moving=p.scenes.find(x=>x.id===from);
 if(!moving||from===before)return p;
 const list=p.scenes.filter(x=>x.id!==from),i=list.findIndex(x=>x.id===before);
 if(i<0)return p;
 list.splice(i,0,moving);
 return {...p,scenes:list};
}
