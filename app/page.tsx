'use client';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from '@/components/ui/alert-dialog';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {NotebookPen,List,ListFilter,BookOpen,LayoutGrid,PenLine,Plus,Search,ArrowLeft,MoreHorizontal,Cloud,CloudOff,Check,ChevronDown,ChevronRight,History,Undo2,Sun,Moon,Monitor,Layers,X,Save,LoaderCircle,AlertCircle} from 'lucide-react';
import {DndContext,DragOverlay,MouseSensor,TouchSensor,KeyboardSensor,closestCenter,useSensor,useSensors} from '@dnd-kit/core';
import {SortableContext,rectSortingStrategy,sortableKeyboardCoordinates} from '@dnd-kit/sortable';
import {SceneCard} from '@/components/studio/scene-card';
import {SceneMenu,type SceneMenuHandlers} from '@/components/studio/scene-menu';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuRadioGroup,DropdownMenuRadioItem,DropdownMenuCheckboxItem,DropdownMenuLabel} from '@/components/ui/dropdown-menu';
import {Slider} from '@/components/ui/slider';
import {type Workspace,type Project,type Scene,fresh,sample,newScene,uid,checkpoint,moveScene,manuscript,download,validate} from '@/lib/manuscript';
import {sceneSwipe,type SwipePoint} from '@/lib/scene-swipe';
import * as disk from '@/lib/storage';
import * as cloud from '@/lib/cloud';
import {AccountBody,ExportBody,ProjectsBody,HistoryBody,ConflictBody,MoveBody} from '@/components/studio/dialogs';
import {count,time} from '@/lib/format';
import {objectJosa,splitScene,mergeScenes,duplicateScene,setBucket as withBucket,neighborInBucket,restoreOrder} from '@/lib/scene-ops';
import {exportProject,parseImport} from '@/lib/io';
import {Choice,IconButton,ManuscriptField} from '@/components/studio/fields';
export default function Studio(){
 const [data,setData]=useState<Workspace|null>(null),dataRef=useRef<Workspace|null>(null),env=useRef<disk.Envelope|undefined>(undefined),queue=useRef(Promise.resolve()),failed=useRef(false),generation=useRef(0);
 const sensors=useSensors(useSensor(MouseSensor,{activationConstraint:{distance:6}}),useSensor(TouchSensor,{activationConstraint:{delay:320,tolerance:8}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
 const suppressCardClick=useRef(0),sceneTouch=useRef<SwipePoint|null>(null),notesButton=useRef<HTMLButtonElement>(null);

 const [searchOpen,setSearchOpen]=useState(false),searchField=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(searchOpen)searchField.current?.focus();},[searchOpen]);
 const [stageFilter,setStageFilter]=useState('전체');
 const [projectId,setProjectId]=useState(''),[sceneId,setSceneId]=useState(''),[view,setView]=useState('board'),[bucket,setBucket]=useState('active'),[search,setSearch]=useState(''),[status,setStatus]=useState('원고 불러오는 중'),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [dialog,setDialog]=useState(''),[theme,setTheme]=useState('system'),[font,setFont]=useState(19),[line,setLine]=useState(2),[serif,setSerif]=useState(true),[timeline,setTimeline]=useState(false),[details,setDetails]=useState(false),[drag,setDrag]=useState(''),[undo,setUndo]=useState<string[]|null>(null),[compact,setCompact]=useState(false);
 useEffect(()=>{setDrag('');suppressCardClick.current=0;sceneTouch.current=null;},[view,projectId,bucket]);
 const [showMeta,setShowMeta]=useState(false);
 const [url,setUrl]=useState(''),[key,setKey]=useState(''),[account,setAccount]=useState(''),[busy,setBusy]=useState(false),syncing=useRef(false),[conflict,setConflict]=useState<{payload:Workspace;revision:number}|null>(null),[recovery,setRecovery]=useState<{data:Workspace;at:number}[]>([]),[offline,setOffline]=useState(false),[pwa,setPwa]=useState(false);
 const [deleteProjectId,setDeleteProjectId]=useState(''),[deletingProject,setDeletingProject]=useState(false);
 const boardScroll=useRef<HTMLElement>(null),positions=useRef<Record<string,number>>({}),pendingRead=useRef<string|null>(null),pendingBoard=useRef<string|null>(null),startSceneAtTop=useRef(false);
 const writingScroll=useRef<HTMLDivElement>(null),writingPane=useRef<HTMLElement>(null);
 const scrollContainer=()=>matchMedia('(min-width:761px)').matches?writingPane.current:writingScroll.current;
 const textarea=useRef<HTMLTextAreaElement>(null),importInput=useRef<HTMLInputElement>(null),bodyScroll=useRef<HTMLElement>(null),checkpointAt=useRef<Record<string,number>>({});
 const project=data?.projects.find(p=>p.id===projectId)??data?.projects[0],scene=project?.scenes.find(s=>s.id===sceneId)??project?.scenes.find(s=>s.bucket==='active'),active=project?.scenes.filter(s=>s.bucket==='active')??[],total=active.reduce((n,s)=>n+count(s.body),0);
 const sceneIndex=active.findIndex(s=>s.id===scene?.id),previousScene=sceneIndex>0?active[sceneIndex-1]:undefined,nextScene=sceneIndex>=0?active[sceneIndex+1]:undefined;
 const bucketNumber=new Map(project?.scenes.filter(x=>x.bucket===bucket).map((x,i)=>[x.id,i+1]));
 const filteredManuscript=active.filter(s=>stageFilter==='전체'||s.stage===stageFilter);
 const shown=project?.scenes.filter(s=>s.bucket===bucket&&(stageFilter==='전체'||s.stage===stageFilter)&&[s.title,s.summary,s.body,s.pov].join(' ').toLowerCase().includes(search.toLowerCase()))??[];
 const prefs=()=>JSON.parse(localStorage.getItem('scene-prefs')||'{}');
 function apply(w:Workspace){dataRef.current=w;setData(w);}
 function commit(w:Workspace){if(failed.current){setError('기기 저장이 중단되었습니다. 백업을 내려받은 뒤 새로고침해 주세요.');return;}apply(w);generation.current++;const thisGeneration=generation.current;setStatus('저장 중…');queue.current=queue.current.then(async()=>{if(failed.current)return;try{env.current=await disk.write(w,env.current?.rev??0);if(generation.current===thisGeneration)setStatus(navigator.onLine?'기기에 저장됨':'기기에 저장됨 · 오프라인');}catch(e){failed.current=true;setError(String((e as Error).message));setStatus('저장 실패 · 백업 필요');}});}
 function editProject(fn:(p:Project)=>Project){if(!dataRef.current||!project)return;commit({...dataRef.current,projects:dataRef.current.projects.map(p=>p.id===project.id?fn(p):p)});}
 function editScene(patch:Partial<Scene>,checkpointNow=false,targetId=scene?.id){if(!targetId)return;editProject(p=>({...p,scenes:p.scenes.map(s=>{if(s.id!==targetId)return s;let old=s;if(checkpointNow||('body'in patch&&Date.now()-(checkpointAt.current[s.id]??0)>60000)){old=checkpoint(s);checkpointAt.current[s.id]=Date.now();}return {...old,...patch};})}));}
 function chooseScene(s:Scene,write=false){if(Date.now()<suppressCardClick.current)return;setSceneId(s.id);if(write)setView('write');setDetails(false);}
 function changeView(next:string){
  if(next==='board'&&view==='write'&&scene)pendingBoard.current=scene.id;
  setDetails(false);setView(next);
 }
 function navigateScene(target:Scene){startSceneAtTop.current=true;chooseScene(target,true);}
 const swipeHandlers={
  onTouchStart:(e:React.TouchEvent)=>{sceneTouch.current=null;if(e.touches.length!==1||!matchMedia('(max-width:760px)').matches||(e.target as HTMLElement).closest('button,input,textarea,[role=combobox]'))return;const t=e.touches[0];if(t.clientX<24||t.clientX>window.innerWidth-24)return;sceneTouch.current={x:t.clientX,y:t.clientY,at:Date.now()};},
  onTouchMove:(e:React.TouchEvent)=>{if(e.touches.length!==1||sceneTouch.current&&Math.abs(e.touches[0].clientY-sceneTouch.current.y)>30)sceneTouch.current=null;},
  onTouchCancel:()=>{sceneTouch.current=null;},
  onTouchEnd:(e:React.TouchEvent)=>{const start=sceneTouch.current;sceneTouch.current=null;if(!start||!scene||!e.changedTouches[0])return;const t=e.changedTouches[0],direction=sceneSwipe(start,{x:t.clientX,y:t.clientY,at:Date.now()}),index=active.findIndex(s=>s.id===scene.id);if(direction&&index>=0&&active[index+direction])navigateScene(active[index+direction]);}
 };
 function addScene(){const s=newScene();editProject(p=>({...p,scenes:[...p.scenes,s]}));setSceneId(s.id);setBucket('active');setView('write');setNotice('새 씬을 만들었어요.');}
 function reorder(from:string,to:string){if(!project||from===to)return;setUndo(project.scenes.map(s=>s.id));editProject(p=>moveScene(p,from,to));}
 function shift(s:Scene,delta:number){const to=neighborInBucket(project!,s.id,delta);if(to)reorder(s.id,to);}
 function moveBucket(s:Scene,b:Scene['bucket']){editProject(p=>withBucket(p,s.id,b));setNotice(b==='trash'?'휴지통으로 이동했어요. 복원할 수 있어요.':b==='held'?'보류함으로 이동했어요.':'사용 중으로 되돌렸어요.');}
 function nextActiveOf(s:Scene){const i=active.findIndex(x=>x.id===s.id);return i<0?undefined:active[i+1];}
 function splitAtCursor(s:Scene){const r=splitScene(project!,s.id,textarea.current?.selectionStart??0);if(!r){setNotice('나눌 자리에 커서를 놓은 뒤 다시 선택해 주세요.');return;}editProject(()=>r.project);startSceneAtTop.current=true;setSceneId(r.newId);setNotice('커서 위치에서 씬을 나눴어요.');}
 function mergeWithNext(s:Scene){const next=nextActiveOf(s);if(!next)return;editProject(p=>mergeScenes(p,s.id,next.id));const name=next.title||'제목 없는 씬';setNotice('‘'+name+'’'+objectJosa(name)+' 합쳤어요. 원래 카드는 보류함에 있어요.');}
 function duplicate(s:Scene){const r=duplicateScene(project!,s.id);if(!r)return;editProject(()=>r.project);setSceneId(r.newId);}
 async function deleteProject(){
  if(deletingProject||failed.current||!dataRef.current)return;
  const target=dataRef.current.projects.find(p=>p.id===deleteProjectId);
  if(!target)return;
  setDeletingProject(true);
  try{
   await disk.preserve({schema:1,projects:[target]});
   if(failed.current)throw Error('저장 오류를 해결한 뒤 다시 시도해 주세요.');
   const current=dataRef.current!;
   const remaining=current.projects.filter(p=>p.id!==target.id);
   const projects=remaining.length?remaining:[{...fresh().projects[0],title:'제목 없는 이야기',subtitle:''}];
   commit({...current,projects});
   if(project?.id===target.id){setProjectId(projects[0].id);setSceneId('');setView('board');setBucket('active');setUndo(null);}
   setDeleteProjectId('');
   setNotice(remaining.length?'작품을 삭제했어요. 기기 복구 사본은 내보내기에 남겨뒀어요.':'작품을 삭제하고 빈 작업실을 열었어요. 기기 복구 사본은 내보내기에 남겨뒀어요.');
  }catch(e){setError((e as Error).message);setDeleteProjectId('');setDialog('');}
  finally{setDeletingProject(false);}
 }
 function openProject(id:string){setProjectId(id);setSceneId('');setView('board');setBucket('active');setUndo(null);setDialog('');}
 function newProject(example=false){const p=example?sample():{id:uid(),title:'제목 없는 이야기',subtitle:'',scenes:[newScene()]};commit({...dataRef.current!,projects:[...dataRef.current!.projects,p]});setProjectId(p.id);setSceneId(p.scenes[0].id);setBucket('active');setView('board');setDialog('');}
 async function sync(){if(syncing.current||failed.current||!cloud.session()||!navigator.onLine||conflict)return;syncing.current=true;setBusy(true);try{await queue.current;const e=env.current;if(!e)return;const start=generation.current;const endpoint=cloud.config()!.url;const remote=await cloud.pull();if(e.owner&&(e.owner!==remote.user||e.endpoint!==endpoint))throw Error('이 기기 원고는 다른 계정 또는 서버에 연결되어 있습니다. 백업 후 별도 브라우저에서 연결해 주세요.');if(!remote.row&&e.cloudRev>0)throw Error('서버 원고를 찾을 수 없습니다. 백업 후 서버를 확인해 주세요.');if(e.dirty){const r=await cloud.push(e.data,e.cloudRev);if(!r.ok){if(r.payload&&validate(r.payload)){setConflict({payload:r.payload,revision:r.revision});setDialog('conflict');}throw Error('다른 기기에서 수정한 원고가 있어요. 두 버전을 확인해 주세요.');}queue.current=queue.current.then(async()=>{env.current=await disk.write(dataRef.current!,env.current!.rev,{cloudRev:r.revision,dirty:generation.current!==start,owner:remote.user,endpoint});});await queue.current;}else if(remote.row&&remote.row.revision!==e.cloudRev){if(generation.current!==start)return;queue.current=queue.current.then(async()=>{if(generation.current!==start)return;await disk.preserve(dataRef.current!);env.current=await disk.write(remote.row!.payload,env.current!.rev,{cloudRev:remote.row!.revision,dirty:false,owner:remote.user,endpoint});apply(remote.row!.payload);});await queue.current;}setStatus(env.current?.dirty?'기기에 저장됨 · 동기화 대기':'동기화 완료');setError('');}catch(e){await queue.current.catch(()=>{failed.current=true;});setError((e as Error).message);setStatus(failed.current?'기기 저장 실패 · 백업 필요':'기기에 저장됨 · 동기화 대기');}finally{syncing.current=false;setBusy(false);}}
 async function useServerManuscript(){
  if(!conflict||!dataRef.current||busy||syncing.current||failed.current)return;
  syncing.current=true;setBusy(true);
  try{
   await queue.current;
   const start=generation.current;
   const endpoint=cloud.config()!.url;
   const remote=await cloud.pull();
   if(!remote.row||!validate(remote.row.payload))throw Error('서버 원고를 불러올 수 없습니다. 기기 원고는 유지됩니다.');
   if(env.current?.owner&&(env.current.owner!==remote.user||env.current.endpoint!==endpoint))throw Error('이 기기 원고와 연결된 계정을 확인해 주세요.');
   queue.current=queue.current.then(async()=>{
    if(generation.current!==start)throw Error('불러오는 동안 기기 원고가 변경됐어요. 다시 선택해 주세요.');
    await disk.preserve(dataRef.current!);
    if(generation.current!==start)throw Error('불러오는 동안 기기 원고가 변경됐어요. 다시 선택해 주세요.');
    const payload=remote.row!.payload;
    env.current=await disk.write(payload,env.current!.rev,{cloudRev:remote.row!.revision,dirty:false,owner:remote.user,endpoint});
    apply(payload);generation.current++;
    setProjectId(payload.projects[0].id);setSceneId('');setBucket('active');setView('board');setUndo(null);
   });
   await queue.current;
   setConflict(null);setDialog('');setError('');setStatus('동기화 완료');
   setNotice('서버 원고를 불러왔어요. 기존 기기 원고는 복구 사본에 보관했어요.');
  }catch(e){
   queue.current=queue.current.catch(()=>{});
   setError((e as Error).message);
  }finally{syncing.current=false;setBusy(false);}
 }
 async function resolveConflict(){if(!conflict||!dataRef.current)return;setBusy(true);try{await queue.current;await disk.preserve(dataRef.current);const copies=conflict.payload.projects.map(p=>({...p,id:uid(),title:p.title+' · 서버 사본',scenes:p.scenes.map(s=>({...s,id:uid()}))}));const merged={...dataRef.current,projects:[...dataRef.current.projects,...copies]};env.current=await disk.write(merged,env.current!.rev,{cloudRev:conflict.revision,dirty:true});apply(merged);generation.current++;setConflict(null);setDialog('');setNotice('기기 원고와 서버 원고를 각각 보존했어요. 동기화를 눌러 저장해 주세요.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{let alive=true;(async()=>{try{const saved=await disk.read();if(!alive)return;env.current=saved;if(saved)apply(saved.data);else{const w=fresh();env.current=await disk.write(w,0);if(!alive)return;apply(w);}const p=prefs();setProjectId(p.projectId??'');setSceneId(p.sceneId??'');setView(p.view??'board');setTheme(p.theme??'system');setFont(p.font??19);setLine(p.line??2);setSerif(p.serif!==false);setShowMeta(p.showMeta===true);setTimeline(p.timeline===true);setStatus('기기에 저장됨');const c=cloud.config();if(c){setUrl(c.url);setKey(c.key);}setAccount(cloud.session()?.user.email??'');setOffline(!navigator.onLine);if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{if(alive)setPwa(true);}).catch(()=>{});} }catch(e){setError((e as Error).message);}})();const online=()=>setOffline(!navigator.onLine);window.addEventListener('online',online);window.addEventListener('offline',online);const unload=(e:BeforeUnloadEvent)=>{if(failed.current){e.preventDefault();}};window.addEventListener('beforeunload',unload);return()=>{alive=false;window.removeEventListener('online',online);window.removeEventListener('offline',online);window.removeEventListener('beforeunload',unload);};},[]);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const change=()=>document.documentElement.classList.toggle('dark',theme==='dark'||theme==='system'&&media.matches);change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[theme]);
 useEffect(()=>{if(!data)return;localStorage.setItem('scene-prefs',JSON.stringify({...prefs(),projectId,sceneId,view,theme,font,line,serif,showMeta,timeline}));},[projectId,sceneId,view,theme,font,line,serif,showMeta,timeline,data!==null]);
 useEffect(()=>{if(!data||!account||conflict)return;const timer=setTimeout(()=>void sync(),2200);const poll=setInterval(()=>void sync(),30000);return()=>{clearTimeout(timer);clearInterval(poll);};},[data,account,offline,conflict]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4200);return()=>clearTimeout(t);},[notice]);
 useLayoutEffect(()=>{
  const input=textarea.current;
  if(view!=='write'||!input)return;
  const resize=()=>{
   const container=scrollContainer(),top=container?.scrollTop??0;
   input.style.height='0px';
   input.style.height=input.scrollHeight+'px';
   if(container)container.scrollTop=top;
  };
  resize();
  let active=true;
  document.fonts.ready.then(()=>{if(active)resize();});
  let width=input.getBoundingClientRect().width;
  const observer=new ResizeObserver(()=>{const next=input.getBoundingClientRect().width;if(next!==width){width=next;resize();}});
  observer.observe(input);
  return ()=>{active=false;observer.disconnect();};
 },[view,scene?.id,scene?.body,font,line,serif]);
 useLayoutEffect(()=>{const container=scrollContainer();if(container)container.scrollTop=view==='write'&&!startSceneAtTop.current?(prefs().writingPositions?.[scene?.id??'']??0):0;startSceneAtTop.current=false;},[view,scene?.id]);
 useLayoutEffect(()=>{
  if(!project)return;
  if(view==='board'&&boardScroll.current){
   boardScroll.current.scrollTop=positions.current['board:'+project.id+':'+bucket+':'+stageFilter+':'+search]??0;
   if(pendingBoard.current){
    const card=Array.from(boardScroll.current.querySelectorAll<HTMLElement>('[data-scene-id]')).find(el=>el.dataset.sceneId===pendingBoard.current);
    card?.scrollIntoView({block:'nearest'});
    card?.querySelector<HTMLButtonElement>('.card-content')?.focus({preventScroll:true});
    pendingBoard.current=null;
   }
  }
  if(view==='read'&&bodyScroll.current&&!pendingRead.current)bodyScroll.current.scrollTop=positions.current['read:'+project.id+':'+stageFilter]??0;
 },[view,project?.id,bucket,stageFilter,search]);
 useEffect(()=>{
  if(dialog||view!=='read'||!pendingRead.current)return;
  const id=pendingRead.current;
  const frame=requestAnimationFrame(()=>{const target=document.getElementById('manuscript-'+id);target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true});pendingRead.current=null;});
  return()=>cancelAnimationFrame(frame);
 },[dialog,view]);
 function exportFile(type:string){if(!project||!dataRef.current)return;exportProject(type,project,dataRef.current).catch(e=>setError((e as Error).message));}
 async function importFile(file:File){try{const copies=parseImport(file.name,await file.text());commit({...dataRef.current!,projects:[...dataRef.current!.projects,...copies]});setProjectId(copies[0].id);setDialog('');setNotice('기존 작품을 유지하고 새 작품으로 가져왔어요.');}catch(e){setError((e as Error).message);}}
 const menuHandlers:SceneMenuHandlers={duplicate,shift,moveTo:s=>{setSceneId(s.id);setDialog('move');},split:splitAtCursor,merge:mergeWithNext,moveBucket};
 const actions=(s:Scene,writing=false)=>{const next=s.bucket==='active'?nextActiveOf(s):undefined;return <SceneMenu s={s} writing={writing} on={menuHandlers} mergeTarget={next&&{scene:next,number:active.indexOf(next)+1}}/>;};
 if(!data||!project)return <main className="boot"><Layers size={34}/><h1>이야기를 불러오고 있어요</h1>{error?<p role="alert">{error}</p>:<p>기기에 저장된 원고를 확인합니다.</p>}</main>;
 return <div ref={writingScroll} onScroll={e=>{if(view!=='write'||!scene||e.target!==e.currentTarget)return;const p=prefs();localStorage.setItem('scene-prefs',JSON.stringify({...p,writingPositions:{...p.writingPositions,[scene.id]:e.currentTarget.scrollTop}}));}} className={'studio '+(view==='write'?'writing-mode ':'')+(!showMeta?'minimal-cards':'')}>
 <header className="topbar"><button className="header-project story-heading" onClick={()=>setDialog('projects')} aria-label="작품 제목과 설명 편집"><span><strong>{project.title||'제목 없는 이야기'}</strong>{project.subtitle&&<small>{project.subtitle}</small>}</span><ChevronDown size={15}/></button><div className="top-actions"><button className={'icon-button save-status '+(failed.current?'save-error':'')} title={status+' · '+(account?'지금 동기화':'로그인하여 동기화')} aria-label={status+' · '+(account?'지금 동기화':'로그인하여 동기화')} disabled={busy} onClick={()=>{if(failed.current){setNotice(status);return;}if(offline){setNotice('오프라인이에요. 원고는 이 기기에 저장됩니다.');return;}if(!account){setDialog('account');return;}if(conflict){setDialog('conflict');return;}void sync();}}>{failed.current?<AlertCircle size={19}/>:status==='저장 중…'||busy?<LoaderCircle className="saving-spin" size={19}/>:offline?<CloudOff size={19}/>:status==='동기화 완료'?<Cloud size={19}/>:<Save size={19}/>}</button><IconButton label="작품 메뉴" onClick={()=>setDialog('settings')}><MoreHorizontal size={21}/></IconButton></div></header>
 <div className="workspace">
 <main className="main">
 <div className="viewbar"><Tabs value={view==='write'?'board':view} onValueChange={changeView}><TabsList variant="line"><TabsTrigger value="board" aria-label={view==='write'?'구성으로 돌아가기':'구성'} title="구성" onClick={()=>{if(view==='write')changeView('board');}}><LayoutGrid/></TabsTrigger><TabsTrigger value="read" aria-label="전체 원고" title="전체 원고"><BookOpen/></TabsTrigger></TabsList></Tabs>{view==='board'&&<div className="collection-controls"><DropdownMenu><DropdownMenuTrigger asChild><button className="collection-picker" aria-label="씬 보관함 선택">{bucket==='active'?'사용 중':bucket==='held'?'보류함':'휴지통'}<ChevronDown size={14}/></button></DropdownMenuTrigger><DropdownMenuContent align="start">{[['active','사용 중'],['held','보류함'],['trash','휴지통']].map(([id,label])=><DropdownMenuItem key={id} onSelect={()=>{setBucket(id);setSearch('');}}>{label}<span className="collection-count">{project.scenes.filter(s=>s.bucket===id).length}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div>}<div className="view-actions">{view!=='board'&&<IconButton label="목차" onClick={()=>setDialog('outline')}><List size={20}/></IconButton>}{view==='board'?<><div className={'search-disclosure '+(searchOpen||search?'is-open':'')} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)&&!search)setSearchOpen(false);}} onKeyDown={e=>{if(e.key==='Escape'){if(!search)setSearchOpen(false);searchField.current?.blur();}}}><button className="icon-button" aria-label="씬 검색" title="씬 검색" aria-expanded={searchOpen||!!search} onClick={()=>{setSearchOpen(true);searchField.current?.focus();}}><Search size={18}/></button><input ref={searchField} aria-label="검색어" aria-hidden={!searchOpen&&!search} tabIndex={searchOpen||search?0:-1} placeholder="검색" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button className="icon-button" aria-label="검색 지우기" onClick={()=>{setSearch('');searchField.current?.focus();}}><X size={14}/></button>}</div></>:null}{(view==='board'||view==='read')&&<DropdownMenu><DropdownMenuTrigger asChild><button className={'icon-button filter-toggle '+(stageFilter!=='전체'?'is-filtered':'')} aria-label={'보기 옵션 · '+stageFilter} title={'보기 옵션 · '+stageFilter}><ListFilter size={20}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="view-options"><DropdownMenuLabel>진행 단계</DropdownMenuLabel><DropdownMenuRadioGroup value={stageFilter} onValueChange={setStageFilter}>{['전체','구상','초고','퇴고','완료'].map(stage=><DropdownMenuRadioItem key={stage} value={stage}>{stage}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>{view==='board'&&<><DropdownMenuSeparator/><DropdownMenuCheckboxItem checked={showMeta} onCheckedChange={setShowMeta} onSelect={e=>e.preventDefault()}>카드 부가 정보</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem checked={timeline} onCheckedChange={setTimeline} onSelect={e=>e.preventDefault()}>흐름</DropdownMenuCheckboxItem></>}</DropdownMenuContent></DropdownMenu>}{view==='board'&&<button className="new-scene-action" aria-label="새 씬 만들기" title="새 씬" onClick={addScene}><Plus size={20}/></button>}</div></div>
 {error&&<div className="error-banner" role="alert"><span>{error}</span><button onClick={()=>exportFile('json')}>백업</button><button aria-label="알림 닫기" onClick={()=>setError('')}><X size={16}/></button></div>}
 {view==='board'&&<section ref={boardScroll} onScroll={e=>{positions.current['board:'+project.id+':'+bucket+':'+stageFilter+':'+search]=e.currentTarget.scrollTop;}} className="board-area">{stageFilter!=='전체'&&<div className="collection-row">{stageFilter!=='전체'&&<button className="filter-summary" aria-label="진행 단계 필터 해제" onClick={()=>setStageFilter('전체')}>{stageFilter}<X size={13}/></button>}</div>}{undo&&<div className="board-caption">{undo&&<button onClick={()=>{editProject(p=>restoreOrder(p,undo));setUndo(null);}}><Undo2 size={14}/>순서 되돌리기</button>}</div>}<DndContext sensors={sensors} collisionDetection={closestCenter} autoScroll={{threshold:{x:.15,y:.18},acceleration:8}} accessibility={{screenReaderInstructions:{draggable:'스페이스로 씬을 선택하고 방향키로 이동한 뒤 스페이스로 놓으세요. Escape로 취소합니다.'},announcements:{onDragStart:()=> '씬 이동을 시작합니다.',onDragOver:({over})=>over?'이 위치로 이동합니다.':undefined,onDragEnd:()=> '씬 이동을 마쳤습니다.',onDragCancel:()=> '씬 이동을 취소했습니다.'}}} onDragStart={({active})=>{setDrag(String(active.id));suppressCardClick.current=Infinity;}} onDragCancel={()=>{setDrag('');suppressCardClick.current=Date.now()+350;}} onDragEnd={({active,over})=>{setDrag('');suppressCardClick.current=Date.now()+350;if(over&&active.id!==over.id)reorder(String(active.id),String(over.id));}}><SortableContext items={shown.map(s=>s.id)} strategy={rectSortingStrategy}><div className={'card-grid '+(compact?'compact':'')}>{shown.map(s=><SceneCard key={s.id} s={s} number={bucketNumber.get(s.id)??0} chosen={scene?.id===s.id} showMeta={showMeta} menu={actions(s)} onOpen={()=>chooseScene(s,true)}/>)}</div></SortableContext><DragOverlay dropAnimation={{duration:180,easing:'ease-out'}}>{drag&&project.scenes.find(s=>s.id===drag)&&<article className="scene-card drag-preview"><div className="card-content"><h2>{project.scenes.find(s=>s.id===drag)!.title}</h2><p>{project.scenes.find(s=>s.id===drag)!.summary||project.scenes.find(s=>s.id===drag)!.body.slice(0,100)}</p></div></article>}</DragOverlay></DndContext>{shown.length===0&&<div className="empty-state"><Layers size={28}/><h2>{search||stageFilter!=='전체'?'조건에 맞는 씬이 없어요':bucket==='active'?'첫 장면을 시작해 볼까요?':'아직 비어 있어요'}</h2></div>}</section>}
 {view==='write'&&scene&&<section ref={writingPane} onScroll={e=>{if(!scene||e.target!==e.currentTarget)return;const p=prefs();localStorage.setItem('scene-prefs',JSON.stringify({...p,writingPositions:{...p.writingPositions,[scene.id]:e.currentTarget.scrollTop}}));}} className="writing-area"><div className="editor-main" key={scene.id}><div className="editor-top scene-swipe-zone" {...swipeHandlers}><button className="eyebrow card-return" title="구성으로 돌아가기" aria-label="구성으로 돌아가기" onClick={()=>changeView('board')}>카드 {String(project.scenes.filter(s=>s.bucket===scene.bucket).findIndex(s=>s.id===scene.id)+1).padStart(2,'0')}{scene.bucket!=='active'?' · 원고 제외':''}</button><div><Choice label="작업 상태" value={scene.stage} onChange={v=>editScene({stage:v})} items={['구상','초고','퇴고','완료']}/><IconButton label="씬 저장 이력" onClick={()=>setDialog('history')}><History size={17}/></IconButton><button ref={notesButton} className="notes-trigger" aria-haspopup="dialog" aria-expanded={details} onClick={()=>setDetails(true)}><NotebookPen size={17}/><span>노트</span>{scene.notes.trim()&&<span className="note-mark" aria-label="메모 있음"/>}</button>{actions(scene,true)}</div></div><input className="scene-title" aria-label="씬 제목" placeholder="씬 제목" value={scene.title} onFocus={()=>{if(scene.title==='첫 장면'||scene.title==='제목 없는 씬')editScene({title:''},true);}} onChange={e=>editScene({title:e.target.value})}/><textarea className="scene-summary" rows={2} aria-label="씬 요약" placeholder="이 장면에서 무엇이 달라지나요?" value={scene.summary} onChange={e=>editScene({summary:e.target.value})}/><div className="editor-divider"/><textarea ref={textarea} className={'manuscript-editor '+(serif?'serif':'')} style={{fontSize:font,lineHeight:line}} aria-label="씬 본문" placeholder="본문" value={scene.body} onChange={e=>editScene({body:e.target.value})}/><div className="editor-footer scene-swipe-zone" {...swipeHandlers}><span>{count(scene.body).toLocaleString()}자 <span className="muted">· 공백 제외 {count(scene.body.replace(/\s/g,'')).toLocaleString()}자</span></span><nav className="scene-navigation" aria-label="이전 다음 씬">
 {previousScene?<button className="scene-neighbor previous" onClick={()=>navigateScene(previousScene)}><span>이전 · {String(sceneIndex).padStart(2,'0')}</span><strong>{previousScene.title||'제목 없는 씬'}</strong></button>:<span/>}
 {nextScene?<button className="scene-neighbor next" onClick={()=>navigateScene(nextScene)}><span>다음 · {String(sceneIndex+2).padStart(2,'0')}</span><strong>{nextScene.title||'제목 없는 씬'}</strong></button>:<button className="scene-neighbor next" onClick={()=>changeView('board')}><span>구성으로</span><strong>카드 돌아보기</strong></button>}
 </nav></div></div><Dialog open={details} onOpenChange={setDetails}><DialogContent className="studio-dialog scene-notes-dialog" aria-describedby={undefined} onCloseAutoFocus={e=>{e.preventDefault();notesButton.current?.focus({preventScroll:true});}}><DialogTitle>카드 {String(project.scenes.filter(s=>s.bucket===scene.bucket).findIndex(s=>s.id===scene.id)+1).padStart(2,'0')} · 노트</DialogTitle><div className="scene-notes-fields"><label>작업 메모<textarea autoFocus rows={8} placeholder="이 장면 전후로 무엇이 달라지나요?" value={scene.notes} onChange={e=>editScene({notes:e.target.value})}/></label><div className="scene-context-fields">{[['pov','시점 인물'],['place','장소'],['time','사건 시간']].map(([k,label])=><label key={k}>{label}<input value={scene[k as 'pov']} onChange={e=>editScene({[k]:e.target.value})} placeholder="선택 사항"/></label>)}</div></div></DialogContent></Dialog></section>}
 {view==='write'&&!scene&&<div className="empty-state"><p>작성할 씬이 없어요.</p><button className="primary" onClick={addScene}>새 씬 만들기</button></div>}
 {view==='read'&&<section ref={bodyScroll} onScroll={e=>{positions.current['read:'+project.id+':'+stageFilter]=e.currentTarget.scrollTop;}} className="reading-area"><div className="reading-caption">{stageFilter!=='전체'&&<button className="filter-summary" onClick={()=>setStageFilter('전체')} aria-label="진행 단계 필터 해제">{stageFilter}만 표시<X size={13}/></button>}<span>{filteredManuscript.length} 씬 · {filteredManuscript.reduce((n,s)=>n+count(s.body),0).toLocaleString()}자</span></div><article className={'full-manuscript '+(serif?'serif':'')} style={{fontSize:font,lineHeight:line}}><h1>{project.title}</h1>{filteredManuscript.map((s,i)=><section key={s.id} id={'manuscript-'+s.id} tabIndex={-1}>{i>0&&<div className="scene-break">* &nbsp; * &nbsp; *</div>}<button className="read-scene-title" onClick={()=>chooseScene(s,true)}>{String(active.findIndex(item=>item.id===s.id)+1).padStart(2,'0')} &nbsp; {s.title}<PenLine size={12}/></button><ManuscriptField value={s.body} label={`${active.findIndex(item=>item.id===s.id)+1}번 씬 본문`} onChange={body=>editScene({body},false,s.id)}/></section>)}{filteredManuscript.length===0&&<div className="empty-state"><p>조건에 맞는 씬이 없어요</p></div>}</article></section>}
 {view==='board'&&timeline&&<footer className={'timeline '+(!timeline?'collapsed':'')}><div className="timeline-head"><button onClick={()=>setTimeline(!timeline)}><Layers size={14}/>흐름 {timeline?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button><span>{filteredManuscript.length} 씬</span></div>{timeline&&<div className="timeline-track">{filteredManuscript.map((s,i)=><button key={s.id} className={scene?.id===s.id?'selected':''} style={{flex:Math.max(.6,Math.min(3,count(s.body)/250))}} onClick={()=>chooseScene(s,view!=='board')} title={s.title+' · '+count(s.body)+'자'}><span className={'timeline-fill '+(s.stage==='완료'?'done':'')}/><span>{String(active.findIndex(item=>item.id===s.id)+1).padStart(2,'0')} <em>{s.title}</em></span></button>)}</div>}</footer>}
 </main></div>{notice&&<div className="toast" role="status"><Check size={16}/>{notice}</div>}
 <Dialog open={!!dialog} onOpenChange={open=>{if(!open&&!(dialog==='conflict'&&busy))setDialog('');}}><DialogContent className={'studio-dialog '+(dialog==='outline'?'outline-dialog':'')} onCloseAutoFocus={e=>{if(pendingRead.current)e.preventDefault();}}><DialogTitle>{{outline:'목차',settings:'작품 메뉴',display:'화면',account:'계정',appearance:'본문 서식',export:'원고 내보내기',projects:'나의 작품',history:'씬 저장 이력',conflict:'어떤 원고로 계속할까요?',move:'씬 위치 바꾸기'}[dialog]??'작업실'}</DialogTitle><DialogDescription>{dialog==='history'?'본문 변경 전 최대 1분 간격으로 보존하며, 씬마다 최근 50개를 유지합니다.':dialog==='conflict'?'이 기기와 서버에 서로 다른 원고가 있어요.':dialog==='export'?'필터와 관계없이 원고의 모든 씬을 내보냅니다. 전체 백업에는 보류함·휴지통도 포함됩니다.':''}</DialogDescription>
 {['appearance','display','account','export'].includes(dialog)&&<button className="settings-back" onClick={()=>setDialog('settings')}><ArrowLeft size={16}/>작품 메뉴</button>}
 {dialog==='outline'&&<nav className="outline-list" aria-label="씬 목차">{(view==='read'?filteredManuscript:active).map(s=><button key={s.id} aria-current={scene?.id===s.id?'true':undefined} onClick={()=>{if(view==='read'){pendingRead.current=s.id;setSceneId(s.id);}else chooseScene(s,true);setDialog('');}}><span>{String(active.findIndex(item=>item.id===s.id)+1).padStart(2,'0')}</span><strong>{s.title||'제목 없는 씬'}</strong><span className="stage" data-stage={s.stage} title={s.stage}>{s.stage}</span></button>)}{view==='read'&&stageFilter!=='전체'&&<p className="outline-hint">{stageFilter} 씬만 표시</p>}{(view==='read'?filteredManuscript:active).length===0&&<p>표시할 씬이 없어요.</p>}</nav>}
 {dialog==='settings'&&<div className="settings-list">{[['appearance','본문 서식'],['display','화면'],['export','내려받기 · 백업'],['account',account?'계정 · '+account:'로그인 / 회원가입']].map(([id,label])=><button key={id} onClick={()=>setDialog(id)}><span>{label}</span><ChevronRight size={16}/></button>)}</div>}
 {dialog==='display'&&<><label className="field-label">화면 모드</label><div className="theme-options">{[['system','기기 설정',Monitor],['light','라이트',Sun],['dark','다크',Moon]].map(([v,label,Icon])=><button key={v as string} className={theme===v?'active':''} onClick={()=>setTheme(v as string)}>{typeof Icon!=='string'&&<Icon size={18}/>} {label as string}</button>)}</div></>}{dialog==='appearance'&&<><label className="field-label">글자 크기 <span>{font}px</span></label><Slider value={[font]} min={16} max={28} step={1} onValueChange={v=>setFont(v[0])} aria-label="글자 크기"/><label className="field-label">줄 간격 <span>{line.toFixed(1)}</span></label><Slider value={[line]} min={1.4} max={2.6} step={.1} onValueChange={v=>setLine(v[0])} aria-label="줄 간격"/><Choice label="본문 글꼴" value={serif?'명조':'고딕'} onChange={v=>setSerif(v==='명조')} items={['명조','고딕']}/></>}
 {dialog==='account'&&<AccountBody account={account} busy={busy} setBusy={setBusy} setAccount={setAccount} setStatus={setStatus}/>}
 {dialog==='export'&&<ExportBody exportFile={exportFile} importInput={importInput} recovery={recovery} setRecovery={setRecovery} setNotice={setNotice}/>}
 {dialog==='projects'&&<ProjectsBody project={project} data={data} editProject={editProject} openProject={openProject} setDeleteProjectId={setDeleteProjectId} newProject={newProject}/>}
 {dialog==='history'&&scene&&<HistoryBody scene={scene} editScene={editScene} setDialog={setDialog} setNotice={setNotice}/>}
 {dialog==='conflict'&&conflict&&<ConflictBody conflict={conflict} data={data} busy={busy} useServerManuscript={()=>void useServerManuscript()} resolveConflict={()=>void resolveConflict()}/>}
 {dialog==='move'&&scene&&<MoveBody project={project} scene={scene} setUndo={setUndo} editProject={editProject} setDialog={setDialog}/>}
 </DialogContent></Dialog><input ref={importInput} className="hidden" type="file" accept=".json,.md,.txt" onChange={e=>{if(e.target.files?.[0])void importFile(e.target.files[0]);e.target.value='';}}/>
 <AlertDialog open={!!deleteProjectId} onOpenChange={open=>{if(!open&&!deletingProject)setDeleteProjectId('');}}><AlertDialogContent><AlertDialogTitle>작품을 삭제할까요?</AlertDialogTitle><AlertDialogDescription>‘{data.projects.find(p=>p.id===deleteProjectId)?.title}’의 모든 씬과 메모가 작품 목록에서 삭제됩니다. 이 기기의 복구 사본은 내보내기 → 기기 복구 사본 확인에 남습니다.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={deletingProject}>취소</AlertDialogCancel><button className="primary destructive" disabled={deletingProject} onClick={()=>void deleteProject()}>{deletingProject?'삭제 중…':'작품 삭제'}</button></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
