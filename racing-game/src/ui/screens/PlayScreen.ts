import { getCarDefinition } from '../../car/CarCatalog';
import { effectiveStats, performanceIndex } from '../../car/Upgrades';
import type { Game } from '../../game/Game';
import type { Difficulty, GameModeId } from '../../game/SaveManager';
import { TIME_OF_DAY_LABELS, TimeOfDay } from '../../tracks/Atmosphere';
import { TRACK_CATALOG } from '../../tracks/TrackCatalog';
import { button, clear, h, segmented } from '../dom';
import type { Screen } from '../UIManager';

/** Race setup: track, mode, laps, opponents, difficulty, time of day. */
export class PlayScreen implements Screen {
  readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
    this.panel = h('div', { class: 'panel setup-panel' });
    this.root = h(
      'div',
      { class: 'screen' },
      h('div', { class: 'title screen-title' }, h('small', null, 'QUICK RACE'), 'RACE SETUP'),
      this.panel,
      button('◀ Back', () => game.ui.show('menu'), 'back-btn'),
      button('Start Race ▶', () => void game.startRace(), 'primary start-btn'),
    );
  }

  onShow(): void {
    this.render();
  }

  private render(): void {
    const game = this.game;
    const setup = game.save.profile.setup;
    const set = (patch: Partial<typeof setup>) => {
      game.save.update((p) => Object.assign(p.setup, patch));
      this.render();
    };
    clear(this.panel);
    // tracks
    this.panel.appendChild(h('div', { class: 'label section-head', style: 'margin-top:0' }, 'TRACK'));
    const grid = h('div', { class: 'option-grid' });
    for (const t of TRACK_CATALOG) {
      const unlocked = game.progression.isTrackUnlocked(t.id);
      const el = h(
        'button',
        {
          class: `option ${setup.trackId === t.id ? 'active' : ''} ${unlocked ? '' : 'locked'}`,
          onClick: () => {
            if (!unlocked) {
              game.ui.toast(`Locked — reach level ${t.unlockLevel} or unlock it in TRACKS`, 'err');
              return;
            }
            set({ trackId: t.id, laps: setup.trackId === t.id ? setup.laps : t.laps });
          },
        },
        t.name,
        h('small', null, unlocked ? `${t.difficulty} · ${t.theme}` : `🔒 Level ${t.unlockLevel}`),
      );
      grid.appendChild(el);
    }
    this.panel.appendChild(grid);

    const row = (label: string, ctl: HTMLElement) => h('div', { class: 'setting-row' }, h('span', null, label), h('div', { class: 'ctl' }, ctl));
    this.panel.appendChild(
      row(
        'Mode',
        segmented<GameModeId>(
          [
            { value: 'race', label: 'Race' },
            { value: 'timeTrial', label: 'Time Trial' },
          ],
          setup.mode,
          (v) => set({ mode: v }),
        ),
      ),
    );
    this.panel.appendChild(row('Laps', segmented([1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })), setup.laps, (v) => set({ laps: v }))));
    if (setup.mode === 'race') {
      this.panel.appendChild(
        row('Opponents', segmented([1, 3, 5, 7].map((n) => ({ value: n, label: String(n) })), [1, 3, 5, 7].includes(setup.opponents) ? setup.opponents : 7, (v) => set({ opponents: v }))),
      );
      this.panel.appendChild(
        row(
          'Difficulty',
          segmented<Difficulty>(
            [
              { value: 'easy', label: 'Easy' },
              { value: 'normal', label: 'Normal' },
              { value: 'hard', label: 'Hard' },
            ],
            setup.difficulty,
            (v) => set({ difficulty: v }),
          ),
        ),
      );
    }
    const tods: (TimeOfDay | 'auto')[] = ['auto', 'morning', 'day', 'sunset', 'night'];
    this.panel.appendChild(
      row('Time of day', segmented(tods.map((v) => ({ value: v, label: v === 'auto' ? 'Auto' : TIME_OF_DAY_LABELS[v] })), setup.timeOfDay, (v) => set({ timeOfDay: v }))),
    );
    const def = getCarDefinition(game.save.profile.selectedCar);
    const cfg = game.save.carConfig(def.id);
    this.panel.appendChild(
      h(
        'div',
        { class: 'setting-row', style: 'border:0' },
        h('span', null, 'Car'),
        h('div', { class: 'ctl' }, h('span', { class: 'chip' }, `${def.name} · PI ${performanceIndex(effectiveStats(def, cfg.upgrades))}`), button('Change', () => game.ui.show('cars'), 'small')),
      ),
    );
  }
}
