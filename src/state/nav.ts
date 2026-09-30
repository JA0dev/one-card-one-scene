// 화면 이동. 주소의 # 뒤에 화면을 적어서 뒤로 가기 버튼이 그대로 동작한다.
//   #/            펼쳐보기(보드)
//   #/read        이어보기
//   #/read/<id>   이어보기에서 그 카드 위치로
//   #/write/<id>  집필
import { useSyncExternalStore } from 'react';

export type View = 'board' | 'read' | 'write';
export type Route = { view: View; sceneId: string };

export function parse(hash: string): Route {
  const [, view = '', id = ''] = hash.replace(/^#/, '').split('/');
  if (view === 'read') return { view: 'read', sceneId: id };
  if (view === 'write' && id) return { view: 'write', sceneId: id };
  return { view: 'board', sceneId: id };
}

const href = (r: Route) => (r.view === 'board' ? '#/' + (r.sceneId ? 'board/' + r.sceneId : '') : `#/${r.view}${r.sceneId ? '/' + r.sceneId : ''}`);

let current = parse(typeof location === 'undefined' ? '' : location.hash);
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => { current = parse(location.hash); listeners.forEach((f) => f()); });
}

export function go(r: Route, opts: { replace?: boolean } = {}) {
  const next = href(r);
  if (location.hash === next) return;
  if (opts.replace) { history.replaceState(null, '', next); current = r; listeners.forEach((f) => f()); }
  else location.hash = next;
}

export const useRoute = () =>
  useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f); }, () => current);
