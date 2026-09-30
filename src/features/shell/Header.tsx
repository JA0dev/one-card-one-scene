// 모든 화면이 같은 헤더를 쓴다.
// 오른쪽 순서는 [동기화][렌즈][찾기][설정][+]로 고정. 화면마다 달라지는 것은 왼쪽 끝에 둬서
// 나머지 아이콘이 움직이지 않는다.
import { BookOpen, LayoutGrid, Plus, Search, Settings } from 'lucide-react';
import { LensButton } from '@/features/lens/Lens';
import { addCard, addCardAfterAndWrite } from '@/state/actions';
import { ui } from '@/state/app';
import { go, useRoute, type View } from '@/state/nav';
import { IconButton, cx } from '@/ui/kit';
import { ProjectMenu } from './ProjectMenu';
import { SyncBadge } from './SyncBadge';

export const TABS: { view: Exclude<View, 'write'>; label: string; icon: typeof LayoutGrid }[] = [
  { view: 'board', label: '펼쳐보기', icon: LayoutGrid },
  { view: 'read', label: '이어보기', icon: BookOpen },
];

export function ViewTabs({ className }: { className?: string }) {
  const route = useRoute();
  const current = route.view === 'write' ? 'board' : route.view;
  return (
    <nav className={cx('seg', className)} aria-label="화면">
      {TABS.map(({ view, label, icon: Icon }) => (
        <button key={view} type="button" className={cx('seg-item', current === view && 'is-on')} aria-current={current === view ? 'page' : undefined}
          onClick={() => go({ view, sceneId: route.view === 'write' ? route.sceneId : '' })}>
          <Icon size={16} /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function newCardFromHere(view: View, sceneId: string) {
  if (view === 'write' && sceneId) addCardAfterAndWrite(sceneId);
  else { if (view !== 'board') go({ view: 'board', sceneId: '' }); addCard(); }
}

export function Header() {
  const route = useRoute();
  return (
    <header className="app-header">
      <div className="header-left"><ProjectMenu /></div>
      <ViewTabs className="header-tabs" />
      <div className="header-right">
        <SyncBadge />
        {route.view !== 'write' && <LensButton />}
        <IconButton label="찾기 (⌘K)" onClick={() => ui.set({ dialog: { kind: 'jump' } })}><Search size={19} /></IconButton>
        <IconButton label="설정" onClick={() => ui.set({ dialog: { kind: 'settings', page: 'home' } })}><Settings size={19} /></IconButton>
        <IconButton label={route.view === 'write' ? '다음에 새 카드' : '새 카드'} tone="soft" className="header-new" onClick={() => newCardFromHere(route.view, route.sceneId)}><Plus size={19} /></IconButton>
      </div>
    </header>
  );
}

/** 모바일 아래 탭: 펼쳐보기 · 새 카드 · 이어보기 */
export function TabBar() {
  const route = useRoute();
  if (route.view === 'write') return null;
  return (
    <nav className="tab-bar" aria-label="화면">
      {TABS.slice(0, 1).map(({ view, label, icon: Icon }) => (
        <button key={view} type="button" className={cx('tab', route.view === view && 'is-on')} aria-current={route.view === view ? 'page' : undefined} onClick={() => go({ view, sceneId: '' })}>
          <Icon size={20} /><span>{label}</span>
        </button>
      ))}
      <button type="button" className="tab tab-new" aria-label="새 카드" onClick={() => newCardFromHere(route.view, route.sceneId)}><span className="tab-new-circle"><Plus size={20} /></span></button>
      {TABS.slice(1).map(({ view, label, icon: Icon }) => (
        <button key={view} type="button" className={cx('tab', route.view === view && 'is-on')} aria-current={route.view === view ? 'page' : undefined} onClick={() => go({ view, sceneId: '' })}>
          <Icon size={20} /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
