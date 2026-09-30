import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'scene-ops-'));
for(const name of ['manuscript','scene-ops','io']){const source=await fs.readFile('lib/'+name+'.ts','utf8');const code=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}).replace("'./manuscript'","'./manuscript.mjs'");await fs.writeFile(dir+'/'+name+'.mjs',code);}
const m=await import(pathToFileURL(dir+'/manuscript.mjs').href),o=await import(pathToFileURL(dir+'/scene-ops.mjs').href),io=await import(pathToFileURL(dir+'/io.mjs').href);
const ids=p=>p.scenes.map(s=>s.id);

test('objectJosa',()=>{assert.equal(o.objectJosa('편지'),'를');assert.equal(o.objectJosa('문'),'을');assert.equal(o.objectJosa('Scene'),'을(를)');});

test('splitScene: 커서 위치에서 나누고 바로 뒤에 새 씬',()=>{
 const p=m.sample(),s=p.scenes[0],pos=s.body.indexOf('\n\n');
 const r=o.splitScene(p,s.id,pos);
 assert.equal(r.project.scenes.length,p.scenes.length+1);
 assert.equal(r.project.scenes[1].id,r.newId);
 assert.equal(r.project.scenes[0].body,s.body.slice(0,pos));
 assert.ok(!r.project.scenes[1].body.startsWith('\n'));
 assert.equal(r.project.scenes[0].versions[0].body,s.body);
 assert.equal(o.splitScene(p,s.id,0),null);
 assert.equal(o.splitScene(p,s.id,s.body.length),null);
});

test('mergeScenes: 본문을 잇고 다음 씬은 보류함',()=>{
 const p=m.sample(),[a,b]=p.scenes,r=o.mergeScenes(p,a.id,b.id);
 assert.equal(r.scenes[0].body,a.body+'\n\n'+b.body);
 assert.equal(r.scenes[1].bucket,'held');
 assert.deepEqual(ids(r),ids(p));
 const empty=o.mergeScenes(p,p.scenes[2].id,p.scenes[3].id);
 assert.equal(empty.scenes[2].body,'');
});

test('duplicateScene: 끝에 사본, 이력은 비움',()=>{
 const p=m.sample(),r=o.duplicateScene(p,p.scenes[0].id),c=r.project.scenes.at(-1);
 assert.equal(c.id,r.newId);assert.equal(c.title,p.scenes[0].title+' (사본)');assert.deepEqual(c.versions,[]);
});

test('setBucket / neighborInBucket',()=>{
 const p=o.setBucket(m.sample(),m.sample().scenes[0].id,'held');
 const q=m.sample(),held=o.setBucket(q,q.scenes[1].id,'held');
 assert.equal(held.scenes[1].bucket,'held');
 assert.equal(o.neighborInBucket(held,q.scenes[0].id,1),q.scenes[2].id);
 assert.equal(o.neighborInBucket(held,q.scenes[0].id,-1),undefined);
 assert.equal(p.scenes.length,5);
});

test('moveBefore / restoreOrder',()=>{
 const p=m.sample(),order=ids(p),moved=o.moveBefore(p,order[4],order[1]);
 assert.deepEqual(ids(moved),[order[0],order[4],order[1],order[2],order[3]]);
 assert.deepEqual(ids(o.restoreOrder(moved,order)),order);
 assert.equal(o.moveBefore(p,order[0],'없음'),p);
});

test('parseImport: Markdown과 백업',()=>{
 const [md]=io.parseImport('원고.md','서문\n\n## 첫째\n본문 1\n## 둘째\n본문 2');
 assert.equal(md.title,'원고');assert.deepEqual(md.scenes.map(s=>s.title),['첫 장면','첫째','둘째']);
 const w=m.fresh(),[copy]=io.parseImport('b.json',JSON.stringify(w));
 assert.notEqual(copy.id,w.projects[0].id);assert.ok(copy.title.endsWith(' · 가져옴'));
 assert.throws(()=>io.parseImport('x.json','{"schema":2}'),/지원하지 않는/);
});

test.after(()=>fs.rm(dir,{recursive:true}));
