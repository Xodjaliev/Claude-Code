import { getCarDefinition } from '../../car/CarCatalog';
import type { Game } from '../../game/Game';
import { Track } from '../../tracks/Track';
import { TIME_OF_DAY_LABELS } from '../../tracks/Atmosphere';
import { TRACK_CATALOG, TrackDefinition } from '../../tracks/TrackCatalog';
import { formatNumber, formatTime } from '../../utils/format';
import { button, clear, h } from '../dom';
import { drawTrackOutline } from '../Minimap';
import type { Screen } from '../UIManager';

/** Circuit selection with map previews, personal bests and unlocks. */
export class TracksScreen implements Screen {
  readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly game: Game;
  private readonly previews = new Map<string, HTMLCanvasElement>();
  private readonly tracks = new Map<string, Track>();
  private viewing: string;

  constructor(game: Game) {
    this.game = game;
    this.viewing = game.save.profile.setup.trackId;
    this.list = h('div', { class: 'track-list' });
    this.detail = h('div', { class: 'panel side-panel right' });
    this.root = h(
      'div',
      { class: 'screen' },
      h('div', { class: 'title screen-title' }, h('small', null, 'CHAMPIONSHIP'), 'TRACKS'),
      h('div', { class: 'panel side-panel left' }, this.list),
      this.detail,
      button('◀ Back', () => game.ui.show('menu'), 'back-btn'),
    );
  }

  private track(def: TrackDefinition): Track {
    let t = this.tracks.get(def.id);
    if (!t) {
      t = new Track(def);
      this.tracks.set(def.id, t);
    }
    return t;
  }

  private preview(def: TrackDefinition, size: number): HTMLCanvasElement {
    const key = `${def.id}-${size}`;
    let c = this.previews.get(key);
    if (!c) {
      c = drawTrackOutline(this.track(def), size, def.accent, 10);
      this.previews.set(key, c);
    }
    const copy = document.createElement('canvas');
    copy.width = c.width;
    copy.height = c.height;
    copy.getContext('2d')!.drawImage(c, 0, 0);
    return copy;
  }

  onShow(): void {
    this.viewing = this.game.save.profile.setup.trackId;
    this.render();
  }

  private render(): void {
    const game = this.game;
    clear(this.list);
    for (const def of TRACK_CATALOG) {
      const unlocked = game.progression.isTrackUnlocked(def.id);
      const t = this.track(def);
      const pb = game.leaderboard.personalBest(def.id);
      this.list.appendChild(
        h(
          'button',
          {
            class: `track-card ${this.viewing === def.id ? 'active' : ''}`,
            onClick: () => {
              this.viewing = def.id;
              game.showroom.setAccent(def.accent);
              this.render();
            },
          },
          this.preview(def, 240),
          h(
            'div',
            null,
            h('div', { class: 'tc-name' }, def.name),
            h('div', { class: 'tc-loc' }, def.location),
            h(
              'div',
              { class: 'tc-meta' },
              h('span', { class: 'chip' }, `${(t.length / 1000).toFixed(2)} KM`),
              h('span', { class: 'chip' }, def.difficulty),
              h('span', { class: 'chip' }, TIME_OF_DAY_LABELS[def.timeOfDay]),
            ),
            unlocked
              ? h('div', { class: 'label', style: 'margin-top:8px' }, `BEST LAP ${formatTime(pb.lap)}`)
              : h('div', { class: 'lock-note' }, `🔒 Level ${def.unlockLevel} or ${formatNumber(def.unlockCost)} coins`),
          ),
        ),
      );
    }
    this.renderDetail();
  }

  private async renderDetail(): Promise<void> {
    const game = this.game;
    const def = TRACK_CATALOG.find((t) => t.id === this.viewing) ?? TRACK_CATALOG[0];
    const unlocked = game.progression.isTrackUnlocked(def.id);
    const t = this.track(def);
    const d = this.detail;
    clear(d);
    const big = this.preview(def, 360);
    big.style.cssText = 'width:100%;max-width:300px;display:block;margin:0 auto 10px;border-radius:12px;background:rgba(0,0,0,.35)';
    d.appendChild(h('div', { class: 'label' }, def.location));
    d.appendChild(h('div', { class: 'title', style: 'font-size:30px;margin-bottom:10px' }, def.name));
    d.appendChild(big);
    d.appendChild(h('div', { class: 'desc' }, def.description));
    const tunnels = t.samples.filter((s) => s.tunnel).length * t.spacing;
    d.appendChild(
      h(
        'div',
        { class: 'tc-meta', style: 'display:flex;gap:6px;flex-wrap:wrap' },
        h('span', { class: 'chip' }, `LENGTH ${(t.length / 1000).toFixed(2)} KM`),
        h('span', { class: 'chip' }, `${def.laps} LAPS`),
        h('span', { class: 'chip' }, `${def.checkpointCount} CHECKPOINTS`),
        tunnels > 0 ? h('span', { class: 'chip' }, `TUNNELS ${Math.round(tunnels)} M`) : null,
        h('span', { class: 'chip' }, `ELEV ${Math.round(t.bounds.maxY - t.bounds.minY)} M`),
        h('span', { class: 'chip coin' }, `×${def.rewardMultiplier} REWARDS`),
      ),
    );
    const actions = h('div', { style: 'display:flex;gap:10px;margin:16px 0;flex-wrap:wrap' });
    if (unlocked) {
      actions.appendChild(
        button('Race here ▶', () => {
          game.save.update((p) => {
            if (p.setup.trackId !== def.id) p.setup.laps = def.laps;
            p.setup.trackId = def.id;
          });
          game.ui.show('play');
        }, 'primary'),
      );
    } else {
      const canLevel = game.progression.level >= def.unlockLevel;
      actions.appendChild(
        button([h('span', null, 'Unlock  '), h('span', { class: 'coin' }, formatNumber(def.unlockCost))], () => {
          const r = game.progression.unlockTrack(def.id);
          if (r.ok) {
            game.audio.play('sfx_purchase', { volume: 0.7 });
            game.ui.toast(`${def.name} unlocked!`, 'ok');
          } else {
            game.audio.play('sfx_error', { volume: 0.5 });
            game.ui.toast(r.reason, 'err');
          }
          this.render();
        }, 'gold'),
      );
      if (!canLevel) actions.appendChild(h('div', { class: 'lock-note' }, `or reach level ${def.unlockLevel}`));
    }
    d.appendChild(actions);
    // local leaderboard
    d.appendChild(h('div', { class: 'label section-head' }, 'TOP LAP TIMES (THIS DEVICE)'));
    const top = await game.leaderboard.top(def.id, 'lap', 5);
    const table = h('table', { class: 'standings' });
    if (!top.length) table.appendChild(h('tr', null, h('td', { style: 'color:var(--muted)' }, 'No times yet — be the first!')));
    top.forEach((e, i) =>
      table.appendChild(h('tr', null, h('td', null, `${i + 1}.`), h('td', null, e.name), h('td', { style: 'color:var(--muted)' }, getCarDefinition(e.carId).name), h('td', { class: 't' }, formatTime(e.bestLap)))),
    );
    d.appendChild(table);
  }
}
