import { Vector3, type Camera } from 'three';
import type { CarryHint } from '../behaviors/lib/carry';
import { rideKind } from '../behaviors/lib/ride';
import { useLabel } from '../behaviors/lib/use';
import { h } from './dom';
import { isTouch } from './touch';
import './prompt.css';

/** The [key, action] pairs to show; an empty key is plain text. */
function lines(hint: CarryHint): [string, string][] {
  const name = hint.entity.label;
  switch (hint.verb) {
    case 'lift': return [['E', `Grab ${name}`]];
    case 'wear': return [['E', `Put on ${name}`]];
    case 'ride': {
      const verb = hint.entity.def.ride?.verb ?? 'Ride';
      return [['E', `${verb} ${name}`], ...(hint.entity.has('thrust') ? [['C', 'Light fuse'] as [string, string]] : [])];
    }
    case 'riding': {
      if (!hint.fresh) return [];
      const kind = rideKind(hint.entity);
      const flying: [string, string][] = kind === 'plane' || kind === 'hover' ? [['Space', 'Up'], ['Shift', 'Down']] : [];
      return [['WASD', 'Steer'], ...flying, ['E', 'Get out']];
    }
    case 'drag': return [['E', `Drag ${name}`]];
    case 'heavy': return [['', `${name[0].toUpperCase()}${name.slice(1)} is too heavy`]];
    case 'holding': {
      const use = useLabel(hint.entity);
      if (hint.entity.has('wearable')) return [['Space', 'Fly'], ['E', 'Take off']];
      return [...(use ? [['C', use] as [string, string]] : []), ['E', hint.spot ? 'Put down' : 'Drop'], ['F', 'Throw'], ...(hint.entity.def.grip === undefined ? [['Q', 'Turn'] as [string, string]] : [])];
    }
    case 'dragging': return [['E', 'Let go']];
  }
}

/** Floats over what the hero can grab or is holding and says which keys do what. */
export class CarryPrompt {
  private el = h('div.carry-prompt', { role: 'status' });
  private key = '';
  private v = new Vector3();

  constructor(private root: HTMLElement) {
    this.el.style.display = 'none';
    root.append(this.el);
  }

  update(hint: CarryHint | null, camera: Camera): void {
    // touch screens have buttons for all this; only say what's in reach and what's too heavy
    const list = !hint ? [] : isTouch ? (hint.verb === 'holding' || hint.verb === 'dragging' || hint.verb === 'riding' ? [] : lines(hint).map(([, text]): [string, string] => ['', text])) : lines(hint);
    const key = JSON.stringify(list);
    if (key !== this.key) {
      this.key = key;
      this.el.style.display = list.length ? '' : 'none';
      this.el.replaceChildren(...list.map(([k, text]) => h('span.carry-action', {}, k ? [h('kbd', { text: k }), h('span', { text })] : [h('span', { text })])));
    }
    if (!hint || !list.length) return;
    const e = hint.entity;
    this.v.set(e.x, e.y + e.size.y / 2 + 0.2, e.z).project(camera);
    if (this.v.z >= 1) return;
    const rect = this.root.getBoundingClientRect();
    const w = this.el.offsetWidth, hh = this.el.offsetHeight;
    const x = Math.min(Math.max((this.v.x * 0.5 + 0.5) * rect.width - w / 2, 8), rect.width - w - 8);
    const y = Math.min(Math.max((-this.v.y * 0.5 + 0.5) * rect.height - hh - 8, 8), rect.height - hh - 8);
    this.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
