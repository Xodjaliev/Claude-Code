import type { Game, RaceOutcome } from '../../game/Game';
import { getTrackDefinition } from '../../tracks/TrackCatalog';
import { formatNumber, formatTime, ordinal } from '../../utils/format';
import { button, clear, h } from '../dom';
import type { Screen } from '../UIManager';

/** RACE FINISHED screen: position, time, best lap, rewards, standings, CONTINUE. */
export class ResultsScreen implements Screen {
  readonly root: HTMLElement;
  private readonly box: HTMLElement;
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
    this.box = h('div', { class: 'panel results-box' });
    this.root = h('div', { class: 'screen' }, h('div', { class: 'overlay' }, this.box));
  }

  setOutcome(o: RaceOutcome): void {
    const game = this.game;
    const r = o.results;
    const tt = r.config.mode === 'timeTrial';
    clear(this.box);
    this.box.appendChild(
      h(
        'div',
        { class: 'head' },
        h('div', { class: 'label', style: 'color:var(--accent)' }, `${getTrackDefinition(r.config.trackId).name.toUpperCase()} · ${r.config.laps} LAPS · ${tt ? 'TIME TRIAL' : r.config.difficulty.toUpperCase()}`),
        h('div', { class: 'title' }, 'RACE FINISHED'),
      ),
    );
    const left = h('div');
    left.appendChild(
      h(
        'div',
        { class: 'result-big' },
        h('div', { class: 'cell pos' }, h('span', { class: 'label' }, 'POSITION'), h('b', null, tt ? '—' : ordinal(r.position)), tt ? null : h('span', { class: 'label' }, `OF ${r.racers}`)),
        h('div', { class: 'cell' }, h('span', { class: 'label' }, 'TIME'), h('b', null, formatTime(r.totalTime)), o.newBestRace ? h('span', { class: 'label', style: 'color:var(--ok)' }, 'PERSONAL BEST') : null),
        h('div', { class: 'cell' }, h('span', { class: 'label' }, 'BEST LAP'), h('b', null, formatTime(r.bestLap)), o.newBestLap ? h('span', { class: 'label', style: 'color:var(--ok)' }, 'LAP RECORD') : null),
        h('div', { class: 'cell' }, h('span', { class: 'label' }, 'TOP SPEED'), h('b', null, `${Math.round(r.topSpeedKmh)}`), h('span', { class: 'label' }, 'KM/H')),
      ),
    );
    const rewards = h('div', { class: 'rewards' }, h('div', { class: 'label' }, 'REWARDS'));
    for (const l of o.rewards.lines)
      rewards.appendChild(h('div', { class: 'reward-line' }, h('span', null, l.label), h('span', null, h('span', { class: 'coin' }, `+${formatNumber(l.coins)}`), `  +${l.xp} XP`)));
    rewards.appendChild(h('div', { class: 'reward-total' }, h('span', null, 'REWARDS'), h('span', { class: 'coin' }, `+${formatNumber(o.rewards.coins)}`)));
    rewards.appendChild(h('div', { class: 'label', style: 'text-align:right;color:var(--accent)' }, `+${formatNumber(o.rewards.xp)} XP`));
    if (o.levelUp) {
      const extra = [...o.unlockedTracks.map((t) => `Track: ${t}`), ...o.unlockedCars.map((c) => `Car available: ${c}`)];
      rewards.appendChild(h('div', { class: 'levelup' }, `LEVEL UP! You are now level ${o.level}`, extra.length ? h('div', { class: 'label', style: 'margin-top:4px;color:#d9ffe9' }, extra.join(' · ')) : null));
    }
    left.appendChild(rewards);
    this.box.appendChild(left);

    const right = h('div');
    right.appendChild(h('div', { class: 'label', style: 'margin-bottom:6px' }, tt ? 'LAP TIMES' : 'STANDINGS'));
    const table = h('table', { class: 'standings' });
    if (tt) {
      r.lapTimes.forEach((t, i) => table.appendChild(h('tr', { class: t === r.bestLap ? 'me' : '' }, h('td', null, `LAP ${i + 1}`), h('td', { class: 't' }, formatTime(t)))));
    } else {
      for (const row of r.standings) {
        table.appendChild(
          h(
            'tr',
            { class: row.isPlayer ? 'me' : '' },
            h('td', null, `${row.position}.`),
            h('td', null, row.name),
            h('td', { style: 'color:var(--muted)' }, row.carName),
            h('td', { class: 't' }, row.time === null ? 'DNF' : `${formatTime(row.time)}${row.estimated ? '*' : ''}`),
          ),
        );
      }
    }
    right.appendChild(table);
    if (!tt && r.standings.some((s) => s.estimated)) right.appendChild(h('div', { class: 'label', style: 'margin-top:6px;font-size:10px' }, '* projected finish time'));
    right.appendChild(h('div', { class: 'label', style: 'margin-top:14px' }, `DRIFT SCORE ${formatNumber(r.driftScore)} · WALL HITS ${r.wallHits}`));
    this.box.appendChild(right);

    this.box.appendChild(
      h(
        'div',
        { class: 'results-actions' },
        button('Race again', () => game.restartRace()),
        button('Continue ▶', () => game.quitToMenu(), 'primary'),
      ),
    );
  }
}
