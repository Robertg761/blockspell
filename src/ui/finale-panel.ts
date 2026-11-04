import { h } from './dom';
import './panels.css';

export interface FinaleStats {
  tasks: number;
  ways: number;
  words: number;
  wordsTotal: number;
  casts: number;
  trophies: number;
  trophiesTotal: number;
}

/** Shown once, when the last task of the open world is done. */
export function finalePanel(s: FinaleStats, ops: { onKeep: () => void; onFreePlay: () => void; onTrophies: () => void }): HTMLElement {
  const stat = (n: string | number, label: string) => h('div.finale-stat', {}, [h('b', { text: String(n) }), h('span', { text: label })]);
  return h('div.panel.finale', {}, [
    h('div.win-stars', {}, [0, 1, 2].map((i) => h('span.win-star.on', { text: '★', style: `animation-delay:${0.2 + i * 0.2}s` }))),
    h('h2', { text: 'Every island is happy!' }),
    h('p', { text: 'The beacon burns, the pup is fed, the vault is open. You helped with everything the islands asked for, using nothing but words.' }),
    h('div.finale-stats', {}, [
      stat(s.tasks, 'tasks done'),
      stat(s.ways, 'ways found'),
      stat(`${s.words}/${s.wordsTotal}`, 'words discovered'),
      stat(s.casts, 'spells cast'),
    ]),
    h('p.small', { text: `Trophies: ${s.trophies} of ${s.trophiesTotal}. Every task has more than one answer, so there is always another way to find.` }),
    h('div.panel-actions', {}, [
      h('button.btn', { type: 'button', text: 'Keep exploring', onClick: ops.onKeep }),
      h('button.btn.secondary', { type: 'button', text: '✦ Free Play', onClick: ops.onFreePlay }),
      h('button.btn.secondary', { type: 'button', text: '🏆 Trophies', onClick: ops.onTrophies }),
    ]),
  ]);
}
