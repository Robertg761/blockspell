import { spellsText, starsForPar, type LevelDef, type LevelObjective } from '../levels/types';
import { clockText, demoWays } from '../levels/demo-best';
import { Audio, loadMuted } from '../engine/audio';
import { Autocomplete } from './autocomplete';
import { isTouch } from './touch';
import { Hotbar } from './hotbar';
import { h } from './dom';
import { pwa, type PwaState } from '../pwa';
import { detectPlatform } from '../platform';
import { Toasts } from './toast';

export interface HudCallbacks {
  onCast: (text: string) => void;
  onLevel: (id: string) => void;
  onReset: () => void;
  onMute: (muted: boolean) => void;
  onStart: () => void;
  onSpellbook: () => void;
  /** 🎲 in Free Play: stage a random scene. */
  onSurprise: () => void;
  onLevels: () => void;
  onSettings: () => void;
  /** Flips the voxel detail (HD / classic); returns the new state. */
  onHD: () => boolean;
}

/** One task row in the Journal. */
export interface JournalTask {
  title: string;
  hint: string;
  done: boolean;
  ways: number;
  /** The spells of one known way to solve it, in order, for the second hint ("Show me a way"). */
  answer?: string[];
}

/** What the Journal shows: tasks grouped by zone, plus the spell count (world mode keeps it here, not in the HUD). */
export interface JournalInfo {
  zones: { name: string; here: boolean; tasks: JournalTask[] }[];
  spells: number;
  onFreePlay: () => void;
  onTitle: () => void;
  /** More buttons for the panel's action row (trophies...). */
  extra?: HTMLElement[];
}

export interface WinInfo {
  level: LevelDef;
  stars: number;
  words: number;
  par: number;
  newBest: boolean;
  next: LevelDef | null;
}

const HISTORY_KEY = 'blockspell.history.v1';
function loadHistory(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string').slice(0, 30) : [];
  } catch {
    return [];
  }
}
function saveHistory(list: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const OFFLINE_TOLD = 'blockspell.offlineTold.v1';
const starText = (n: number, of = 3) => '★'.repeat(n) + '☆'.repeat(Math.max(0, of - n));

/** What a guided level held back from toasts, for its finish panel. */
export interface DemoNews { words: string[]; trophies: string[]; experiments: number }
export interface DemoResult {
  words: number; stars: number; par: number; time: number; prev: { time: number; words: number; runs: number } | null; fasterBest: boolean; fewerBest: boolean;
  /** Spells that have finished each job, across runs, the ones new this run, and the jobs (for an untried idea). */
  ways: Record<string, string[]>; newWays: number; jobs: LevelObjective[];
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
  private wordsLine = h('div.words-line');
  private objectives = h('div.objectives.hidden');
  private objectivesKey = '';
  /** The demo's run clock, kept across the job card's re-renders. */
  private objectiveClock = h('span.objective-clock', { 'aria-label': 'Time' });
  private chips = h('div.word-chips');
  private help = h('div.help');
  private overlay = h('div.overlay.hidden');
  private banner = h('div.zone-banner', { 'aria-live': 'polite' });
  private menuBtn: HTMLButtonElement;
  private surpriseBtn: HTMLButtonElement;
  private history: string[] = loadHistory();
  private historyIdx = -1;
  private hint = '';
  private muted = loadMuted();
  readonly bookBtn: HTMLButtonElement;
  private hdBtn: HTMLButtonElement;
  private pwaLine = h('div.pwa-line');
  private compass = h('span.goal-compass.hidden', { title: 'Direction of the nearest task' }, [h('span.compass-arrow', { text: '➤' }), h('span.compass-dist')]);
  private compassKey = '';
  /** Word completion for the spell bar. */
  readonly autocomplete: Autocomplete;
  /** Pinned spells above the spell bar (1-9 casts them). */
  readonly hotbar: Hotbar;
  private pinBtn: HTMLButtonElement;
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
    this.surpriseBtn = h('button.surprise-btn', { type: 'button', text: '🎲', title: 'Surprise me', 'aria-label': 'Surprise me: stage a random scene', onClick: () => cb.onSurprise() });
    this.surpriseBtn.style.display = 'none';
    this.autocomplete = new Autocomplete(this.input);
    this.hotbar = new Hotbar((t) => cb.onCast(t));
    this.pinBtn = h('button.pin-btn', { type: 'button', text: '☆', title: 'Pin this spell to the hotbar (or the last one you cast)', 'aria-label': 'Pin a spell to the hotbar', onClick: () => this.pinCurrent() });
    this.form = h('form.spell-bar', { onSubmit: (ev: Event) => this.submit(ev) }, [
      this.autocomplete.list,
      h('span.spell-icon', { text: '✦', 'aria-hidden': 'true' }),
      h('div.spell-field', {}, [this.autocomplete.ghost, this.input]),
      this.pinBtn,
      this.surpriseBtn,
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
        h('div.level-card', {}, [this.levelName, this.levelDesc, this.goal, this.objectives, this.wordsLine, this.hintBtn]),
      ]),
      h('div.hud-top-right', {}, [
        this.menuBtn,
        this.bookBtn,
        h('button.icon-btn.reset-btn', { title: 'Restart (R)', text: '↺', onClick: () => cb.onReset() }),
        muteBtn,
        h('button.icon-btn.settings-btn', { title: 'Settings', text: '⚙', 'aria-label': 'Settings', onClick: () => cb.onSettings() }),
      ]),
      this.toasts.el,
      h('div.hud-bottom', {}, [this.chips, this.hotbar.el, this.form]),
      this.help,
      this.banner,
      this.overlay,
    );
    this.startPlaceholderDemo();
    this.watchPwa();
  }

  /** Install button, "saved for offline" note and update prompts, driven by src/pwa.ts. */
  private watchPwa(): void {
    let told = false, updateShown = false;
    pwa.onChange((s) => {
      this.renderPwaLine(s);
      if (s.updateReady && !updateShown) {
        updateShown = true;
        this.toasts.show('A new version of Blockspell has been downloaded.', { title: 'Update ready', kind: 'info', duration: 30000, actions: [{ label: 'Reload now', onClick: () => pwa.applyUpdate() }] });
      }
      if (s.offlineReady && !told) {
        told = true;
        let seen = false;
        try { seen = !!localStorage.getItem(OFFLINE_TOLD); localStorage.setItem(OFFLINE_TOLD, '1'); } catch { /* ignore */ }
        if (!seen) this.toasts.show('The whole game is saved on this device now. You can turn the Wi-Fi off and keep playing.', { title: '✈ Ready for offline play', kind: 'success', duration: 7000 });
      }
    });
  }

  private renderPwaLine(s: PwaState): void {
    const bits: (HTMLElement | string)[] = [];
    if (s.offlineReady) bits.push(h('span.pwa-ok', { text: s.online ? '✓ Saved for offline play' : '✈ Playing offline' }));
    else if (!s.online) bits.push(h('span.pwa-ok', { text: '✈ Playing offline' }));
    if (s.canInstall) bits.push(h('button.link-btn.install-btn', { type: 'button', text: '⬇ Install as an app', onClick: () => void pwa.install() }));
    this.pwaLine.replaceChildren(...bits);
  }

  /**
   * While the spell bar sits empty and unused, its placeholder types out example spells, one letter
   * at a time, so a new player sees what to write (and that adjectives stack) without reading a manual.
   */
  private startPlaceholderDemo(): void {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const base = this.input.placeholder;
    const lines = ['big red ball', 'flaming box', '3 tiny balloons', 'giant ladder', 'frozen dragon', 'bouncy golden ball', 'heavy anvil', 'rainbow cat'];
    let line = Math.floor(Math.random() * lines.length), n = 0, hold = 0, erasing = false;
    setInterval(() => {
      // once the player has cast a few spells of their own they know how it works: stop the show
      const idle = !this.input.value && !this.overlayOpen && !document.hidden && this.history.length < 3;
      if (!idle) {
        if (this.input.placeholder !== base) this.input.placeholder = base;
        n = 0; hold = 0; erasing = false;
        return;
      }
      const text = lines[line];
      if (hold > 0) hold--;
      else if (!erasing && n < text.length) n++;
      else if (!erasing) { erasing = true; hold = 14; }
      else if (n > 0) n -= 2;
      else { erasing = false; line = (line + 1) % lines.length; hold = 6; n = 0; }
      n = Math.max(0, n);
      this.input.placeholder = n ? `Try “${text.slice(0, n)}”` : base;
    }, 75);
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
    saveHistory(this.history);
    this.historyIdx = -1;
    this.input.value = '';
    this.autocomplete.hide();
    this.cb.onCast(text);
  }

  private onKey(ev: KeyboardEvent): void {
    if (this.autocomplete.onKey(ev)) {
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    if (ev.key === 'ArrowUp' && this.history.length) {
      this.historyIdx = Math.min(this.history.length - 1, this.historyIdx + 1);
      this.input.value = this.history[this.historyIdx];
      this.autocomplete.hide(true);
      ev.preventDefault();
    } else if (ev.key === 'ArrowDown') {
      this.historyIdx = Math.max(-1, this.historyIdx - 1);
      this.input.value = this.historyIdx >= 0 ? this.history[this.historyIdx] : '';
      this.autocomplete.hide(true);
      ev.preventDefault();
    } else if (ev.key === 'Escape') this.input.blur();
  }

  /** ☆: pins what is typed, or the latest spell you cast. */
  private pinCurrent(): void {
    const text = this.input.value.trim() || this.history[0];
    if (!text) {
      this.toasts.show('Type a spell first, then pin it.', { kind: 'info', duration: 2500 });
      return;
    }
    if (this.hotbar.has(text)) {
      this.hotbar.unpin(this.hotbar.all.indexOf(text.toLowerCase().replace(/\s+/g, ' ')));
      this.toasts.show(`Unpinned “${text}”.`, { kind: 'info', duration: 2000 });
    } else if (this.hotbar.pin(text)) {
      this.toasts.show(`Pinned “${text}” as ${this.hotbar.all.length}. Press ${this.hotbar.all.length} to cast it.`, { title: '☆ Pinned', kind: 'success', duration: 3500 });
    } else {
      this.toasts.show('The hotbar is full. Right-click a slot to unpin one.', { kind: 'warn', duration: 3000 });
    }
    this.input.focus();
  }

  /** Puts text in the spell bar, ready to edit or cast. */
  prefill(text: string): void {
    this.input.value = text;
    this.input.focus();
    this.autocomplete.hide(true);
  }

  setWordChips(words: string[]): void {
    if (!words.length) { this.chips.replaceChildren(); return; }
    this.chips.replaceChildren(
      h('span.chips-label', { text: 'Try:' }),
      ...words.map((w) => h('button.chip', { type: 'button', text: w, onClick: () => this.cb.onCast(w) })),
    );
  }

  setLevel(level: LevelDef): void {
    const world = !!level.tasks;
    this.objectivesKey = '';
    this.objectives.replaceChildren();
    this.objectives.classList.toggle('hidden', !level.objectives);
    this.objectives.parentElement?.classList.toggle('has-objectives', !!level.objectives);
    delete this.goal.dataset.key;
    this.levelName.textContent = level.order > 0 && !level.hidden ? `${level.order}. ${level.name}` : level.name;
    this.levelDesc.textContent = level.description;
    this.hint = level.hint ?? '';
    this.hintBtn.style.display = level.hint && level.goal ? '' : 'none';
    this.goal.replaceChildren();
    if (level.goal) this.goal.append(h('span.goal-box'), h('span', { text: level.goal.text }));
    else if (level.hint && !world) this.goal.append(h('span.goal-free', { text: level.hint }));
    this.goal.classList.remove('done');
    this.help.textContent = world
      ? 'WASD / arrows: move · Shift: run · Space: jump · W near a ladder: climb · E: grab or get in · C: use · F: throw · Enter: write a word · Click ground: send the next spell there · J: journal · R: reset this island'
      : level.hero
        ? 'WASD / arrows: move · Shift: run · Space: jump · W near a ladder: climb · E: grab or get in · C: use · F: throw · Enter: write a word · Click ground: send the next spell there · R: restart'
        : 'Drag to orbit · Drag things to move them, flick to throw · Scroll to zoom · Click ground to send the next spell there · Click things to poke · Click a vehicle to drive it · Drag a tool onto something to break it';
    this.surpriseBtn.style.display = !level.goal && !level.hero && !world ? '' : 'none';
    this.menuBtn.textContent = world ? '📓 Journal' : '☰ Menu';
    this.menuBtn.title = world ? 'Journal (J)' : 'Menu';
    this.menuBtn.dataset.icon = world ? '📓' : '☰';
    this.banner.classList.remove('show');
    this.setWords(0, level.goal && !level.objectives ? (level.par ?? 2) : null);
  }

  setObjectives(list: LevelObjective[], done: string[], active: LevelObjective | undefined, onTrack: (id: string) => void, onAim: () => void): void {
    const key = `${done.join(',')}|${active?.id ?? ''}`;
    if (key === this.objectivesKey) return;
    this.objectivesKey = key;
    this.setTracker(active ? { title: active.title, zone: null } : null, 'All four jobs done!');
    const used = active ? demoWays.all()[active.id] ?? [] : [];
    this.objectives.replaceChildren(h('div.objective-body', {}, [
      h('div.objective-progress', { role: 'status' }, [`${done.length} / ${list.length} jobs done`, this.objectiveClock]),
      h('div.objective-list', { 'aria-label': 'Island jobs' }, list.map((o, i) => h('button.objective-row', {
        type: 'button', 'aria-pressed': String(active?.id === o.id), disabled: done.includes(o.id),
        'data-done': String(done.includes(o.id)),
        onClick: () => onTrack(o.id),
      }, [h('span.objective-number', { text: done.includes(o.id) ? '✓' : String(i + 1) }), o.title]))),
      active ? h('p.objective-instruction', { text: active.instruction }) : null,
      active ? h('div.objective-actions', {}, [
        h('button.chip.objective-aim', { type: 'button', text: 'Aim at this job', onClick: onAim }),
        h('button.chip', { type: 'button', text: 'Hint', onClick: () => this.toasts.show(active.hint, { title: active.title, duration: 10000 }) }),
      ]) : null,
      active ? h('div.objective-spells', {}, [h('span', { text: 'Try a word:' }), ...active.spells.map((spell) =>
        h(`button.chip${used.includes(spell) ? '.used' : ''}`, { type: 'button', text: used.includes(spell) ? `✓ ${spell}` : spell, title: used.includes(spell) ? `You've solved this with ${spell}. Try another way?` : `Write ${spell} in the spell bar`, onClick: () => this.prefill(spell) }))]) : null,
      active ? h('p.objective-controls', { text: isTouch ? 'Type a word below, then Cast: it appears in front of you. Tap the ground to send the next one elsewhere. Use the pad to walk.' : 'Type a word below, then Cast: it appears in front of you. Click the ground to send the next one elsewhere. WASD to walk, Space to jump.' }) : null,
    ]));
  }

  /** The demo's run clock in the job card ("1:23"). */
  setObjectiveClock(text: string): void {
    this.objectiveClock.textContent = `⏱ ${text}`;
  }

  showDemoWin(r: DemoResult, news: DemoNews, ops: { onExplore: () => void; onRetry: () => void; onKeep: () => void; onFreePlay: () => void }): void {
    const go = (fn: () => void) => () => { this.hideOverlay(); fn(); };
    const earned = [
      news.words.length ? `New words: ${news.words.join(', ')}.` : '',
      news.trophies.length ? `Trophies: ${news.trophies.join(', ')}.` : '',
      news.experiments ? `Lab notebook: ${news.experiments} ticked.` : '',
    ].filter(Boolean).join(' ');
    this.showPanel(h('div.panel.win.demo-win', {}, [
      h('div.win-stars', {}, [0, 1, 2].map((i) => h(`span.win-star${i < r.stars ? '.on' : ''}`, { text: '★', style: `animation-delay:${0.25 + i * 0.22}s` }))),
      h('h2', { text: 'The island is ready!' }),
      h('div.demo-stats', {}, [
        stat('Time', clockText(r.time), r.fasterBest ? 'New best!' : r.prev ? `Best ${clockText(r.prev.time)}` : 'First clear'),
        stat('Spells', String(r.words), r.fewerBest ? 'New best!' : r.prev ? `Best ${r.prev.words}` : `Par ${r.par}`),
      ]),
      h('p', { text: r.stars < 3
        ? `Can you do all four jobs in ${spellsText(r.par)} for ★★★?`
        : r.fasterBest || !r.prev ? 'A different spell solves every job. Can you beat your time with new ones?' : `Your best is ${clockText(r.prev.time)}. One more go?` }),
      waysLine(),
      earned ? h('p.small', { text: earned }) : null,
      h('div.panel-actions', {}, [
        h('button.btn', { type: 'button', text: '↺ Play again', onClick: go(ops.onRetry) }),
        h('button.btn.secondary', { type: 'button', text: 'Explore the full world', onClick: go(ops.onExplore) }),
        h('button.btn.secondary', { type: 'button', text: 'Free Play', onClick: go(ops.onFreePlay) }),
        h('button.link-btn', { type: 'button', text: 'Stay on this island', onClick: ops.onKeep }),
      ]),
    ]));
    for (let i = 0; i < r.stars; i++)
      setTimeout(() => Audio.instance?.play('star', { pitch: 2 ** ((i * 4) / 12) }), (0.25 + i * 0.22) * 1000 + 120);
    function waysLine() {
      const found = Object.values(r.ways).reduce((n, l) => n + l.length, 0);
      // an idea for next time: a listed spell that hasn't finished its job yet
      const untried = r.jobs.flatMap((j) => j.spells.filter((s) => !(r.ways[j.id] ?? []).includes(s)).map((s) => ({ s, job: j.title.toLowerCase() })));
      const idea = untried[Math.floor(Math.random() * untried.length)];
      return h('p.demo-ways', {}, [
        h('strong', { text: `✦ ${found} ${found === 1 ? 'way' : 'ways'} found` }),
        r.newWays ? ` (${r.newWays} new this run)` : '',
        idea ? `. Next time, try “${idea.s}” to ${idea.job}.` : '. You found every listed way. What else works?',
      ]);
    }
    function stat(label: string, value: string, note: string) {
      return h(`div.demo-stat${note === 'New best!' ? '.best' : ''}`, {}, [
        h('span.demo-stat-label', { text: label }), h('strong', { text: value }), h('span.demo-stat-note', { text: note }),
      ]);
    }
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
      this.compass,
    );
  }

  /**
   * The arrow next to the tracked task: `angle` is where it lies in radians clockwise from straight ahead
   * on the screen, `dist` meters away. Null (or very close) hides it.
   */
  setCompass(angle: number | null, dist = 0): void {
    const show = angle !== null && dist > 5;
    const key = show ? `${Math.round((angle! * 180) / Math.PI / 4)}|${Math.round(dist)}` : '';
    if (key === this.compassKey) return;
    this.compassKey = key;
    this.compass.classList.toggle('hidden', !show);
    if (!show) return;
    (this.compass.firstElementChild as HTMLElement).style.transform = `rotate(${angle! - Math.PI / 2}rad)`;
    (this.compass.lastElementChild as HTMLElement).textContent = `${Math.round(dist)} m`;
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
      const answerLine = t.answer?.length && !t.done ? this.answerBox(t.answer) : null;
      const hint = h('div.journal-hint.hidden', {}, [t.hint, answerLine]);
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
          h('button.btn.secondary', { text: '⚙ Settings', onClick: () => this.cb.onSettings() }),
          ...(info.extra ?? []),
        ]),
      ]),
    );
    this.overlay.classList.remove('hidden');
  }

  /** The Journal's second hint: hidden behind a button because it gives one way away. Pinning puts its spells on the hotbar. */
  private answerBox(spells: string[]): HTMLElement {
    const reveal = h('div.journal-answer.hidden', {}, [
      h('span', { text: 'One way: ' }),
      h('b', { text: spells.join(', then ') }),
      h('button.link-btn', {
        type: 'button',
        text: '☆ Pin',
        title: 'Put these on the hotbar',
        onClick: (ev: Event) => {
          const added = spells.filter((sp) => this.hotbar.pin(sp)).length;
          (ev.currentTarget as HTMLElement).textContent = added ? '✓ Pinned' : 'Already pinned';
        },
      }),
    ]);
    const btn = h('button.link-btn.journal-answer-btn', {
      type: 'button',
      text: 'Show me a way (spoiler)',
      onClick: () => {
        reveal.classList.remove('hidden');
        btn.remove();
      },
    });
    return h('div.journal-answerbox', {}, [btn, reveal]);
  }

  /** Shows any panel (settings, trophies, finale...) in the overlay. Close it with `hideOverlay()`. */
  showPanel(panel: HTMLElement): void {
    this.overlay.classList.remove('title');
    this.overlay.replaceChildren(panel);
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
  showTitle(opts: { onDemo: () => void; onExplore: () => void; onFreePlay: () => void; onSurprise: () => void; onSettings: () => void; onGetApp: () => void; extra?: HTMLElement[]; exploreLabel: string; logo?: HTMLElement }): void {
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
        h('p', { text: 'A hungry pup. An empty garden. A lookout you cannot reach. Type what you need and make this little island ready for visitors.' }),
        h('button.btn.big.demo-btn', { type: 'button', text: '▶ Play demo', onClick: go(opts.onDemo) }),
        h('p.small', { text: 'Four jobs on one island. Follow the guide or find your own way.' }),
        h('div.panel-actions', {}, [
          h('button.btn.secondary.explore-btn', { text: opts.exploreLabel, onClick: go(opts.onExplore) }),
          h('button.btn.secondary.freeplay-btn', { text: '✦ Free Play', onClick: go(opts.onFreePlay) }),
        ]),
        h('div.title-links', {}, [
          h('button.link-btn.surprise-link', { type: 'button', text: '🎲 Surprise me', onClick: go(opts.onSurprise) }),
          ...(opts.extra ?? []),
          h('button.link-btn.settings-link', { type: 'button', text: '⚙ Settings', onClick: opts.onSettings }),
          // already an app (desktop, Android, installed PWA)? Then there is nothing left to download
          ...(detectPlatform().native || detectPlatform().standalone ? [] : [h('button.link-btn.get-app-link', { type: 'button', text: '⬇ Get the app', onClick: opts.onGetApp })]),
        ]),
        h('p.small', { text: 'Runs entirely offline. No network, no tracking.' }),
        this.pwaLine,
      ]),
    );
    this.overlay.classList.add('title');
    this.overlay.classList.remove('hidden');
  }
}
