import { X } from 'lucide-react';
import { dismiss, toasts } from '@/state/app';

export function Toaster() {
  const list = toasts.use((s) => s.list);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast-text">{t.message}</span>
          {t.action && <button type="button" className="toast-action" onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
          <button type="button" className="toast-close" aria-label="알림 닫기" onClick={() => dismiss(t.id)}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
