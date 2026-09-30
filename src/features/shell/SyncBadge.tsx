// 저장·동기화 상태. 헤더 오른쪽 맨 앞 한 자리에만 있다.
import { AlertCircle, Cloud, CloudOff, HardDrive, RefreshCw } from 'lucide-react';
import { ui, useSyncStatus, useUser } from '@/state/app';
import { cx } from '@/ui/kit';

export function SyncBadge() {
  const s = useSyncStatus();
  const user = useUser();
  const view =
    s.kind === 'syncing' ? { icon: <RefreshCw size={15} className="spin" />, text: '동기화 중', tone: '' }
    : s.kind === 'synced' ? { icon: <Cloud size={15} />, text: '동기화됨', tone: '' }
    : s.kind === 'offline' ? { icon: <CloudOff size={15} />, text: '오프라인 · 기기에 저장됨', tone: 'is-warn' }
    : s.kind === 'error' ? { icon: <AlertCircle size={15} />, text: '동기화 문제', tone: 'is-error' }
    : s.kind === 'mismatch' ? { icon: <AlertCircle size={15} />, text: '계정 확인 필요', tone: 'is-error' }
    : { icon: <HardDrive size={15} />, text: user ? '연결 중' : '기기에 저장됨', tone: '' };
  const detail = s.kind === 'error' ? s.message : view.text;
  return (
    <button type="button" className={cx('sync-badge', view.tone)} title={detail} aria-label={`저장 상태: ${detail}. 계정과 동기화 설정 열기`}
      onClick={() => ui.set({ dialog: { kind: 'settings', page: 'account' } })}>
      {view.icon}<span className="sync-text">{view.text}</span>
    </button>
  );
}
