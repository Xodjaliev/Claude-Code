import './styles/main.css';
import { Game } from './game/Game';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const root = document.getElementById('app')!;
if (!webglAvailable()) {
  root.innerHTML =
    '<div style="display:grid;place-items:center;height:100%;text-align:center;font:600 18px sans-serif;color:#eef2ff;padding:24px">WebGL is not available in this browser.<br/>Please use a recent Chrome, Edge, Firefox or Safari.</div>';
} else {
  const game = new Game(root);
  game.start();
  // handy for debugging from the console
  (window as unknown as { game: Game }).game = game;
}
