import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { all, countIn } from '../predicates';
import { defineTask, offset } from '../types';
import camp from '../zones/70-camp';

// A flat pad in the camp's northeast. A camp needs a tent, somewhere to sit and a light.
const f = new Frame(offset(camp.center, [4.5, 0, -2.5]));
const PAD: [[number, number, number], [number, number, number]] = [[-2.6, -1, -2.6], [2.6, 5, 2.6]];
const pad = () => f.box(PAD[0], PAD[1]);

const solutions: LevelSolution[] = [
  { name: 'tent, bench and lantern', steps: [{ cast: 'tent', at: [-1.2, -1.2] }, { wait: 1 }, { cast: 'bench', at: [1.3, 0.9] }, { wait: 1 }, { cast: 'lantern', at: [0.1, 1.8] }], timeout: 12 },
  { name: 'tent, chair and candle', steps: [{ cast: 'tent', at: [-1.2, -1.2] }, { wait: 1 }, { cast: 'chair', at: [1.3, 0.9] }, { wait: 1 }, { cast: 'candle', at: [0.1, 1.8] }], timeout: 12 },
  { name: 'tent, log and torch', steps: [{ cast: 'tent', at: [-1.2, -1.2] }, { wait: 1 }, { cast: 'log', at: [1.3, 0.9] }, { wait: 1 }, { cast: 'torch', at: [0.1, 1.8] }], timeout: 12 },
  { name: 'tent, bench and a pumpkin lantern', steps: [{ cast: 'tent', at: [-1.2, -1.2] }, { wait: 1 }, { cast: 'bench', at: [1.3, 0.9] }, { wait: 1 }, { cast: 'pumpkin', at: [0.1, 1.8] }], timeout: 12 },
];

export default defineTask({
  id: 'camp',
  zone: 'camp',
  order: 22,
  title: 'Make camp',
  hint: 'The flat pad is waiting for a camp: shelter to sleep in, somewhere to sit, and a light to see by. Put all three on it.',
  setup(world) {
    f.staticBox(world, { position: [0, 0.05, 0], size: [5.4, 0.1, 5.4], color: 'stone', topColor: 'dirt' });
  },
  check: (w) =>
    all(
      countIn({ id: 'tent', noRole: true }, pad()),
      (ww) => countIn({ id: 'bench', noRole: true }, pad())(ww) || countIn({ id: 'chair', noRole: true }, pad())(ww) || countIn({ id: 'log', noRole: true }, pad())(ww),
      countIn({ tag: 'glows', noRole: true }, pad()),
    )(w),
  start: f.p(0, 0, 5),
  solutions: solutions.map((s) => f.solution(s)),
});
