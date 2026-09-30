export const count=(s:string)=>[...s].length;
export const time=(s:string)=>new Date(s).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
