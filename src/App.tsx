// 앱 뼈대: 헤더 + 지금 화면 + 공용 대화상자.
import { useEffect, useState } from 'react';
import { Board } from '@/features/board/Board';
import { ChaptersDialog, MoveDialog } from '@/features/board/BoardTools';
import { ReadView } from '@/features/read/ReadView';
import { WriteView } from '@/features/write/WriteView';
import { Header, TabBar } from '@/features/shell/Header';
import { ProjectDialog, QuickJump } from '@/features/shell/Dialogs';
import { Toaster } from '@/features/shell/Toaster';
import { SettingsDialog } from '@/features/settings/Settings';
import { boot, repo, ui, useRepo } from '@/state/app';
import { useRoute } from '@/state/nav';
import { applyTheme } from '@/state/prefs';

export function App() {
  const { ready, error } = useRepo();
  const route = useRoute();
  const [failed, setFailed] = useState('');

  useEffect(() => {
    applyTheme();
    boot().catch((e) => setFailed((e as Error).message));
    const keys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.set({ dialog: { kind: 'jump' } }); }
    };
    window.addEventListener('keydown', keys);
    const leave = (e: BeforeUnloadEvent) => { if (repo.getState().error) e.preventDefault(); };
    window.addEventListener('beforeunload', leave);
    return () => { window.removeEventListener('keydown', keys); window.removeEventListener('beforeunload', leave); };
  }, []);

  if (failed) return <main className="boot"><div className="boot-error"><strong>원고를 열지 못했어요.</strong><p>{failed}</p><p className="muted">브라우저의 사이트 데이터 저장이 막혀 있는지 확인해 주세요.</p></div></main>;
  if (!ready) return <main className="boot">원고를 여는 중…</main>;

  return (
    <div className="app" data-view={route.view}>
      <Header />
      {error && <div className="save-error" role="alert">{error}</div>}
      <main className="app-main">
        {route.view === 'board' && <Board />}
        {route.view === 'read' && <ReadView />}
        {route.view === 'write' && <WriteView sceneId={route.sceneId} />}
      </main>
      <TabBar />
      <SettingsDialog />
      <ProjectDialog />
      <QuickJump />
      <MoveDialog />
      <ChaptersDialog />
      <Toaster />
    </div>
  );
}
