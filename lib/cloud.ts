import {type Workspace,validate} from './manuscript';
export type Config={url:string;key:string};
export type Session={access_token:string;refresh_token:string;expires_at:number;user:{id:string;email?:string}};
const DEFAULT_CONFIG:Config={url:'https://pxkhqndymobrxxsknzqr.supabase.co',key:'sb_publishable_S07_i3hMcTvaPHcIHHfW1w_QfOkeYeF'};
export function config():Config|null {try{return JSON.parse(localStorage.getItem('scene-cloud')||'null')??DEFAULT_CONFIG;}catch{return DEFAULT_CONFIG;}}
export function session():Session|null {try{return JSON.parse(localStorage.getItem('scene-session')||'null');}catch{return null;}}
async function call(path:string,body?:unknown,auth?:string){const c=config();if(!c)throw Error('Supabase 연결 정보를 먼저 저장해 주세요.');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(c.url+path,{method:body===undefined?'GET':'POST',signal:controller.signal,headers:{apikey:c.key,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const j:any=await r.json();if(!r.ok)throw Error(j.msg||j.message||j.error_description||'서버 연결에 실패했습니다.');return j;}finally{clearTimeout(timer);}}
function saveSession(s:any):Session{const v={...s,expires_at:Math.floor(Date.now()/1000)+s.expires_in};localStorage.setItem('scene-session',JSON.stringify(v));return v;}
export async function login(email:string,password:string){return saveSession(await call('/auth/v1/token?grant_type=password',{email,password}));}
async function token(){let s=session();if(!s)throw Error('서버 동기화에 로그인 필요');if(s.expires_at<Date.now()/1000+60)s=saveSession(await call('/auth/v1/token?grant_type=refresh_token',{refresh_token:s.refresh_token}));return s;}
export async function pull(){const s=await token();const rows=await call('/rest/v1/scene_workspaces?select=payload,revision&user_id=eq.'+s.user.id,undefined,s.access_token);const row=rows[0];if(row&&!validate(row.payload))throw Error('서버 원고 형식을 확인할 수 없습니다.');return {row:row as {payload:Workspace;revision:number}|undefined,user:s.user.id};}
export async function push(data:Workspace,expected:number){const s=await token();return await call('/rest/v1/rpc/save_scene_workspace',{p_payload:data,p_expected:expected},s.access_token) as {ok:boolean;revision:number;payload?:Workspace};}

export async function signup(email:string,password:string):Promise<Session|null>{const result=await call('/auth/v1/signup?redirect_to='+encodeURIComponent(window.location.origin),{email:email.trim(),password});return result.access_token?saveSession(result):null;}
