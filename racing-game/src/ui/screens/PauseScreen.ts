import type { Game } from '../../game/Game';
import { button, h } from '../dom';
import type { Screen } from '../UIManager';

export class PauseScreen implements Screen {
  readonly root: HTMLElement;

  constructor(game: Game) {
    this.root = h(
      'div',
      { class: 'screen' },
      h(
        'div',
        { class: 'overlay' },
        h(
          'div',
          { class: 'panel pause-box' },
          h('div', { class: 'title', style: 'font-size:38px;margin-bottom:10px' }, 'PAUSED'),
          button('Resume', () => game.resumeRace(), 'primary'),
          button('Restart', () => game.restartRace()),
          button('Settings', () => game.ui.show('settings')),
          button('Quit to menu', () => game.ui.confirm('Quit the race? Progress in this race will be lost.', () => game.quitToMenu(), 'Quit'), 'danger'),
          h('div', { class: 'label', style: 'margin-top:8px' }, 'ESC to resume'),
        ),
      ),
    );
  }
}
