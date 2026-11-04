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
  /** Flips the voxel detail (HD / classic); returns the new state. */
  onHD: () => boolean;
}

/** One task row in the Journal. */
export interface JournalTask {
  title: string;
  hint: string;
  done: boolean;
  ways: number;
}

/** What the Journal shows: tasks grouped by zone, plus the spell count (world mode keeps it here, not in the HUD). */
export interface JournalInfo {
  zones: { name: string; here: boolean; tasks: JournalTask[] }[];
  spells: number;
  onFreePlay: () => void;
  onTitle: () => void;
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
  private banner = h('div.zone-banner', { 'aria-live': 'polite' });
  private menuBtn: HTMLButtonElement;
  private history: string[] = [];
  private historyIdx = -1;
  private hint = '';
  private muted = loadMuted();
  readonly bookBtn: HTMLButtonElement;
  private hdBtn: HTMLButtonElement;
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
    // each letter ticks a little higher, like a typewriter rising up the scale
    this.input.addEventListener('input', (ev) => {
      const n = this.input.value.length;
      if ((ev as InputEvent).inputType?.startsWith('insert') && n) Audio.instance?.play('tick', { pitch: 0.92 + (n % 9) * 0.035 });
    });

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
    this.hdBtn = h('button.icon-btn.hd-btn', { text: 'HD', onClick: () => this.setHD(cb.onHD()) });
    this.bookBtn = h('button.icon-btn', { title: 'Spellbook (Tab)', text: '📖', onClick: () => cb.onSpellbook() });
    this.menuBtn = h('button.icon-btn.levels-btn', { title: 'Menu', text: '☰ Menu', 'data-icon': '☰', onClick: () => cb.onLevels() });

    root.append(
      h('div.hud-top-left', {}, [
        h('div.brand', {}, [h('span.brand-mark', { text: '▣' }), ' Blockspell']),
        h('div.level-card', {}, [this.levelName, this.levelDesc, this.goal, this.wordsLine, this.hintBtn]),
      ]),
      h('div.hud-top-right', {}, [
        this.menuBtn,
        this.bookBtn,
        h('button.icon-btn.reset-btn', { title: 'Restart (R)', text: '↺', onClick: () => cb.onReset() }),
        muteBtn,
        this.hdBtn,
      ]),
      this.toasts.el,
      h('div.hud-bottom', {}, [this.chips, this.form]),
      this.help,
      this.banner,
      this.overlay,
    );
  }

  /** A menu button that flips the voxel detail (HD / classic). */
  private hdToggle(): HTMLButtonElement {
    const label = () => (this.hdBtn.classList.contains('off') ? 'Graphics: Classic' : 'Graphics: HD');
    const btn = h('button.btn.secondary.hd-toggle', { text: label(), title: 'HD voxels or the classic, faster look', onClick: () => {
      this.setHD(this.cb.onHD());
      btn.textContent = label();
    } });
    return btn;
  }

  /** Shows the voxel detail setting on its button. */
  setHD(on: boolean): void {
    this.hdBtn.classList.toggle('off', !on);
    this.hdBtn.title = on ? 'Graphics: HD voxels (click for the classic look)' : 'Graphics: classic voxels (click for HD)';
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
    const world = !!level.tasks;
    this.levelName.textContent = level.order > 0 && !level.hidden ? `${level.order}. ${level.name}` : level.name;
    this.levelDesc.textContent = level.description;
    this.hint = level.hint ?? '';
    this.hintBtn.style.display = level.hint && level.goal ? '' : 'none';
    this.goal.replaceChildren();
    if (level.goal) this.goal.append(h('span.goal-box'), h('span', { text: level.goal.text }));
    else if (level.hint && !world) this.goal.append(h('span.goal-free', { text: level.hint }));
    this.goal.classList.remove('done');
    this.help.textContent = world
      ? 'WASD / arrows: move · Space: jump · W near a ladder: climb · E: grab · F: throw · Enter: write a word · Click ground: aim · J: journal · R: reset this island'
      : level.hero
        ? 'WASD / arrows: move · Space: jump · W near a ladder: climb · E: grab · F: throw · Enter: write a word · Click ground: aim · R: restart'
        : 'Drag to orbit · Drag things to move them, flick to throw · Scroll to zoom · Click ground to aim · Click things to poke';
    this.menuBtn.textContent = world ? '📓 Journal' : '☰ Menu';
    this.menuBtn.title = world ? 'Journal (J)' : 'Menu';
    this.menuBtn.dataset.icon = world ? '📓' : '☰';
    this.banner.classList.remove('show');
    this.setWords(0, level.goal ? (level.par ?? 2) : null);
  }

  /** Open world: the level card names the hero's zone. */
  setZoneName(name: string): void {
    this.levelName.textContent = name;
  }

  /**
   * Open world: the pinned tracker line in the level card, showing the nearest
   * unfinished task (and its zone when it is somewhere else). Null shows `idle`.
   */
  setTracker(task: { title: string; zone: string | null } | null, idle = ''): void {
    const key = task ? `${task.title}|${task.zone}` : `|${idle}`;
    if (this.goal.dataset.key === key) return;
    this.goal.dataset.key = key;
    this.goal.classList.remove('done');
    if (!task) {
      this.goal.replaceChildren(idle ? h('span.goal-free', { text: idle }) : '');
      return;
    }
    this.goal.replaceChildren(
      h('span.goal-box'),
      h('span.goal-text', { text: task.title }),
      task.zone ? h('span.goal-zone', { text: task.zone }) : '',
    );
  }

  /** Big zone name across the top of the screen, fading out after a couple of seconds. */
  showZoneBanner(name: string): void {
    this.banner.textContent = name;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
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
          h('button.btn.secondary', { text: '☰ Menu', onClick: () => this.cb.onLevels() }),
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

  /** The open world's Journal: tasks by zone with a tick, a hint to reveal and the ways found so far. */
  showJournal(info: JournalInfo): void {
    const total = info.zones.reduce((n, z) => n + z.tasks.length, 0);
    const done = info.zones.reduce((n, z) => n + z.tasks.filter((t) => t.done).length, 0);
    const row = (t: JournalTask) => {
      const hint = h('div.journal-hint.hidden', { text: t.hint });
      const btn = h('button.link-btn.journal-hint-btn', {
        type: 'button',
        text: 'Hint',
        onClick: () => {
          const hidden = hint.classList.toggle('hidden');
          btn.textContent = hidden ? 'Hint' : 'Hide hint';
        },
      });
      return h(`div.journal-task${t.done ? '.done' : ''}`, {}, [
        h('span.journal-tick', { text: t.done ? '✓' : '', title: t.done ? 'Done' : 'Not done yet' }),
        h('div.journal-main', {}, [
          h('div.journal-title', { text: t.title }),
          h('div.journal-meta', {}, [h('span.journal-ways', { text: `ways found: ${t.ways}` }), btn]),
          hint,
        ]),
      ]);
    };
    this.overlay.classList.remove('title');
    this.overlay.replaceChildren(
      h('div.panel.journal', {}, [
        h('h2', { text: '📓 Journal' }),
        h('p.small.journal-total', { text: `${done} of ${total} tasks done · Spells cast: ${info.spells}` }),
        ...info.zones.map((z) =>
          h('section.journal-zone', {}, [
            h('h3', {}, [z.name, z.here ? h('span.journal-here', { text: 'you are here' }) : '']),
            ...(z.tasks.length ? z.tasks.map(row) : [h('div.journal-empty', { text: 'Tasks coming soon.' })]),
          ]),
        ),
        h('p.small', { text: 'Every task has more than one answer. Solve one again with different words to find a new way.' }),
        h('div.panel-actions', {}, [
          h('button.btn', { text: 'Back to the world', onClick: () => this.hideOverlay() }),
          h('button.btn.secondary', { text: '✦ Free Play', onClick: () => { this.hideOverlay(); info.onFreePlay(); } }),
          h('button.btn.secondary', { text: 'Title screen', onClick: () => info.onTitle() }),
          this.hdToggle(),
        ]),
      ]),
    );
    this.overlay.classList.remove('hidden');
  }

  get journalOpen(): boolean {
    return this.overlayOpen && !!this.overlay.querySelector('.journal');
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
  showTitle(opts: { onExplore: () => void; onFreePlay: () => void; exploreLabel: string; logo?: HTMLElement }): void {
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
        h('p', { text: 'Type the name of a thing (add adjectives like “big”, “blue” or “flaming”) and watch it appear. Explore the islands and help out with what you summon, or play with every word in Free Play.' }),
        h('div.panel-actions', {}, [
          h('button.btn.big.explore-btn', { text: opts.exploreLabel, onClick: go(opts.onExplore) }),
          h('button.btn.big.secondary.freeplay-btn', { text: '✦ Free Play', onClick: go(opts.onFreePlay) }),
        ]),
        h('p.small', { text: 'Runs entirely offline. No network, no tracking.' }),
      ]),
    );
    this.overlay.classList.add('title');
    this.overlay.classList.remove('hidden');
  }
}
