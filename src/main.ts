import './ui/styles.css';
import { applyQuery, installDebug } from './debug';
import { Game } from './game';
import { createVoxelLogo } from './ui/logo';

const root = document.getElementById('app')!;
const game = new Game(root);

// handy for debugging from the console; see src/debug.ts for the automation hook
(window as unknown as { blockspell: Game }).blockspell = game;
const api = installDebug(game);
if (!applyQuery(game, api)) game.showTitle(createVoxelLogo().el);
