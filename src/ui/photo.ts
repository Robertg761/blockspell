import { h } from './dom';
import './tools.css';

/** The photo mode controls: a bar (Snap, Freeze, Done), the shutter flash and the little photo that slides in. */
export class PhotoUI {
  private bar: HTMLElement;
  private hint = h('div.photo-hint.hidden', { text: 'Drag to orbit · scroll to zoom · Space snaps · Esc leaves' });
  private flashEl = h('div.photo-flash');
  private freezeBtn: HTMLButtonElement;
  private thumbTimer = 0;
  private lastUrl = '';

  constructor(private root: HTMLElement, ops: { onSnap: () => void; onFreeze: () => void; onExit: () => void }) {
    this.freezeBtn = h('button.btn.secondary', { type: 'button', text: '❄ Freeze time', onClick: () => ops.onFreeze() });
    this.bar = h('div.photo-bar.hidden', {}, [
      h('button.btn', { type: 'button', text: '📷 Snap', onClick: () => ops.onSnap() }),
      this.freezeBtn,
      h('button.btn.secondary', { type: 'button', text: 'Done', onClick: () => ops.onExit() }),
    ]);
    root.append(this.bar, this.hint, this.flashEl);
  }

  show(on: boolean): void {
    this.bar.classList.toggle('hidden', !on);
    this.hint.classList.toggle('hidden', !on);
    if (!on) this.clearThumb();
  }

  setFrozen(frozen: boolean): void {
    this.freezeBtn.textContent = frozen ? '▶ Resume time' : '❄ Freeze time';
  }

  flash(): void {
    this.flashEl.classList.remove('go');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('go');
  }

  /** Slides the photo in at the corner; clicking it saves it again. */
  thumb(url: string, filename: string): void {
    this.clearThumb();
    this.lastUrl = url;
    const a = h('a.photo-thumb', { href: url, download: filename, title: 'Save this photo again' }, [h('img', { src: url, alt: 'Your photo' }), h('span', { text: 'Saved ✓ click to save again' })]);
    this.root.append(a);
    this.thumbTimer = window.setTimeout(() => {
      a.classList.add('out');
      setTimeout(() => a.remove(), 450);
    }, 4500);
  }

  private clearThumb(): void {
    clearTimeout(this.thumbTimer);
    this.root.querySelectorAll('.photo-thumb').forEach((e) => e.remove());
    if (this.lastUrl) setTimeout(() => URL.revokeObjectURL(this.lastUrl), 10000);
    this.lastUrl = '';
  }
}
