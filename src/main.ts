import './styles.css';
import { Game } from './game/Game';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas element #game not found');
}

const game = new Game(canvas);
game.start();

// Expose for debugging / automated tests only.
(window as unknown as { __dotSurvival?: Game }).__dotSurvival = game;
