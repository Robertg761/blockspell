import { TROPHIES, type Trophies } from '../trophies';
import { h } from './dom';
import './panels.css';

/** The 🏆 panel: every trophy, unlocked ones in color and the rest with their progress. */
export function trophiesPanel(trophies: Trophies, onBack: () => void): HTMLElement {
  const total = TROPHIES.length;
  const got = trophies.unlockedCount;
  const rows = TROPHIES.map((t) => {
    const done = trophies.has(t.id);
    const secret = t.secret && !done;
    const cur = Math.min(t.goal, trophies.stat(t.stat));
    return h(`div.trophy${done ? '' : '.locked'}`, {}, [
      h('span.trophy-icon', { text: secret ? '❔' : t.icon }),
      h('div', {}, [
        h('div.trophy-name', { text: secret ? '???' : t.name }),
        h('div.trophy-desc', { text: secret ? 'A secret. Keep playing.' : t.desc }),
        !done && !secret && t.goal > 1 ? h('div.trophy-prog', { text: `${cur} / ${t.goal}` }) : null,
      ]),
    ]);
  });
  return h('div.panel.trophies', {}, [
    h('h2', { text: '🏆 Trophies' }),
    h('p.trophy-sum', { text: `${got} of ${total} unlocked` }),
    h('div.trophy-bar', {}, [h('i', { style: `width:${Math.round((got / total) * 100)}%` })]),
    h('div.trophy-list', {}, rows),
    h('div.panel-actions', {}, [h('button.btn', { type: 'button', text: 'Done', onClick: onBack })]),
  ]);
}
