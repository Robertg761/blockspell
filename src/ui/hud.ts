import type { LevelDef } from '../levels/types';
import { h } from './dom';
import { Toasts } from './toast';

export interface HudCallbacks {
  onCast: (text: string) => void;
  onLevel: (id: string) => void;
  onReset: () => void;
  onMute: (muted: boolean) => void;
  onStart: () => void;
  onSpellbook: () => void;
}

/** All DOM UI: spell input, level card, toasts, overlays. */
export class Hud {
  readonly toasts = new Toasts();
  readonly input: HTMLInputElement;
  private form: HTMLFormElement;
  private levelName = h('div.level-name');
  private levelDesc = h('div.level-desc');
  private goal = h('div.goal');
  private hintBtn: HTMLButtonElement;
  private levelSelect: HTMLSelectElement;
  private chips = h('div.word-chips');
  private overlay = h('div.overlay.hidden');
  private history: string[] = [];
  private historyIdx = -1;
  private hint = '';
  private muted = false;
  readonly bookBtn: HTMLButtonElement;

  constructor(root: HTMLElement, private cb: HudCallbacks, levels: LevelDef[]) {
    this.input = h('input.spell-input', {
      type: 'text',
      placeholder: 'Write a word… (try “big red ball”)',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      maxlength: '60',
      'aria-label': 'Write a word to summon it',
    });
    this.form = h('form.spell-bar', { onSubmit: (ev: Event) => this.submit(ev) }, [
      h('span.spell-icon', { text: '✦', 'aria-hidden': 'true' }),
      this.input,
      h('button.cast-btn', { type: 'submit', text: 'Cast' }),
    ]);
    this.input.addEventListener('keydown', (ev) => this.onKey(ev));

    this.hintBtn = h('button.link-btn', { text: 'Need a hint?', onClick: () => this.toasts.show(this.hint, { title: 'Hint', kind: 'info', duration: 6000 }) });
    this.levelSelect = h(
      'select.level-select',
      { 'aria-label': 'Choose level', onChange: () => cb.onLevel(this.levelSelect.value) },
      levels.map((l) => h('option', { value: l.id, text: `${l.order}. ${l.name}` })),
    );
    const muteBtn = h('button.icon-btn', {
      title: 'Toggle sound',
      text: '♪',
      onClick: () => {
        this.muted = !this.muted;
        muteBtn.classList.toggle('off', this.muted);
        cb.onMute(this.muted);
      },
    });

    this.bookBtn = h('button.icon-btn', { title: 'Spellbook (Tab)', text: '📖', onClick: () => cb.onSpellbook() });

    root.append(
      h('div.hud-top-left', {}, [
        h('div.brand', {}, [h('span.brand-mark', { text: '▣' }), ' Blockspell']),
        h('div.level-card', {}, [this.levelName, this.levelDesc, this.goal, this.hintBtn]),
      ]),
      h('div.hud-top-right', {}, [
        this.levelSelect,
        this.bookBtn,
        h('button.icon-btn', { title: 'Restart level', text: '↺', onClick: () => cb.onReset() }),
        muteBtn,
      ]),
      this.toasts.el,
      h('div.hud-bottom', {}, [this.chips, this.form]),
      h('div.help', { text: 'Drag to orbit · Scroll to zoom · Click ground to aim · Click things to poke' }),
      this.overlay,
    );
    this.showIntro();
  }

  private submit(ev: Event): void {
    ev.preventDefault();
    const text = this.input.value.trim();
    if (!text) return;
    this.history.unshift(text);
    this.history = this.history.slice(0, 30);
    this.historyIdx = -1;
    this.input.value = '';
    this.cb.onCast(text);
  }

  private onKey(ev: KeyboardEvent): void {
    if (ev.key === 'ArrowUp' && this.history.length) {
      this.historyIdx = Math.min(this.history.length - 1, this.historyIdx + 1);
      this.input.value = this.history[this.historyIdx];
      ev.preventDefault();
    } else if (ev.key === 'ArrowDown') {
      this.historyIdx = Math.max(-1, this.historyIdx - 1);
      this.input.value = this.historyIdx >= 0 ? this.history[this.historyIdx] : '';
      ev.preventDefault();
    } else if (ev.key === 'Escape') this.input.blur();
  }

  setWordChips(words: string[]): void {
    this.chips.replaceChildren(
      h('span.chips-label', { text: 'Try:' }),
      ...words.map((w) => h('button.chip', { type: 'button', text: w, onClick: () => this.cb.onCast(w) })),
    );
  }

  setLevel(level: LevelDef): void {
    this.levelSelect.value = level.id;
    this.levelName.textContent = level.name;
    this.levelDesc.textContent = level.description;
    this.hint = level.hint ?? '';
    this.hintBtn.style.display = level.hint && level.goal ? '' : 'none';
    this.goal.replaceChildren();
    if (level.goal) this.goal.append(h('span.goal-box'), h('span', { text: level.goal.text }));
    else if (level.hint) this.goal.append(h('span.goal-free', { text: level.hint }));
    this.goal.classList.remove('done');
  }

  setGoalDone(): void {
    this.goal.classList.add('done');
  }

  shakeInput(): void {
    this.form.classList.remove('shake');
    void this.form.offsetWidth;
    this.form.classList.add('shake');
  }

  pulseInput(): void {
    this.form.classList.remove('pulse');
    void this.form.offsetWidth;
    this.form.classList.add('pulse');
  }

  showWin(levelName: string, next: LevelDef | null, onNext: () => void): void {
    this.overlay.replaceChildren(
      h('div.panel.win', {}, [
        h('div.win-stars', { text: '★ ★ ★' }),
        h('h2', { text: 'Solved!' }),
        h('p', { text: `You finished “${levelName}”.` }),
        h('div.panel-actions', {}, [
          h('button.btn.secondary', { text: 'Keep playing', onClick: () => this.hideOverlay() }),
          next
            ? h('button.btn', {
                text: `Next: ${next.name} →`,
                onClick: () => {
                  this.hideOverlay();
                  onNext();
                },
              })
            : null,
        ]),
      ]),
    );
    this.overlay.classList.remove('hidden');
  }

  /** Hides the win panel if it's showing (leaves the intro alone). */
  hideWin(): void {
    if (this.overlay.querySelector('.win')) this.overlay.classList.add('hidden');
  }

  hideOverlay(): void {
    this.overlay.classList.add('hidden');
    this.input.focus();
  }

  private showIntro(): void {
    const start = () => {
      this.hideOverlay();
      this.cb.onStart();
    };
    this.overlay.replaceChildren(
      h('div.panel.intro', {}, [
        h('div.intro-logo', { text: '▣' }),
        h('h1', { text: 'Blockspell' }),
        h('p.tagline', { text: 'Write a word. Make it real.' }),
        h('p', { text: 'Type the name of a thing — add adjectives like “big”, “blue” or “flaming” — and watch it appear. Use what you summon to solve each puzzle.' }),
        h('button.btn.big', { text: 'Start writing ✦', onClick: start }),
        h('p.small', { text: 'Runs entirely offline. No network, no tracking.' }),
      ]),
    );
    this.overlay.classList.remove('hidden');
  }
}
