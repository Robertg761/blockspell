import { h } from './dom';

const KEY = 'blockspell.hotbar.v1';
export const HOTBAR_SIZE = 9;

/**
 * Pinned spells: a row of up to nine favorites above the spell bar. Click one, or press its
 * number (Alt + number in Free Play, where plain digits go to the spell bar), to cast it.
 * Right-click or the little × unpins. Saved in localStorage.
 */
export class Hotbar {
  readonly el = h('div.hotbar.hidden', { role: 'toolbar', 'aria-label': 'Pinned spells' });
  private slots: string[] = [];

  constructor(private onCast: (text: string) => void) {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (Array.isArray(raw)) this.slots = raw.filter((s): s is string => typeof s === 'string' && !!s.trim()).slice(0, HOTBAR_SIZE);
    } catch {
      /* private mode: start empty */
    }
    this.render();
  }

  get all(): readonly string[] {
    return this.slots;
  }

  has(text: string): boolean {
    return this.slots.includes(text.trim().toLowerCase());
  }

  /** Pins a spell. Returns false if it is already pinned or the bar is full. */
  pin(text: string): boolean {
    const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!t || this.has(t) || this.slots.length >= HOTBAR_SIZE) return false;
    this.slots.push(t);
    this.save();
    return true;
  }

  unpin(i: number): void {
    if (i < 0 || i >= this.slots.length) return;
    this.slots.splice(i, 1);
    this.save();
  }

  /** Casts the spell in slot `i` (0-based). Returns false when the slot is empty. */
  cast(i: number): boolean {
    const t = this.slots[i];
    if (!t) return false;
    this.onCast(t);
    this.flash(i);
    return true;
  }

  get full(): boolean {
    return this.slots.length >= HOTBAR_SIZE;
  }

  private flash(i: number): void {
    const b = this.el.children[i] as HTMLElement | undefined;
    if (!b) return;
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.slots));
    } catch {
      /* ignore */
    }
    this.render();
  }

  private render(): void {
    this.el.classList.toggle('hidden', this.slots.length === 0);
    this.el.replaceChildren(
      ...this.slots.map((t, i) => {
        const b = h('button.hot', { type: 'button', title: `${t} (${i + 1}). Right-click to unpin.`, onClick: () => this.cast(i) }, [
          h('kbd', { text: String(i + 1) }),
          h('span.hot-text', { text: t }),
          h('span.hot-x', {
            text: '×',
            title: 'Unpin',
            'aria-label': `Unpin ${t}`,
            onClick: (ev: Event) => {
              ev.stopPropagation();
              this.unpin(i);
            },
          }),
        ]);
        b.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          this.unpin(i);
        });
        return b;
      }),
    );
  }
}
