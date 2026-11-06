import { h } from './dom';
import './tools.css';

export type ToolId = 'photo' | 'share' | 'undo' | 'clear' | 'speed' | 'sky' | 'weather' | 'trophies' | 'shop';

interface ToolDef {
  id: ToolId;
  icon: string;
  title: string;
  /** Which modes show it. */
  modes: ('free' | 'hero' | 'world')[];
}

const TOOLS: ToolDef[] = [
  { id: 'photo', icon: '📷', title: 'Photo mode', modes: ['free', 'hero', 'world'] },
  { id: 'share', icon: '🔗', title: 'Copy a link to this scene', modes: ['free'] },
  { id: 'undo', icon: '↶', title: 'Undo the last spell', modes: ['free'] },
  { id: 'clear', icon: '🧹', title: 'Clear everything you cast', modes: ['free'] },
  { id: 'speed', icon: '⏱', title: 'Time: normal, slow, slower, paused', modes: ['free', 'hero', 'world'] },
  { id: 'sky', icon: '🌤', title: 'Time of day: day, sunset, night, dawn', modes: ['free', 'hero', 'world'] },
  { id: 'weather', icon: '🌦', title: 'Weather: clear, rain, snow', modes: ['free', 'hero', 'world'] },
  { id: 'trophies', icon: '🏆', title: 'Trophies', modes: ['free', 'hero', 'world'] },
  { id: 'shop', icon: '🪙', title: 'Shop: spend your coins', modes: ['hero', 'world'] },
];

/** The vertical strip of extra buttons on the right edge: photo, share, undo, clear, time, sky, weather and trophies. */
export class SideTools {
  readonly el = h('div.side-tools.hidden', { role: 'toolbar', 'aria-label': 'Extra tools' });
  private buttons = new Map<ToolId, HTMLButtonElement>();
  private badges = new Map<ToolId, HTMLElement>();

  constructor(onTool: (id: ToolId) => void) {
    // on phones the strip folds into this one button (see tools.css), so it isn't a column of six icons over the game
    const toggle = h('button.tool-btn.tools-toggle', { type: 'button', title: 'More tools', 'aria-label': 'More tools', 'aria-expanded': 'false' }, [h('span.tool-icon', { text: '⋯' })]);
    const setOpen = (open: boolean) => {
      this.el.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(!this.el.classList.contains('open')));
    // tapping the game, or anything else, tucks them away again
    document.addEventListener('pointerdown', (e) => {
      if (this.el.classList.contains('open') && !this.el.contains(e.target as Node)) setOpen(false);
    });
    this.el.append(toggle);
    for (const t of TOOLS) {
      const badge = h('span.tool-badge');
      const b = h('button.tool-btn', { type: 'button', title: t.title, 'aria-label': t.title, 'data-tool': t.id, onClick: () => onTool(t.id) }, [h('span.tool-icon', { text: t.icon }), badge]);
      this.buttons.set(t.id, b);
      this.badges.set(t.id, badge);
      this.el.append(b);
    }
  }

  /** Shows the tools that fit a mode, or hides the strip (title screen, overlays: `mode` null). */
  setMode(mode: 'free' | 'hero' | 'world' | null): void {
    this.el.classList.toggle('hidden', !mode);
    if (!mode) return;
    for (const t of TOOLS) this.buttons.get(t.id)!.style.display = t.modes.includes(mode) ? '' : 'none';
  }

  setBadge(id: ToolId, text: string): void {
    this.badges.get(id)!.textContent = text;
  }

  setEnabled(id: ToolId, on: boolean): void {
    this.buttons.get(id)!.disabled = !on;
  }

  setActive(id: ToolId, on: boolean): void {
    this.buttons.get(id)!.classList.toggle('active', on);
  }
}
