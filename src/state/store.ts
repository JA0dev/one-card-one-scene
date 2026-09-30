// 아주 작은 상태 저장소. 값이 바뀌면 그 값을 쓰는 컴포넌트만 다시 그린다.
import { useSyncExternalStore } from 'react';

export type Store<T> = {
  get: () => T;
  set: (patch: Partial<T> | ((s: T) => Partial<T>)) => void;
  subscribe: (fn: () => void) => () => void;
  /** 선택 함수는 원시값이나 원래 객체를 돌려줘야 한다(새 객체를 만들면 매번 다시 그린다). */
  use: <S>(select: (s: T) => S) => S;
};

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const get = () => state;
  const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
  return {
    get,
    subscribe,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((f) => f());
    },
    use: (select) => useSyncExternalStore(subscribe, () => select(state)),
  };
}
