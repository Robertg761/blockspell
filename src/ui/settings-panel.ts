import { exportSave, importSave, saveFileName } from '../save-data';
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
  /** Numbers for the "Your journey" block: label and value. */
  journey: () => [string, string][];
  onBack: () => void;
}

/** The ⚙ panel: volumes, effects, camera speed and the reset buttons. Values apply live and are saved. */
export function settingsPanel(ops: SettingsPanelOps): HTMLElement {
  const s = settings.get();
  const slider = (key: 'music' | 'sfx' | 'orbit' | 'resolution', label: string, note: string, min: number, max: number, step: number, fmt: (v: number) => string) => {
    const out = h('span.set-value', { text: fmt(s[key]) });
    const input = h('input', { type: 'range', min, max, step, value: s[key], 'aria-label': label });
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = fmt(v);
      settings.set({ [key]: v } as Partial<Settings>);
    });
    return h('label.set-row', {}, [h('span.set-label', {}, [label, h('small', { text: note })]), input, out]);
  };
  const toggle = (key: 'reduceEffects' | 'shake' | 'tips' | 'cycle' | 'guide' | 'life' | 'bloom' | 'autoRes' | 'fps', label: string, note: string) => {
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
  // ---- backup and restore
  const status = h('p.small.save-status', { 'aria-live': 'polite' });
  const exportBtn = h('button.btn.secondary', { type: 'button', text: '⬇ Save a backup', title: 'Download your progress as a file' });
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([exportSave()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: saveFileName() });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status.textContent = 'Backup saved. Keep the file somewhere safe.';
  });
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden-file', 'aria-label': 'Choose a backup file' });
  const importBtn = h('button.btn.secondary', { type: 'button', text: '⬆ Restore a backup', title: 'Replace your progress with a backup file' });
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      status.textContent = 'That file is too big to be a Blockspell save.';
      return;
    }
    const result = importSave(await file.text());
    if (result.ok) {
      status.textContent = 'Restored. Reloading…';
      setTimeout(() => location.reload(), 600);
    } else status.textContent = result.error;
    fileInput.value = '';
  });
  const journey = h('div.journey', {}, ops.journey().map(([k, v]) => h('div.journey-item', {}, [h('b', { text: v }), h('span', { text: k })])));
  return h('div.panel.settings', {}, [
    h('h2', { text: '⚙ Settings' }),
    h('h3.set-sub', { text: 'Your journey' }),
    journey,
    slider('music', 'Music', 'The generated background tune', 0, 1, 0.05, pct),
    slider('sfx', 'Sound effects', 'Spells, bumps, booms and barks', 0, 1, 0.05, pct),
    slider('orbit', 'Camera speed', 'How fast dragging turns the view', 0.4, 2.5, 0.1, (v) => `${v.toFixed(1)}×`),
    toggle('reduceEffects', 'Calmer effects', 'No screen punch, zoom, fringing or camera swoops. On by default if your system asks for reduced motion'),
    toggle('shake', 'Camera shake', 'Rumble on explosions and hard landings'),
    toggle('tips', 'Control tips', 'Little hints that appear when a control becomes useful'),
    toggle('guide', 'Task guide', 'In Explore, a beam of light and an arrow point to the nearest unfinished task'),
    toggle('cycle', 'Day and night', 'In Explore the sky slowly turns through sunset and night'),
    toggle('life', 'Little creatures', 'Fireflies at night, butterflies by day and a few birds overhead'),
    h('h3.set-sub', { text: 'Performance' }),
    slider('resolution', 'Sharpness', 'Lower it if the game feels slow. 100% is the full resolution of your screen', 0.5, 1, 0.05, pct),
    toggle('autoRes', 'Adapt to slow devices', 'Lowers the sharpness by itself if the frame rate stays low'),
    toggle('bloom', 'Glow effects', 'Soft glow around fire, light and sparks'),
    toggle('fps', 'Show frame rate', 'A small counter in the corner'),
    h('h3.set-sub', { text: 'Your data' }),
    h('div.set-actions', {}, [exportBtn, importBtn, fileInput]),
    status,
    h('div.set-actions', {}, [hd, tips, wipe]),
    h('div.panel-actions', {}, [h('button.btn', { type: 'button', text: 'Done', onClick: () => ops.onBack() })]),
  ]);
}
