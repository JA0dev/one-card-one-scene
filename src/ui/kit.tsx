// 공용 부품. 접근성(키보드·스크린리더)은 Radix가 맡고, 모양은 styles/ui.css가 맡는다.
import { forwardRef, useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { AlertDialog, Dialog, DropdownMenu, Popover } from 'radix-ui';
import { Check, ChevronRight, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ── 버튼 ──
type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; tone?: 'plain' | 'soft' };
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, active, tone = 'plain', className, children, ...rest }, ref) {
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={cx('icon-btn', tone === 'soft' && 'is-soft', active && 'is-active', className)} {...rest}>
      {children}
    </button>
  );
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' | 'danger' };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'ghost', className, ...rest }, ref) {
  return <button ref={ref} type="button" className={cx('btn', `btn-${variant}`, className)} {...rest} />;
});

// ── 대화상자 ──
export function Modal({ open, onOpenChange, title, description, children, size = 'md', back, className }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode;
  size?: 'sm' | 'md' | 'lg'; back?: { label: string; onClick: () => void }; className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className={cx('modal', `modal-${size}`, className)}>
          <header className="modal-head">
            {back && <button type="button" className="modal-back" onClick={back.onClick}><ChevronRight size={16} className="flip" />{back.label}</button>}
            <Dialog.Title className="modal-title">{title}</Dialog.Title>
            <Dialog.Close asChild><IconButton label="닫기" className="modal-close"><X size={18} /></IconButton></Dialog.Close>
          </header>
          {description ? <Dialog.Description className="modal-desc">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</Dialog.Description>}
          <div className="modal-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Confirm({ open, onOpenChange, title, description, confirm, onConfirm, danger = true }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description: ReactNode; confirm: string; onConfirm: () => void; danger?: boolean;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="overlay" />
        <AlertDialog.Content className="modal modal-sm">
          <AlertDialog.Title className="modal-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="modal-desc">{description}</AlertDialog.Description>
          <div className="modal-actions">
            <AlertDialog.Cancel asChild><Button>취소</Button></AlertDialog.Cancel>
            <AlertDialog.Action asChild><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirm}</Button></AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

// ── 메뉴 ──
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export function MenuContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={cx('menu', className)} align={align} sideOffset={6} collisionPadding={12}>{children}</DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}
export function MenuItem({ children, onSelect, danger, disabled, icon, hint }: { children: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; icon?: ReactNode; hint?: ReactNode }) {
  return (
    <DropdownMenu.Item className={cx('menu-item', danger && 'is-danger')} onSelect={onSelect} disabled={disabled}>
      {icon && <span className="menu-icon">{icon}</span>}<span className="menu-text">{children}</span>{hint && <span className="menu-hint">{hint}</span>}
    </DropdownMenu.Item>
  );
}
export function MenuCheck({ children, checked, onChange, keepOpen = true }: { children: ReactNode; checked: boolean; onChange: (v: boolean) => void; keepOpen?: boolean }) {
  return (
    <DropdownMenu.CheckboxItem className="menu-item" checked={checked} onCheckedChange={onChange} onSelect={(e) => keepOpen && e.preventDefault()}>
      <span className="menu-icon">{checked && <Check size={15} />}</span><span className="menu-text">{children}</span>
    </DropdownMenu.CheckboxItem>
  );
}
export const MenuSeparator = () => <DropdownMenu.Separator className="menu-sep" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <DropdownMenu.Label className="menu-label">{children}</DropdownMenu.Label>;
export function SubMenu({ label, icon, children }: { label: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="menu-item">{icon && <span className="menu-icon">{icon}</span>}<span className="menu-text">{label}</span><ChevronRight size={14} className="menu-hint" /></DropdownMenu.SubTrigger>
      <DropdownMenu.Portal><DropdownMenu.SubContent className="menu" sideOffset={4} collisionPadding={12}>{children}</DropdownMenu.SubContent></DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

// ── 팝오버 ──
export function Pop({ trigger, children, align = 'end', className, open, onOpenChange }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={cx('popover', className)} align={align} sideOffset={8} collisionPadding={12}>{children}</Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── 내용에 맞춰 늘어나는 입력칸 ──
export const AutoText = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AutoText(props, outer) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const fit = () => { el.style.height = '0px'; el.style.height = el.scrollHeight + 'px'; };
    fit();
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== width) { width = el.clientWidth; fit(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, [props.value, props.style?.fontSize, props.style?.lineHeight, props.className]);
  return (
    <textarea
      rows={1}
      {...props}
      ref={(el) => { inner.current = el; if (typeof outer === 'function') outer(el); else if (outer) outer.current = el; }}
    />
  );
});

/** 스크린리더에만 읽히는 글 */
export const SrOnly = ({ children }: { children: ReactNode }) => <span className="sr-only">{children}</span>;
