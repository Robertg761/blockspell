import './ui/styles.css';
import { Game } from './game';

const root = document.getElementById('app')!;
const game = new Game(root);

// handy for debugging from the console
(window as unknown as { blockspell: Game }).blockspell = game;
