import { Vector3 } from 'three';
import type { Game } from '../game';
import type { LevelDef } from '../levels/types';
import { h } from './dom';
import { isTouch, TouchControls } from './touch';
import './tutorial.css';

const STORE = 'blockspell.tutorial.v1';
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

type Anchor = 'hero' | 'spell' | 'screen';

interface Ctx {
  game: Game;
  level: LevelDef;
  /** Seconds spent in this level with no overlay open. */
  t: number;
  /** Seconds since a tip was learned (Infinity if not yet). */
  since: (id: string) => number;
  /** Seconds since the first cast in this level (-1 if none). */
  sinceCast: number;
  acts: Acts;
}

interface Acts { moved: boolean; jumped: boolean; typed: boolean; orbited: boolean; restarted: boolean; climbed: number }

interface Tip {
  id: string;
  /** HTML-free text; `[Key]` renders as a keycap. */
  text: string | (() => string);
  anchor: Anchor;
  /** Show when true. */
  when: (c: Ctx) => boolean;
  /** Learned (and faded out) when true. Omit for transient tips that just vanish when `when` turns false. */
  done?: (c: Ctx) => boolean;
  /** Preempts whatever tip is showing. */
  urgent?: boolean;
}

const key = (s: string) => s.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');

/**
 * Contextual coach: one friendly, dismissible tooltip at a time that teaches a
 * control right when it's useful, fades out once the player does it, and never
 * comes back (remembered in localStorage). `?notips` disables it; `?tips=reset` forgets progress.
 */
export class Tutorial {
  readonly touch: TouchControls;
  private el: HTMLElement;
  private textEl: HTMLElement;
  private root: HTMLElement;
  private learned: Record<string, number> = {};
  private enabled = !/[?&]notips\b/.test(location.search);
  private level: LevelDef | null = null;
  private t = 0;
  private lastWords = 0;
  private lastCast = Infinity;
  private snoozed = new Set<string>();
  private acts: Acts = fresh();
  private current: { tip: Tip; age: number } | null = null;
  private gap = 0;
  private clock = 0;
  private tips: Tip[];
  private v = new Vector3();

  constructor(root: HTMLElement) {
    this.root = root;
    this.touch = new TouchControls(root);
    if (/[?&]tips=reset\b/.test(location.search)) this.save(true);
    else this.load();

    this.textEl = h('div.tip-text');
    this.el = h('div.tutorial-tip', { role: 'status', 'aria-live': 'polite' }, [
      this.textEl,
      h('button.tip-x', { type: 'button', text: '✕', title: 'Got it', 'aria-label': 'Dismiss tip', onClick: () => this.dismiss() }),
    ]);
    this.el.style.display = 'none';
    root.append(this.el);
    this.tips = this.buildTips();

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const typing = document.activeElement?.tagName === 'INPUT';
      if (typing) return;
      if (MOVE_KEYS.has(e.code)) this.acts.moved = true;
      if (e.code === 'Space') this.acts.jumped = true;
      if (e.code === 'KeyR') this.acts.restarted = true;
    });
    root.addEventListener('focusin', (e) => {
      if ((e.target as HTMLElement).classList?.contains('spell-input')) this.acts.typed = true;
    });
    const canvas = root.querySelector('canvas');
    let drag: { x: number; y: number } | null = null;
    canvas?.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY }));
    canvas?.addEventListener('pointermove', (e) => {
      if (drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 24) this.acts.orbited = true;
    });
    window.addEventListener('pointerup', () => (drag = null));
    canvas?.addEventListener('wheel', () => (this.acts.orbited = true), { passive: true });
    root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest?.('.reset-btn')) this.acts.restarted = true;
    });
  }

  /** Call from loadLevel. */
  onLevel(level: LevelDef): void {
    this.level = level;
    this.touch.setHero(!!level.hero);
    this.t = 0;
    this.lastWords = 0;
    this.lastCast = Infinity;
    this.snoozed.clear();
    this.acts = fresh();
    this.hide(false);
    this.gap = 1.2;
  }

  /** Call every frame. */
  update(game: Game, dt: number): void {
    this.touch.update(game);
    const level = this.level;
    if (!this.enabled || !level) return;
    if (game.hud.overlayOpen || game.titleMode || game.runner) {
      if (this.current) this.hide(false);
      return;
    }
    this.clock += dt;
    this.t += dt;
    if (game.words > this.lastWords && this.lastCast === Infinity) this.lastCast = this.t;
    this.lastWords = game.words;
    const hero = game.world.hero;
    if (hero?.alive && hero.state.climbing) this.acts.climbed += dt;

    const ctx: Ctx = {
      game, level, t: this.t, acts: this.acts,
      since: (id) => (this.learned[id] ? (Date.now() - this.learned[id]) / 1000 : Infinity),
      sinceCast: this.lastCast === Infinity ? -1 : this.t - this.lastCast,
    };
    if (game.words > 0) this.acts.typed = true;

    const cur = this.current;
    if (cur) {
      cur.age += dt;
      const tip = cur.tip;
      if (tip.done?.(ctx)) this.learn(tip.id);
      else if (!tip.when(ctx) && !tip.done) this.hide(true);
      else if (cur.age > 16) { this.snoozed.add(tip.id); this.hide(true); }
      else {
        const urgent = this.tips.find((o) => o.urgent && o !== tip && this.eligible(o, ctx));
        if (urgent) this.show(urgent);
      }
    } else {
      this.gap -= dt;
      if (this.gap <= 0) {
        const next = this.tips.find((o) => this.eligible(o, ctx));
        if (next) this.show(next);
      }
    }
    if (this.current) this.place(game);
  }

  private eligible(tip: Tip, c: Ctx): boolean {
    return !this.learned[tip.id] && !this.snoozed.has(tip.id) && tip.when(c);
  }

  // ------------------------------------------------------------ tips
  private buildTips(): Tip[] {
    const touch = isTouch;
    const hero = (c: Ctx) => !!c.level.hero;
    const typed = (c: Ctx) => c.acts.typed || c.game.words > 0;
    return [
      {
        id: 'climb', anchor: 'hero', urgent: true,
        text: touch ? 'Hold <b>Climb</b> to go up' : 'Hold [W] to climb',
        when: (c) => hero(c) && c.t > 1 && this.nearClimbable(c.game),
        done: (c) => c.acts.climbed > 0.6,
      },
      {
        id: 'walk', anchor: 'hero',
        text: touch ? 'Drag the pad to walk, tap <b>Jump</b> to hop' : '[WASD] or arrow keys to walk, [Space] to jump',
        when: (c) => hero(c) && c.t > 1.2,
        done: (c) => c.acts.moved,
      },
      {
        id: 'jump', anchor: 'hero',
        text: touch ? 'Tap <b>Jump</b> to hop up' : 'Press [Space] to jump',
        when: (c) => hero(c) && c.since('walk') > 4,
        done: (c) => c.acts.jumped,
      },
      {
        id: 'cast', anchor: 'spell',
        text: touch ? 'Tap the spell bar to write a word' : 'Press [Enter] to write a word',
        when: (c) => hero(c) && (c.since('walk') > 6 || c.t > 12),
        done: typed,
      },
      {
        id: 'type', anchor: 'spell',
        text: 'Type a word, like “ball”, then press [Enter]',
        when: (c) => !hero(c) && c.t > 2.5,
        done: typed,
      },
      {
        id: 'aim', anchor: 'screen',
        text: touch ? 'Tap the ground to choose where things appear' : 'Click the ground to choose where things appear',
        when: (c) => c.sinceCast > 2 && !c.game.world.aim,
        done: (c) => !!c.game.world.aim,
      },
      {
        id: 'far', anchor: 'spell',
        text: 'Too far? Walk closer, or click nearer to you',
        when: (c) => this.tooFar(c),
      },
      {
        id: 'orbit', anchor: 'screen',
        text: touch ? 'Drag to look around, pinch to zoom' : 'Drag to orbit, scroll to zoom',
        when: (c) => (c.level.goal ? c.t > 40 : c.t > 6 && c.acts.typed),
        done: (c) => c.acts.orbited,
      },
      {
        id: 'restart', anchor: 'screen',
        text: touch ? 'Stuck? Tap ↺ to restart the level' : 'Stuck? Press [R] to restart the level',
        when: (c) => !!c.level.goal && c.t > 75,
        done: (c) => c.acts.restarted,
      },
    ];
  }

  private nearClimbable(game: Game): boolean {
    const h0 = game.world.hero;
    if (!h0?.alive) return false;
    if (h0.state.climbing) return true;
    for (const o of game.world.entities) {
      if (!o.alive || o === h0 || !o.has('climbable') || o.has('ghost')) continue;
      if (Math.hypot(o.x - h0.x, o.z - h0.z) < 1.2 + o.radius && Math.abs(o.y - h0.y) < o.size.y) return true;
    }
    return false;
  }

  private tooFar(c: Ctx): boolean {
    const range = c.level.castRange;
    const hero = c.game.world.hero;
    const aim = c.game.world.aim ?? (c.level.spawnPoint ? { x: c.level.spawnPoint[0], z: c.level.spawnPoint[2] } : null);
    if (!range || !hero?.alive || !aim) return false;
    return document.activeElement === c.game.hud.input && Math.hypot(aim.x - hero.x, aim.z - hero.z) > range;
  }

  // ------------------------------------------------------------ view
  private show(tip: Tip): void {
    this.current = { tip, age: 0 };
    const text = typeof tip.text === 'function' ? tip.text() : tip.text;
    this.textEl.innerHTML = key(text);
    this.el.style.display = '';
    this.el.classList.remove('out', 'show');
    this.el.classList.toggle('no-arrow', tip.anchor === 'screen');
    void this.el.offsetWidth;
    this.el.classList.add('show');
  }

  /** Fades the tip out. `gap` adds a short pause before the next one. */
  private hide(fade: boolean): void {
    this.current = null;
    this.gap = 1.5;
    if (!fade) {
      this.el.style.display = 'none';
      this.el.classList.remove('show', 'out');
      return;
    }
    this.el.classList.remove('show');
    this.el.classList.add('out');
    const el = this.el;
    setTimeout(() => { if (!this.current && el.classList.contains('out')) el.style.display = 'none'; }, 320);
  }

  private learn(id: string): void {
    this.learned[id] = Date.now();
    this.save();
    this.hide(true);
  }

  private dismiss(): void {
    if (this.current) this.learn(this.current.tip.id);
  }

  private place(game: Game): void {
    if (!this.current) return;
    const rect = this.root.getBoundingClientRect();
    const w = this.el.offsetWidth, hh = this.el.offsetHeight;
    let x = rect.width / 2, y = rect.height * 0.32;
    const a = this.current.tip.anchor;
    if (a === 'spell') {
      const bar = this.root.querySelector('.hud-bottom')?.getBoundingClientRect();
      if (bar) { x = bar.left - rect.left + bar.width / 2; y = bar.top - rect.top - 12; }
    } else if (a === 'hero') {
      const hero = game.world.hero;
      if (hero?.alive) {
        this.v.set(hero.x, hero.y + hero.size.y / 2 + 0.25, hero.z).project(game.renderer.camera);
        if (this.v.z < 1) {
          x = (this.v.x * 0.5 + 0.5) * rect.width;
          y = (-this.v.y * 0.5 + 0.5) * rect.height - 14;
        }
      }
    }
    const cx = Math.min(Math.max(x, w / 2 + 8), rect.width - w / 2 - 8);
    const cy = Math.min(Math.max(y, hh + 8), rect.height - 8);
    this.el.style.transform = `translate(${Math.round(cx - w / 2)}px, ${Math.round(cy - hh)}px)`;
    this.el.style.setProperty('--ax', `${Math.min(Math.max(x - (cx - w / 2), 18), w - 18)}px`);
  }

  // ------------------------------------------------------------ storage
  private load(): void {
    try { this.learned = JSON.parse(localStorage.getItem(STORE) ?? '{}') || {}; } catch { this.learned = {}; }
  }

  private save(clear = false): void {
    if (clear) this.learned = {};
    try { localStorage.setItem(STORE, JSON.stringify(this.learned)); } catch { /* private mode: tips just repeat */ }
  }
}

function fresh(): Acts {
  return { moved: false, jumped: false, typed: false, orbited: false, restarted: false, climbed: 0 };
}
