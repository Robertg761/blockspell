import { h } from './dom';

export interface ToastOptions {
  kind?: 'info' | 'success' | 'warn' | 'error';
  title?: string;
  /** Clickable chips, e.g. suggestions. */
  actions?: { label: string; onClick: () => void }[];
  duration?: number;
}

export class Toasts {
  readonly el = h('div.toasts', { 'aria-live': 'polite' });

  show(message: string, o: ToastOptions = {}): void {
    const toast = h('div.toast', {}, [
      o.title ? h('div.toast-title', { text: o.title }) : null,
      h('div.toast-msg', { text: message }),
      o.actions?.length
        ? h(
            'div.toast-actions',
            {},
            o.actions.map((a) =>
              h('button.chip', {
                text: a.label,
                onClick: () => {
                  a.onClick();
                  dismiss();
                },
              }),
            ),
          )
        : null,
    ]);
    toast.classList.add('toast-' + (o.kind ?? 'info'));
    const dismiss = () => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 250);
    };
    this.el.prepend(toast);
    while (this.el.children.length > 4) this.el.lastElementChild?.remove();
    setTimeout(dismiss, o.duration ?? (o.actions?.length ? 6500 : 3200));
  }
}
