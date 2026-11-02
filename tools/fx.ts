/**
 * Dev-only: triggers Effects.celebrate and renders mid-celebration.
 *   /tools/fx.html?t=0.8   seconds simulated after the celebration starts
 */
import '../src/ui/styles.css';
import { Game } from '../src/game';

const q = new URLSearchParams(location.search);
const game = new Game(document.getElementById('app')!);
document.querySelector('.overlay')?.classList.add('hidden');
game.fx.celebrate({ x: 0, y: 1, z: 0 });
const t = parseFloat(q.get('t') ?? '0.8');
for (let s = 0; s < t; s += 1 / 30) { game.world.update(1 / 30); game.fx.update(1 / 30); }
game.renderer.render(1 / 30, game.fx.shake);
