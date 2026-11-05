import type { Game } from '../game';
import type { CarryHint } from '../behaviors/lib/carry';
import { rideKind } from '../behaviors/lib/ride';
import { nearbyLabel, useLabel } from '../behaviors/lib/use';
import { h } from './dom';

/** True on touch-first devices, or when forced with `?touch` (for testing). */
export const isTouch: boolean =
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || /[?&]touch\b/.test(location.search);

type Code = 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD' | 'Space' | 'KeyE' | 'KeyF' | 'KeyQ' | 'KeyC' | 'ShiftLeft';
const KEY: Record<Code, string> = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', Space: ' ', KeyE: 'e', KeyF: 'f', KeyQ: 'q', KeyC: 'c', ShiftLeft: 'Shift' };

/**
 * On-screen controls for hero levels (joystick, Jump, Climb, and Grab, Throw and Turn when
 * they apply). They drive the
 * game by dispatching synthetic key events on window, so game.ts needs no
 * touch-specific code. Also makes the level card tap-to-expand on small screens.
 */
export class TouchControls {
  readonly el: HTMLElement;
  private held = new Set<Code>();
  private sources = new Map<string, Set<Code>>();
  private shown = false;
  private heroLevel = false;
  private grabBtn: HTMLElement;
  private tossBtn: HTMLElement;
  private turnBtn: HTMLElement;
  private useBtn: HTMLElement;
  private downBtn: HTMLElement;
  private climbBtn: HTMLElement;
  private jumpBtn: HTMLElement;
  /** On board, a full stick is only steering: running means nothing there, and Shift would mean descend. */
  private riding = false;

  constructor(root: HTMLElement) {
    const knob = h('div.joy-knob');
    const joy = h('div.joy', { 'aria-label': 'Move' }, [knob]);
    this.bindJoystick(joy, knob);
    const jump = h('button.touch-btn.jump', { type: 'button', text: 'Jump', 'aria-label': 'Jump' });
    const climb = h('button.touch-btn.climb', { type: 'button', text: 'Climb ▲', 'aria-label': 'Climb' });
    this.bindHold(jump, 'jump', ['Space']);
    this.bindHold(climb, 'climb', ['KeyW']);
    this.grabBtn = h('button.touch-btn.carry.off', { type: 'button', text: 'Grab', 'aria-label': 'Grab' });
    this.tossBtn = h('button.touch-btn.carry.off', { type: 'button', text: 'Throw', 'aria-label': 'Throw' });
    this.turnBtn = h('button.touch-btn.carry.off', { type: 'button', text: 'Turn', 'aria-label': 'Turn what you hold' });
    this.bindHold(this.grabBtn, 'grab', ['KeyE']);
    this.bindHold(this.tossBtn, 'toss', ['KeyF']);
    this.bindHold(this.turnBtn, 'turn', ['KeyQ']);
    this.useBtn = h('button.touch-btn.carry.off', { type: 'button', text: 'Use', 'aria-label': 'Use what you hold' });
    this.downBtn = h('button.touch-btn.carry.off', { type: 'button', text: 'Down ▼', 'aria-label': 'Fly down' });
    this.bindHold(this.useBtn, 'use', ['KeyC']);
    this.bindHold(this.downBtn, 'down', ['ShiftLeft']);
    this.climbBtn = climb;
    this.jumpBtn = jump;
    this.el = h('div.touch-controls.hidden', {}, [joy, h('div.touch-actions', {}, [this.turnBtn, this.tossBtn, this.useBtn, this.grabBtn, this.downBtn, climb, jump])]);
    root.append(this.el);
    if (isTouch) document.body.classList.add('touch');

    // compact level card on small screens: tap to expand / collapse
    document.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const card = t.closest?.('.level-card');
      if (card && !t.closest('button')) card.classList.toggle('expanded');
    });
  }

  setHero(on: boolean): void {
    this.heroLevel = on;
  }

  update(game: Game): void {
    const show = isTouch && this.heroLevel && !game.titleMode && !game.hud.overlayOpen && document.activeElement !== game.hud.input;
    if (show !== this.shown) {
      this.shown = show;
      this.el.classList.toggle('hidden', !show);
      document.body.classList.toggle('touch-hero', show);
      if (!show) this.releaseAll();
    }
    if (show) this.syncCarry(game.carryHint);
  }

  /** Shows the buttons that apply to what the hero can reach or holds. */
  private syncCarry(hint: CarryHint | null): void {
    const verb = hint?.verb;
    const holding = verb === 'holding';
    const riding = verb === 'riding';
    this.riding = riding;
    const flying = riding && (rideKind(hint!.entity) === 'plane' || rideKind(hint!.entity) === 'hover');
    const label = riding ? 'Get out' : holding || verb === 'dragging' ? 'Drop' : verb === 'drag' ? 'Drag' : verb === 'ride' ? (hint!.entity.def.ride?.verb ?? 'Ride') : verb === 'wear' ? 'Put on' : 'Grab';
    if (this.grabBtn.textContent !== label) this.grabBtn.textContent = label;
    const jumpLabel = flying ? 'Up ▲' : 'Jump';
    if (this.jumpBtn.textContent !== jumpLabel) this.jumpBtn.textContent = jumpLabel;
    const use = !hint || riding ? null : holding ? useLabel(hint.entity) : nearbyLabel(hint.entity);
    if (use && this.useBtn.textContent !== use) this.useBtn.textContent = use;
    this.climbBtn.classList.toggle('off', riding);
    this.setShown(this.grabBtn, 'grab', !!verb && verb !== 'heavy');
    this.setShown(this.tossBtn, 'toss', holding);
    this.setShown(this.turnBtn, 'turn', holding && hint!.entity.def.grip === undefined);
    this.setShown(this.useBtn, 'use', !!use);
    this.setShown(this.downBtn, 'down', flying);
  }

  private setShown(btn: HTMLElement, src: string, on: boolean): void {
    if (btn.classList.contains('off') === !on) return;
    btn.classList.toggle('off', !on);
    if (!on) {
      // a hidden button never sees its pointerup
      btn.classList.remove('active');
      this.setSource(src, []);
    }
  }

  // ---------------------------------------------------------------- keys
  private setSource(src: string, codes: Code[]): void {
    this.sources.set(src, new Set(codes));
    const want = new Set<Code>();
    for (const s of this.sources.values()) for (const c of s) want.add(c);
    for (const c of want) if (!this.held.has(c)) this.fire('keydown', c);
    for (const c of [...this.held]) if (!want.has(c)) this.fire('keyup', c);
    this.held = want;
  }

  private fire(type: 'keydown' | 'keyup', code: Code): void {
    window.dispatchEvent(new KeyboardEvent(type, { code, key: KEY[code], bubbles: true, cancelable: true }));
  }

  private releaseAll(): void {
    for (const s of [...this.sources.keys()]) this.setSource(s, []);
  }

  private grab(): void {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  private bindHold(btn: HTMLElement, src: string, codes: Code[]): void {
    const down = (e: PointerEvent) => {
      e.preventDefault();
      this.grab();
      btn.setPointerCapture?.(e.pointerId);
      btn.classList.add('active');
      this.setSource(src, codes);
    };
    const up = () => {
      btn.classList.remove('active');
      this.setSource(src, []);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private bindJoystick(joy: HTMLElement, knob: HTMLElement): void {
    let id = -1;
    const move = (e: PointerEvent) => {
      const r = joy.getBoundingClientRect();
      const rad = r.width / 2;
      let dx = (e.clientX - (r.left + rad)) / rad, dy = (e.clientY - (r.top + rad)) / rad;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      knob.style.transform = `translate(${dx * rad * 0.55}px, ${dy * rad * 0.55}px)`;
      const codes: Code[] = [];
      if (len > 0.28) {
        if (dx > 0.38) codes.push('KeyD'); else if (dx < -0.38) codes.push('KeyA');
        if (dy < -0.38) codes.push('KeyW'); else if (dy > 0.38) codes.push('KeyS');
        if (len > 0.92 && !this.riding) codes.push('ShiftLeft'); // pushed all the way: run
      }
      this.setSource('joy', codes);
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      knob.style.transform = '';
      joy.classList.remove('active');
      this.setSource('joy', []);
    };
    joy.addEventListener('pointerdown', (e) => {
      if (id !== -1) return;
      e.preventDefault();
      this.grab();
      id = e.pointerId;
      joy.setPointerCapture?.(id);
      joy.classList.add('active');
      move(e);
    });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);
    joy.addEventListener('lostpointercapture', end);
  }
}
