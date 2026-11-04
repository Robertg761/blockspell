/**
 * Gamepad support: polls the first connected pad (standard mapping) once a frame
 * and reports sticks, held buttons and fresh presses. Nothing here touches the
 * game; `Game.readKeys` folds the result into the same hero input as the keyboard.
 */
export interface PadState {
  /** Left stick, deadzone removed, -1..1 (x right, y down). */
  move: { x: number; y: number };
  /** Right stick, deadzone removed. */
  look: { x: number; y: number };
  jump: boolean;
  grab: boolean;
  toss: boolean;
  turn: boolean;
  /** Buttons that went down since the last poll. */
  pressed: Set<PadButton>;
}

export type PadButton = 'a' | 'b' | 'x' | 'y' | 'start' | 'select' | 'lb' | 'rb';

const BUTTON_INDEX: Record<PadButton, number> = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, select: 8, start: 9 };
const DEADZONE = 0.22;

const dead = (v: number): number => (Math.abs(v) < DEADZONE ? 0 : Math.sign(v) * ((Math.abs(v) - DEADZONE) / (1 - DEADZONE)));

export class GamepadInput {
  private was = new Set<PadButton>();
  /** True once any pad has been seen: the HUD can show pad hints. */
  active = false;
  /** Fresh presses seen by the latest poll (empty when no pad is connected). */
  last: Set<PadButton> = new Set();
  private idle: PadState = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, jump: false, grab: false, toss: false, turn: false, pressed: new Set() };

  /** The current state of the first connected pad, or null when there is none. */
  poll(): PadState | null {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find((p): p is Gamepad => !!p && p.connected);
    if (!pad) {
      this.was.clear();
      this.last = new Set();
      return null;
    }
    this.active = true;
    const down = (b: PadButton): boolean => !!pad.buttons[BUTTON_INDEX[b]]?.pressed;
    const pressed = new Set<PadButton>();
    const now = new Set<PadButton>();
    for (const b of Object.keys(BUTTON_INDEX) as PadButton[]) {
      if (!down(b)) continue;
      now.add(b);
      if (!this.was.has(b)) pressed.add(b);
    }
    this.was = now;
    // d-pad doubles as a stick
    const dpad = { x: (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0), y: (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0) };
    const mx = dead(pad.axes[0] ?? 0) || dpad.x, my = dead(pad.axes[1] ?? 0) || dpad.y;
    const s = this.idle;
    s.move.x = mx;
    s.move.y = my;
    s.look.x = dead(pad.axes[2] ?? 0);
    s.look.y = dead(pad.axes[3] ?? 0);
    s.jump = now.has('a');
    s.grab = now.has('x');
    s.toss = now.has('b');
    s.turn = now.has('rb') || now.has('lb');
    s.pressed = pressed;
    this.last = pressed;
    return s;
  }
}
