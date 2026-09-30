// 설정: 보기 · 내보내기·백업 · 계정·동기화
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Download, FileText, FileType, Monitor, Moon, RotateCcw, Sun, Upload } from 'lucide-react';
import { Slider } from 'radix-ui';
import { auth } from '@/data/supabase';
import type { Recovery } from '@/data/local';
import { when } from '@/domain/text';
import { copyProject, exportProject, importFile, type Format } from '@/io/transfer';
import { openProject } from '@/state/actions';
import { local, notify, repo, sync, ui, useProject, useRepo, useSyncStatus, useUser } from '@/state/app';
import { prefs } from '@/state/prefs';
import { Button, Confirm, Modal, cx } from '@/ui/kit';

type Page = 'home' | 'view' | 'backup' | 'account';
const TITLES: Record<Page, string> = { home: '설정', view: '보기', backup: '내보내기 · 백업', account: '계정 · 동기화' };

export function SettingsDialog() {
  const d = ui.use((s) => s.dialog);
  const page = d?.kind === 'settings' ? d.page : null;
  const setPage = (p: Page) => ui.set({ dialog: { kind: 'settings', page: p } });
  return (
    <Modal open={!!page} onOpenChange={(o) => !o && ui.set({ dialog: null })} title={page ? TITLES[page] : ''}
      back={page && page !== 'home' ? { label: '설정', onClick: () => setPage('home') } : undefined}>
      {page === 'home' && <Home go={setPage} />}
      {page === 'view' && <ViewPage />}
      {page === 'backup' && <BackupPage />}
      {page === 'account' && <AccountPage />}
    </Modal>
  );
}

function Home({ go }: { go: (p: Page) => void }) {
  const user = useUser();
  return (
    <div className="nav-list">
      {(['view', 'backup', 'account'] as const).map((p) => (
        <button key={p} type="button" className="nav-row" onClick={() => go(p)}>
          <span>{TITLES[p]}</span>
          {p === 'account' && <span className="nav-hint">{user?.email ?? '로그인 전'}</span>}
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  );
}

function ViewPage() {
  const p = prefs.use((x) => x);
  return (
    <div className="form">
      <Field label="화면">
        <div className="seg" role="radiogroup" aria-label="화면 모드">
          {([['system', '기기 설정', Monitor], ['light', '밝게', Sun], ['dark', '어둡게', Moon]] as const).map(([v, label, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={p.theme === v} className={cx('seg-item', p.theme === v && 'is-on')} onClick={() => prefs.set({ theme: v })}><Icon size={15} />{label}</button>
          ))}
        </div>
      </Field>
      <Field label="카드">
        <div className="seg" role="radiogroup" aria-label="카드 밀도">
          {([['card', '카드'], ['title', '제목만']] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={p.density === v} className={cx('seg-item', p.density === v && 'is-on')} onClick={() => prefs.set({ density: v })}>{label}</button>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={p.showMeta} onChange={(e) => prefs.set({ showMeta: e.target.checked })} />카드에 인물 · 장소 · 글자 수 보이기</label>
      </Field>
      <Field label="본문 글꼴">
        <div className="seg" role="radiogroup" aria-label="본문 글꼴">
          {([[true, '명조'], [false, '고딕']] as const).map(([v, label]) => (
            <button key={label} type="button" role="radio" aria-checked={p.serif === v} className={cx('seg-item', p.serif === v && 'is-on', v ? 'serif' : '')} onClick={() => prefs.set({ serif: v })}>{label}</button>
          ))}
        </div>
      </Field>
      <Field label={<>글자 크기 <output>{p.font}px</output></>}>
        <Range value={p.font} min={15} max={26} step={1} onChange={(font) => prefs.set({ font })} label="글자 크기" />
      </Field>
      <Field label={<>줄 간격 <output>{p.line.toFixed(1)}</output></>}>
        <Range value={p.line} min={1.4} max={2.6} step={0.1} onChange={(line) => prefs.set({ line: Math.round(line * 10) / 10 })} label="줄 간격" />
      </Field>
      <p className={cx('preview', p.serif && 'serif')} style={{ fontSize: p.font, lineHeight: p.line }}>주인은 찻잔을 내려놓으며 창밖을 보았다. 등대 얘기를 꺼내자 그녀의 손끝이 잠시 멈췄다.</p>
    </div>
  );
}

function BackupPage() {
  const project = useProject();
  const { projects } = useRepo();
  const input = useRef<HTMLInputElement>(null);
  const [recoveries, setRecoveries] = useState<Recovery[] | null>(null);
  const run = (f: Format) => project && exportProject(f, project, projects).catch((e) => notify((e as Error).message));
  const load = async (file: File) => {
    try {
      const list = importFile(file.name, await file.text());
      list.forEach((p) => repo.create(p));
      openProject(list[0].id);
      notify(list.length > 1 ? `작품 ${list.length}개를 가져왔어요.` : '새 작품으로 가져왔어요.');
    } catch (e) { notify((e as Error).message); }
  };
  if (!project) return null;
  return (
    <div className="form">
      <Field label={`원고 내보내기 · ${project.title}`} hint="휴지통 카드는 빼고, 장과 씬 순서대로 내보내요.">
        <div className="tile-row">
          <Tile icon={<FileType size={18} />} title="Word" sub=".docx" onClick={() => run('docx')} />
          <Tile icon={<FileText size={18} />} title="Markdown" sub=".md · 노션" onClick={() => run('md')} />
          <Tile icon={<FileText size={18} />} title="텍스트" sub=".txt" onClick={() => run('txt')} />
        </div>
      </Field>
      <Field label="백업" hint="모든 작품을 휴지통까지 포함해 한 파일로 저장해요. 가져오면 새 작품으로 추가되고 기존 작품은 그대로예요.">
        <div className="tile-row">
          <Tile icon={<Download size={18} />} title="백업 저장" sub=".json" onClick={() => run('json')} />
          <Tile icon={<Upload size={18} />} title="가져오기" sub=".json · .md · .txt" onClick={() => input.current?.click()} />
        </div>
        <input ref={input} type="file" accept=".json,.md,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ''; }} />
      </Field>
      <Field label="기기 복구 사본" hint="작품 삭제, 휴지통 비우기, 동기화 충돌 전에 이 기기에 자동으로 남겨 둔 사본이에요.">
        {recoveries === null ? <Button onClick={() => void local.recoveries().then(setRecoveries)}>복구 사본 보기</Button>
          : recoveries.length === 0 ? <p className="muted">남아 있는 사본이 없어요.</p>
          : <ul className="recovery-list">{recoveries.map((r) => (
            <li key={r.key}>
              <div><strong>{r.project.title}</strong><span className="muted">{r.reason} · {when(r.at)}</span></div>
              <Button variant="quiet" onClick={() => { const p = copyProject(r.project, ' · 복구'); repo.create(p); openProject(p.id); notify('복구 사본을 새 작품으로 열었어요.'); }}>
                <RotateCcw size={14} />새 작품으로 열기
              </Button>
            </li>))}</ul>}
      </Field>
    </div>
  );
}

function AccountPage() {
  const user = useUser();
  const status = useSyncStatus();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [adopt, setAdopt] = useState(false);
  useEffect(() => setMessage(''), [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      if (mode === 'in') await auth.signIn(email, password);
      else if (!(await auth.signUp(email, password))) setMessage('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.');
    } catch (err) { setMessage((err as Error).message); }
    finally { setBusy(false); }
  };

  if (user) {
    const text = status.kind === 'synced' ? `동기화됨 · ${when(new Date(status.at).toISOString())}` : status.kind === 'syncing' ? '동기화 중…' : status.kind === 'offline' ? '오프라인이에요. 연결되면 이어서 보내요.' : status.kind === 'error' ? status.message : status.kind === 'mismatch' ? '이 기기에는 다른 계정의 원고가 있어요.' : '연결 중…';
    return (
      <div className="form">
        <Field label="로그인한 계정"><p className="account-email">{user.email}</p></Field>
        <Field label="동기화" hint="쓰는 즉시 이 기기에 저장되고, 연결되어 있으면 몇 초 안에 다른 기기와 맞춰져요. 같은 작품을 두 기기에서 동시에 고치면 양쪽 다 남겨요.">
          <p className={cx('sync-line', (status.kind === 'error' || status.kind === 'mismatch') && 'is-error')}>{text}</p>
          <div className="button-row">
            <Button onClick={() => void sync.run()} disabled={status.kind === 'syncing'}>지금 동기화</Button>
            {status.kind === 'mismatch' && <Button variant="danger" onClick={() => setAdopt(true)}>이 계정 원고로 바꾸기</Button>}
          </div>
        </Field>
        <div className="button-row"><Button variant="quiet" onClick={() => void auth.signOut()}>로그아웃</Button></div>
        <Confirm open={adopt} onOpenChange={setAdopt} title="이 계정 원고로 바꿀까요?"
          description="이 기기에 있는 다른 계정의 원고는 복구 사본으로 남기고, 지금 계정의 원고를 받아와요."
          confirm="바꾸기" onConfirm={() => status.kind === 'mismatch' && void sync.adoptAccount(status.user)} />
      </div>
    );
  }
  return (
    <form className="form" onSubmit={submit}>
      <p className="muted">로그인하면 PC와 휴대폰이 같은 원고를 봐요. 로그인하지 않아도 이 기기에는 그대로 저장돼요.</p>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'in'} className={cx('seg-item', mode === 'in' && 'is-on')} onClick={() => setMode('in')}>로그인</button>
        <button type="button" role="tab" aria-selected={mode === 'up'} className={cx('seg-item', mode === 'up' && 'is-on')} onClick={() => setMode('up')}>회원가입</button>
      </div>
      <label className="field-input">이메일<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field-input">비밀번호<input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {message && <p className="form-message" role="alert">{message}</p>}
      <div className="button-row">
        <Button variant="primary" type="submit" disabled={busy}>{busy ? '잠시만요…' : mode === 'in' ? '로그인' : '가입하기'}</Button>
        {mode === 'in' && <Button variant="quiet" disabled={!email || busy} onClick={() => void auth.resetPassword(email).then(() => setMessage('비밀번호 재설정 메일을 보냈어요.'), (e) => setMessage((e as Error).message))}>비밀번호를 잊었어요</Button>}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return <div className="field"><div className="field-label">{label}</div>{children}{hint && <p className="field-hint">{hint}</p>}</div>;
}

function Tile({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return <button type="button" className="tile" onClick={onClick}>{icon}<strong>{title}</strong><span>{sub}</span></button>;
}

function Range({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }) {
  return (
    <Slider.Root className="range" value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])}>
      <Slider.Track className="range-track"><Slider.Range className="range-fill" /></Slider.Track>
      <Slider.Thumb className="range-thumb" aria-label={label} />
    </Slider.Root>
  );
}
