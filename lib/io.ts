import {type Workspace,type Project,newScene,uid,manuscript,download,validate} from './manuscript';

// 내보내기. 실패하면 사용자에게 보여줄 메시지로 reject한다.
export async function exportProject(type:string,project:Project,workspace:Workspace){
 if(type==='json'){download(project.title+'-백업.json',JSON.stringify(workspace,null,2),'application/json');return;}
 if(type==='docx'){
  try{
   const {Document,Packer,Paragraph,HeadingLevel,TextRun}=await import('docx');
   const active=project.scenes.filter(s=>s.bucket==='active');
   const doc=new Document({sections:[{children:[new Paragraph({text:project.title,heading:HeadingLevel.TITLE}),...active.flatMap((s,i)=>[...(i?[new Paragraph({text:'* * *',alignment:'center'})]:[]),...s.body.split('\n').map(text=>new Paragraph({children:[new TextRun({text,font:'맑은 고딕',size:22})],spacing:{after:160,line:360}}))])]}]});
   download(project.title+'.docx',await Packer.toBlob(doc));
  }catch{throw Error('Word 파일 생성에 실패했습니다. TXT 또는 백업을 사용해 주세요.');}
  return;
 }
 download(project.title+(type==='md'?'.md':'.txt'),manuscript(project,type==='md'));
}

// 가져오기. 기존 작품을 덮어쓰지 않도록 항상 새 id를 가진 작품으로 돌려준다.
export function parseImport(name:string,text:string):Project[]{
 if(name.endsWith('.json')){
  const w=JSON.parse(text);
  if(!validate(w))throw Error('지원하지 않는 백업 파일입니다.');
  return w.projects.map((p:Project)=>({...p,id:uid(),title:p.title+' · 가져옴',scenes:p.scenes.map(s=>({...s,id:uid()}))}));
 }
 const scenes=text.split(/^##\s+/m).map((part,i)=>{const lines=part.split('\n');return {...newScene(i===0?'첫 장면':lines.shift()||'새 씬'),body:lines.join('\n').trim()};}).filter(s=>s.body);
 return [{id:uid(),title:name.replace(/\.[^.]+$/,''),subtitle:'가져온 원고',scenes:scenes.length?scenes:[newScene()]}];
}
