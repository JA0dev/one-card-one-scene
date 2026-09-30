// 기기마다 따로 두는 보기 설정. 서버로 보내지 않는다.
import { createStore } from './store';

export type Prefs = {
  theme: 'system' | 'light' | 'dark';
  font: number;
  line: number;
  serif: boolean;
  /** 카드에 인물·장소·글자 수 */
  showMeta: boolean;
  density: 'card' | 'title';
  /** 렌즈에 맞지 않는 카드: 흐리게 또는 숨기기 */
  lensMode: 'dim' | 'hide';
  projectId: string;
};

const KEY = 'scene-card-prefs';
const DEFAULTS: Prefs = { theme: 'system', font: 18, line: 1.9, serif: true, showMeta: true, density: 'card', lensMode: 'dim', projectId: '' };

function read(): Prefs {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; }
}

export const prefs = createStore<Prefs>(typeof localStorage === 'undefined' ? DEFAULTS : read());
prefs.subscribe(() => { try { localStorage.setItem(KEY, JSON.stringify(prefs.get())); } catch { /* 사생활 보호 모드 등 */ } });

export function applyTheme() {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const t = prefs.get().theme;
    document.documentElement.dataset.theme = t === 'system' ? (media.matches ? 'dark' : 'light') : t;
  };
  apply();
  media.addEventListener('change', apply);
  prefs.subscribe(apply);
}
