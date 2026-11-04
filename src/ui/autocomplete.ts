import { complete, type Completion } from '../parser/complete';
import { h } from './dom';

/**
 * Autocomplete for the spell bar: grey "ghost" letters finish the word as you type (Tab or → accepts),
 * and a short list above the bar shows other matches (↑ ↓ to pick, click, Esc to hide). Words the player
 * hasn't discovered yet carry a ✦, so typing doubles as a way to find new words.
 */
export class Autocomplete {
  readonly list = h('div.suggest.hidden', { role: 'listbox', 'aria-label': 'Word suggestions' });
  readonly ghost = h('div.spell-ghost', { 'aria-hidden': 'true' });
  /** Whether the player has discovered an object (set by the game from the spellbook). */
  known: (nounId: string) => boolean = () => true;
  private items: Completion[] = [];
  private active = 0;
  private hiddenFor = '';

  constructor(private input: HTMLInputElement, private onAccept: () => void = () => {}) {
    input.addEventListener('input', () => this.refresh());
    input.addEventListener('blur', () => this.hide());
    input.addEventListener('focus', () => this.refresh());
  }

  get visible(): boolean {
    return this.items.length > 0 && !this.list.classList.contains('hidden');
  }

  /** The suggestion Tab would accept, or null. */
  get current(): Completion | null {
    return this.visible ? this.items[this.active] ?? null : null;
  }

  refresh(): void {
    const value = this.input.value;
    if (document.activeElement !== this.input || value === this.hiddenFor) return this.hide();
    this.hiddenFor = '';
    this.items = complete(value, this.known);
    this.active = 0;
    this.render();
  }

  hide(keepEscaped = false): void {
    if (keepEscaped) this.hiddenFor = this.input.value;
    this.items = [];
    this.list.classList.add('hidden');
    this.ghost.replaceChildren();
  }

  /** Handles a key in the spell bar. Returns true when it was used (the caller stops the event). */
  onKey(ev: KeyboardEvent): boolean {
    if (!this.visible) return false;
    if (ev.key === 'Tab' || (ev.key === 'ArrowRight' && this.input.selectionStart === this.input.value.length && this.ghostText())) {
      this.accept(this.active);
      return true;
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      this.active = (this.active + (ev.key === 'ArrowDown' ? 1 : -1) + this.items.length) % this.items.length;
      this.render();
      return true;
    }
    if (ev.key === 'Escape') {
      this.hide(true);
      return true;
    }
    return false;
  }

  accept(i: number): void {
    const c = this.items[i];
    if (!c) return;
    this.input.value = c.text;
    this.input.setSelectionRange(c.text.length, c.text.length);
    this.onAccept();
    this.refresh();
  }

  /** The grey letters after the cursor for the active suggestion ('' when it isn't a plain continuation). */
  private ghostText(): string {
    const c = this.items[this.active];
    const v = this.input.value;
    return c && c.text.length > v.length && c.text.toLowerCase().startsWith(v.toLowerCase()) ? c.text.slice(v.length) : '';
  }

  private render(): void {
    if (!this.items.length) return this.hide();
    const g = this.ghostText();
    this.ghost.replaceChildren(h('span.spell-ghost-typed', { text: this.input.value }), h('span.spell-ghost-rest', { text: g }));
    this.list.classList.remove('hidden');
    this.list.replaceChildren(
      ...this.items.map((c, i) => {
        const fresh = c.kind === 'noun' && !this.known(c.id);
        return h(`button.suggest-item${i === this.active ? '.active' : ''}`, {
          type: 'button',
          role: 'option',
          tabindex: '-1',
          'aria-selected': String(i === this.active),
          // pointerdown, not click: the input must keep focus
          onPointerDown: (ev: Event) => {
            ev.preventDefault();
            this.accept(i);
          },
        }, [
          h('span.suggest-word', {}, [h('b', { text: c.word.slice(0, c.typed) }), c.word.slice(c.typed)]),
          c.kind === 'adjective' ? h('span.suggest-tag', { text: 'adjective' }) : null,
          fresh ? h('span.suggest-new', { text: '✦ new', title: "You haven't written this word yet" }) : null,
        ]);
      }),
    );
  }
}
