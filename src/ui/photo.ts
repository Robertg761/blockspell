import { PHOTO_FILTERS } from '../photo-filters';
import { h } from './dom';
import { isAndroidApp, saveBlob } from '../save-file';
import './tools.css';

/** The photo mode controls: a bar (Snap, Freeze, Done), the shutter flash and the little photo that slides in. */
export class PhotoUI {
  private bar: HTMLElement;
  private hint = h('div.photo-hint.hidden', { text: 'Drag to orbit · scroll to zoom · Space snaps · Esc leaves' });
  private flashEl = h('div.photo-flash');
  private filters: HTMLElement;
  private clipBtn: HTMLButtonElement;
  private onFilter: (id: string) => void;
  private freezeBtn: HTMLButtonElement;
  private thumbTimer = 0;
  private lastUrl = '';

  constructor(private root: HTMLElement, ops: { onSnap: () => void; onFreeze: () => void; onExit: () => void; onFilter: (id: string) => void; onClip?: () => void }) {
    this.freezeBtn = h('button.btn.secondary', { type: 'button', text: '❄ Freeze time', onClick: () => ops.onFreeze() });
    this.filters = h('div.photo-filters.hidden', { role: 'radiogroup', 'aria-label': 'Photo look' }, PHOTO_FILTERS.map((f) => {
      const b = h('button.photo-filter', { type: 'button', text: f.name, role: 'radio', 'aria-checked': f.id === 'natural' ? 'true' : 'false', onClick: () => this.pick(f.id) });
      b.dataset.id = f.id;
      if (f.id === 'natural') b.classList.add('on');
      return b;
    }));
    this.onFilter = ops.onFilter;
    this.clipBtn = h('button.btn.secondary', { type: 'button', text: '🎞 Clip', title: 'Record a short clip of the scene (6 seconds)', onClick: () => ops.onClip?.() });
    if (!ops.onClip) this.clipBtn.style.display = 'none';
    this.bar = h('div.photo-bar.hidden', {}, [
      h('button.btn', { type: 'button', text: '📷 Snap', onClick: () => ops.onSnap() }),
      this.clipBtn,
      this.freezeBtn,
      h('button.btn.secondary', { type: 'button', text: 'Done', onClick: () => ops.onExit() }),
    ]);
    root.append(this.filters, this.bar, this.hint, this.flashEl);
  }

  /** Highlights a look and tells the game about it. */
  pick(id: string): void {
    for (const b of this.filters.children) {
      const el = b as HTMLElement;
      const on = el.dataset.id === id;
      el.classList.toggle('on', on);
      el.setAttribute('aria-checked', String(on));
    }
    this.onFilter(id);
  }

  /** The clip button counts down while recording. */
  setRecording(seconds: number | null): void {
    this.clipBtn.disabled = seconds !== null;
    this.clipBtn.textContent = seconds === null ? '🎞 Clip' : `● ${Math.ceil(seconds)}s`;
    this.clipBtn.classList.toggle('recording', seconds !== null);
  }

  show(on: boolean): void {
    this.filters.classList.toggle('hidden', !on);
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
  thumb(url: string, filename: string, blob?: Blob): void {
    this.clearThumb();
    this.lastUrl = url;
    const a = h('a.photo-thumb', { href: url, download: filename, title: 'Save this photo again' }, [h('img', { src: url, alt: 'Your photo' }), h('span', { text: blob && isAndroidApp() ? 'Tap to save or share' : 'Saved ✓ click to save again' })]);
    // the Android app can't follow <a download>, so saving again goes through the share sheet there
    if (blob && isAndroidApp()) a.addEventListener('click', (e) => { e.preventDefault(); void saveBlob(blob, filename); });
    this.root.append(a);
    this.thumbTimer = window.setTimeout(() => {
      a.classList.add('out');
      setTimeout(() => a.remove(), 450);
    }, 4500);
  }

  private clearThumb(): void {
    clearTimeout(this.thumbTimer);
    this.root.querySelectorAll('.photo-thumb').forEach((e) => e.remove());
    const old = this.lastUrl;
    if (old) setTimeout(() => URL.revokeObjectURL(old), 10000);
    this.lastUrl = '';
  }
}
