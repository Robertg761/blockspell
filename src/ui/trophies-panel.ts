import { EXPERIMENTS, TROPHIES, type Trophies } from '../trophies';
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
  const lab = trophies.labDone;
  const experiments = EXPERIMENTS.map((x) => {
    const done = lab.has(x.id);
    return h(`div.trophy${done ? '' : '.locked'}`, {}, [
      h('span.trophy-icon', { text: done ? x.icon : '🧪' }),
      h('div', {}, [h('div.trophy-name', { text: x.name }), h('div.trophy-desc', { text: done ? 'Done. You saw it happen.' : x.hint })]),
    ]);
  });
  return h('div.panel.trophies', {}, [
    h('h2', { text: '🏆 Trophies' }),
    h('p.trophy-sum', { text: `${got} of ${total} unlocked` }),
    h('div.trophy-bar', {}, [h('i', { style: `width:${Math.round((got / total) * 100)}%` })]),
    h('div.trophy-list', {}, rows),
    h('h3.lab-title', { text: `🧪 Lab notebook · ${lab.size} of ${EXPERIMENTS.length}` }),
    h('p.small', { text: 'Things that happen when you mix things. Each one is ticked the first time you make it happen.' }),
    h('div.trophy-list', {}, experiments),
    h('div.panel-actions', {}, [h('button.btn', { type: 'button', text: 'Done', onClick: onBack })]),
  ]);
}
