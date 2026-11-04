import { settings, type Settings } from '../settings';
import { h } from './dom';
import './panels.css';

export interface SettingsPanelOps {
  /** Graphics: HD voxels on/off. Returns the new state. */
  toggleHD: () => boolean;
  hdOn: () => boolean;
  /** Forget the open-world and level progress, spellbook and tips. */
  resetProgress: () => void;
  resetTips: () => void;
  onBack: () => void;
}

/** The ⚙ panel: volumes, effects, camera speed and the reset buttons. Values apply live and are saved. */
export function settingsPanel(ops: SettingsPanelOps): HTMLElement {
  const s = settings.get();
  const slider = (key: 'music' | 'sfx' | 'orbit', label: string, note: string, min: number, max: number, step: number, fmt: (v: number) => string) => {
    const out = h('span.set-value', { text: fmt(s[key]) });
    const input = h('input', { type: 'range', min, max, step, value: s[key], 'aria-label': label });
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = fmt(v);
      settings.set({ [key]: v } as Partial<Settings>);
    });
    return h('label.set-row', {}, [h('span.set-label', {}, [label, h('small', { text: note })]), input, out]);
  };
  const toggle = (key: 'reduceEffects' | 'shake' | 'tips' | 'cycle' | 'guide', label: string, note: string) => {
    const input = h('input', { type: 'checkbox', 'aria-label': label });
    input.checked = s[key];
    input.addEventListener('change', () => settings.set({ [key]: input.checked } as Partial<Settings>));
    return h('label.set-row', {}, [h('span.set-label', {}, [label, h('small', { text: note })]), input]);
  };
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const hd = h('button.btn.secondary', { type: 'button', text: `Graphics: ${ops.hdOn() ? 'HD' : 'Classic'}`, title: 'HD voxels or the classic, faster look' });
  hd.addEventListener('click', () => {
    hd.textContent = `Graphics: ${ops.toggleHD() ? 'HD' : 'Classic'}`;
  });
  const tips = h('button.btn.secondary', { type: 'button', text: 'Show control tips again' });
  tips.addEventListener('click', () => {
    ops.resetTips();
    settings.set({ tips: true });
    tips.textContent = 'Tips will show again ✓';
  });
  const wipe = h('button.btn.danger', { type: 'button', text: 'Erase my progress' });
  let armed = 0;
  wipe.addEventListener('click', () => {
    if (!armed) {
      wipe.classList.add('armed');
      wipe.textContent = 'Really erase everything?';
      armed = window.setTimeout(() => {
        armed = 0;
        wipe.classList.remove('armed');
        wipe.textContent = 'Erase my progress';
      }, 4000);
      return;
    }
    clearTimeout(armed);
    ops.resetProgress();
    wipe.classList.remove('armed');
    wipe.textContent = 'Progress erased ✓';
    armed = 0;
  });
  return h('div.panel.settings', {}, [
    h('h2', { text: '⚙ Settings' }),
    slider('music', 'Music', 'The generated background tune', 0, 1, 0.05, pct),
    slider('sfx', 'Sound effects', 'Spells, bumps, booms and barks', 0, 1, 0.05, pct),
    slider('orbit', 'Camera speed', 'How fast dragging turns the view', 0.4, 2.5, 0.1, (v) => `${v.toFixed(1)}×`),
    toggle('reduceEffects', 'Calmer effects', 'No screen punch, zoom, fringing or camera swoops. On by default if your system asks for reduced motion'),
    toggle('shake', 'Camera shake', 'Rumble on explosions and hard landings'),
    toggle('tips', 'Control tips', 'Little hints that appear when a control becomes useful'),
    toggle('guide', 'Task guide', 'In Explore, a beam of light and an arrow point to the nearest unfinished task'),
    toggle('cycle', 'Day and night', 'In Explore the sky slowly turns through sunset and night'),
    h('div.set-actions', {}, [hd, tips, wipe]),
    h('div.panel-actions', {}, [h('button.btn', { type: 'button', text: 'Done', onClick: () => ops.onBack() })]),
  ]);
}
