import type { LevelRecord } from '../levels/progress';
import { spellsText, starsForPar, type LevelDef } from '../levels/types';
import { Audio, loadMuted } from '../engine/audio';
import { h } from './dom';
import { Toasts } from './toast';

export interface HudCallbacks {
  onCast: (text: string) => void;
  onLevel: (id: string) => void;
  onReset: () => void;
  onMute: (muted: boolean) => void;
  onStart: () => void;
  onSpellbook: () => void;
  onLevels: () => void;
}

export interface WinInfo {
  level: LevelDef;
  stars: number;
  words: number;
  par: number;
  newBest: boolean;
  next: LevelDef | null;
}

const starText = (n: number, of = 3) => '★'.repeat(n) + '☆'.repeat(Math.max(0, of - n));

/** All DOM UI: spell input, level card, toasts, overlays. */
export class Hud {
  readonly toasts = new Toasts();
  readonly input: HTMLInputElement;
  private form: HTMLFormElement;
  private levelName = h('div.level-name');
  private levelDesc = h('div.level-desc');
  private goal = h('div.goal');
  private hintBtn: HTMLButtonElement;
  private wordsLine = h('div.words-line');
  private chips = h('div.word-chips');
  private help = h('div.help');
  private overlay = h('div.overlay.hidden');
  private history: string[] = [];
  private historyIdx = -1;
  private hint = '';
  private muted = loadMuted();
  readonly bookBtn: HTMLButtonElement;
  /** Focus the spell bar after closing overlays (off in hero levels, where keys move the hero). */
  autoFocus = true;

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
    void levels;
    const muteBtn = h('button.icon-btn', {
      title: 'Toggle sound',
      text: '♪',
      onClick: () => {
        this.muted = !this.muted;
        muteBtn.classList.toggle('off', this.muted);
        cb.onMute(this.muted);
      },
    });

    muteBtn.classList.toggle('off', this.muted);
    this.bookBtn = h('button.icon-btn', { title: 'Spellbook (Tab)', text: '📖', onClick: () => cb.onSpellbook() });

    root.append(
      h('div.hud-top-left', {}, [
        h('div.brand', {}, [h('span.brand-mark', { text: '▣' }), ' Blockspell']),
        h('div.level-card', {}, [this.levelName, this.levelDesc, this.goal, this.wordsLine, this.hintBtn]),
      ]),
      h('div.hud-top-right', {}, [
        h('button.icon-btn.levels-btn', { title: 'Level select', text: '☰ Levels', onClick: () => cb.onLevels() }),
        this.bookBtn,
        h('button.icon-btn.reset-btn', { title: 'Restart level (R)', text: '↺', onClick: () => cb.onReset() }),
        muteBtn,
      ]),
      this.toasts.el,
      h('div.hud-bottom', {}, [this.chips, this.form]),
      this.help,
      this.overlay,
    );
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

  /** Puts text in the spell bar, ready to edit or cast. */
  prefill(text: string): void {
    this.input.value = text;
    this.input.focus();
  }

  setWordChips(words: string[]): void {
    this.chips.replaceChildren(
      h('span.chips-label', { text: 'Try:' }),
      ...words.map((w) => h('button.chip', { type: 'button', text: w, onClick: () => this.cb.onCast(w) })),
    );
  }

  setLevel(level: LevelDef): void {
    this.levelName.textContent = level.order > 0 && !level.hidden ? `${level.order}. ${level.name}` : level.name;
    this.levelDesc.textContent = level.description;
    this.hint = level.hint ?? '';
    this.hintBtn.style.display = level.hint && level.goal ? '' : 'none';
    this.goal.replaceChildren();
    if (level.goal) this.goal.append(h('span.goal-box'), h('span', { text: level.goal.text }));
    else if (level.hint) this.goal.append(h('span.goal-free', { text: level.hint }));
    this.goal.classList.remove('done');
    this.help.textContent = level.hero
      ? 'WASD / arrows: move · Space: jump · W near a ladder: climb · Enter: write a word · Click ground: aim · R: restart'
      : 'Drag to orbit · Scroll to zoom · Click ground to aim · Click things to poke';
    this.setWords(0, level.goal ? (level.par ?? 2) : null);
  }

  /** Spells-cast counter under the goal (one per successful cast). `par` null hides it (free play). */
  setWords(words: number, par: number | null): void {
    if (par === null) {
      this.wordsLine.replaceChildren();
      return;
    }
    const stars = starsForPar(par, words);
    this.wordsLine.replaceChildren(
      h('span', { text: `Spells cast: ${words}` }),
      h('span.words-stars', { text: starText(stars), title: `3 stars for ${spellsText(par)} or fewer` }),
    );
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

  showWin(info: WinInfo, onNext: () => void, onRetry: () => void): void {
    const starsEl = h('div.win-stars', {}, [0, 1, 2].map((i) => h(`span.win-star${i < info.stars ? '.on' : ''}`, { text: '★', style: `animation-delay:${0.25 + i * 0.22}s` })));
    this.overlay.replaceChildren(
      h('div.panel.win', {}, [
        starsEl,
        h('h2', { text: 'Solved!' }),
        h('p', { text: `“${info.level.name}” with ${spellsText(info.words)}${info.newBest ? '. New best!' : '.'}` }),
        info.stars < 3 ? h('p.small', { text: `Can you do it in ${spellsText(info.par)} or fewer for ★★★?` }) : null,
        h('div.panel-actions', {}, [
          h('button.btn.secondary', { text: '↺ Retry', onClick: () => { this.hideOverlay(); onRetry(); } }),
          h('button.btn.secondary', { text: '☰ Levels', onClick: () => this.cb.onLevels() }),
          next(info.next, onNext, this),
        ]),
      ]),
    );
    this.overlay.classList.remove('hidden');
    for (let i = 0; i < info.stars; i++)
      setTimeout(() => Audio.instance?.play('star', { pitch: 2 ** ((i * 4) / 12) }), (0.25 + i * 0.22) * 1000 + 120);
    function next(n: LevelDef | null, go: () => void, hud: Hud) {
      return n
        ? h('button.btn', { text: `Next: ${n.name} →`, onClick: () => { hud.hideOverlay(); go(); } })
        : h('button.btn', { text: 'Keep playing', onClick: () => hud.hideOverlay() });
    }
  }

  /** Level select screen: a card per level with saved stars. */
  showLevels(levels: LevelDef[], records: Record<string, LevelRecord>, current: string | null): void {
    const card = (l: LevelDef) => {
      const rec = records[l.id];
      const free = !l.goal;
      return h(`button.level-tile${rec ? '.solved' : ''}${l.id === current ? '.current' : ''}${free ? '.free' : ''}`, {
        onClick: () => { this.hideOverlay(); this.cb.onLevel(l.id); },
      }, [
        h('div.tile-num', { text: free ? '✦' : String(l.order) }),
        h('div.tile-name', { text: l.name }),
        h('div.tile-goal', { text: l.goal?.text ?? 'Sandbox: write anything' }),
        free ? h('div.tile-stars.muted', { text: 'no goal' }) : h('div.tile-stars', { text: starText(rec?.stars ?? 0), title: rec ? `Best: ${spellsText(rec.words)}` : 'Not solved yet' }),
        rec ? h('div.tile-best', { text: `best: ${spellsText(rec.words)}` }) : null,
      ]);
    };
    const total = levels.filter((l) => l.goal).reduce((s, l) => s + (records[l.id]?.stars ?? 0), 0);
    const max = levels.filter((l) => l.goal).length * 3;
    this.overlay.classList.remove('title');
    this.overlay.replaceChildren(
      h('div.panel.levels', {}, [
        h('h2', { text: 'Choose a level' }),
        h('p.small.levels-total', { text: `★ ${total} / ${max} stars · fewer spells, more stars` }),
        h('div.level-grid', {}, [...levels.filter((l) => l.goal), ...levels.filter((l) => !l.goal)].map(card)),
        current ? h('div.panel-actions', {}, [h('button.btn.secondary', { text: 'Back', onClick: () => this.hideOverlay() })]) : null,
      ]),
    );
    this.overlay.classList.remove('hidden');
  }

  get overlayOpen(): boolean {
    return !this.overlay.classList.contains('hidden');
  }

  /** Hides the win panel if it's showing (leaves the intro alone). */
  hideWin(): void {
    if (this.overlay.querySelector('.win')) this.overlay.classList.add('hidden');
  }

  hideOverlay(): void {
    this.overlay.classList.add('hidden');
    this.overlay.classList.remove('title');
    if (this.autoFocus) this.input.focus();
  }

  /** Title screen. `logo` is an optional animated element shown above the name. */
  showTitle(opts: { onPlay: () => void; onLevels: () => void; playLabel: string; logo?: HTMLElement }): void {
    const go = (fn: () => void) => () => {
      this.cb.onStart();
      this.hideOverlay();
      fn();
    };
    this.overlay.replaceChildren(
      h('div.panel.intro', {}, [
        opts.logo ?? h('div.intro-logo', { text: '▣' }),
        h('h1', { text: 'Blockspell' }),
        h('p.tagline', { text: 'Write a word. Make it real.' }),
        h('p', { text: 'Type the name of a thing (add adjectives like “big”, “blue” or “flaming”) and watch it appear. Use what you summon to solve each puzzle.' }),
        h('div.panel-actions', {}, [
          h('button.btn.big', { text: opts.playLabel, onClick: go(opts.onPlay) }),
          h('button.btn.big.secondary', { text: '☰ Levels', onClick: () => { this.cb.onStart(); opts.onLevels(); } }),
        ]),
        h('p.small', { text: 'Runs entirely offline. No network, no tracking.' }),
      ]),
    );
    this.overlay.classList.add('title');
    this.overlay.classList.remove('hidden');
  }
}
