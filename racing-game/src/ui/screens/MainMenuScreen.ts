import { getCarDefinition } from '../../car/CarCatalog';
import { effectiveStats, performanceIndex } from '../../car/Upgrades';
import type { Game } from '../../game/Game';
import { getTrackDefinition } from '../../tracks/TrackCatalog';
import { formatNumber } from '../../utils/format';
import { h } from '../dom';
import type { Screen } from '../UIManager';

/** Profile chip (level, XP, coins) reused by several screens. */
export function profileBar(game: Game): { el: HTMLElement; refresh: () => void } {
  const badge = h('div', { class: 'level-badge' }, '1');
  const xpFill = h('div');
  const xpText = h('div', { class: 'label' }, 'XP');
  const coins = h('div', { class: 'coins-big coin' }, '0');
  const el = h(
    'div',
    { class: 'panel profile-bar' },
    badge,
    h('div', { class: 'xp-wrap' }, xpText, h('div', { class: 'xp-bar' }, xpFill)),
    coins,
  );
  const refresh = () => {
    const info = game.levelInfo;
    badge.textContent = String(info.level);
    xpFill.style.width = `${Math.round(info.progress * 100)}%`;
    xpText.textContent = `LEVEL ${info.level} · ${formatNumber(game.save.profile.xp - info.current)} / ${formatNumber(info.next - info.current)} XP`;
    coins.textContent = formatNumber(game.save.profile.coins);
  };
  game.save.on('change', refresh);
  refresh();
  return { el, refresh };
}

export class MainMenuScreen implements Screen {
  readonly root: HTMLElement;
  private readonly items: HTMLButtonElement[] = [];
  private focus = 0;
  private readonly carName: HTMLElement;
  private readonly carMeta: HTMLElement;
  private readonly trackName: HTMLElement;
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
    const ui = () => game.ui;
    const entries: [string, string, () => void, string][] = [
      ['PLAY', 'Race now', () => ui().show('play'), 'play'],
      ['GARAGE', 'Tune & paint', () => ui().show('garage'), ''],
      ['CARS', 'Dealership', () => ui().show('cars'), ''],
      ['TRACKS', 'Circuits', () => ui().show('tracks'), ''],
      ['SETTINGS', 'Options', () => ui().show('settings'), ''],
    ];
    const list = h('div', { class: 'menu-list' });
    entries.forEach(([label, sub, fn, cls], i) => {
      const b = h('button', { class: `btn menu-item ${cls}`, onClick: fn }, h('span', null, label), h('span', { class: 'sub' }, sub));
      b.addEventListener('pointerenter', () => this.setFocus(i));
      this.items.push(b);
      list.appendChild(b);
    });
    this.carName = h('div', { class: 'title car-name' }, '');
    this.carMeta = h('div', { class: 'label' }, '');
    this.trackName = h('div', { class: 'label', style: 'margin-top:8px;color:var(--accent)' }, '');
    const profile = profileBar(game);
    this.root = h(
      'div',
      { class: 'screen' },
      h('div', { class: 'menu-logo' }, h('div', { class: 'title t1' }, 'VELOCITY', h('br'), 'RUSH'), h('div', { class: 't2' }, 'ARCADE STREET RACING')),
      list,
      profile.el,
      h('div', { class: 'panel menu-footer' }, h('div', { class: 'label' }, 'YOUR RIDE'), this.carName, this.carMeta, this.trackName),
      h(
        'div',
        { class: 'menu-hint' },
        h('kbd', null, 'W'), h('kbd', null, 'A'), h('kbd', null, 'S'), h('kbd', null, 'D'), ' drive  ',
        h('kbd', null, 'SPACE'), ' drift  ', h('kbd', null, 'SHIFT'), ' nitro  ', h('kbd', null, 'C'), ' camera  ', h('kbd', null, 'ESC'), ' pause',
      ),
    );
    window.addEventListener('keydown', (e) => {
      if (game.ui?.current !== 'menu' || game.state !== 'menu' || document.querySelector('.start-overlay')) return;
      if (e.code === 'ArrowDown') this.setFocus((this.focus + 1) % this.items.length);
      else if (e.code === 'ArrowUp') this.setFocus((this.focus - 1 + this.items.length) % this.items.length);
      else if (e.code === 'Enter') this.items[this.focus].click();
    });
    game.save.on('change', () => this.refresh());
  }

  private setFocus(i: number): void {
    this.items[this.focus]?.classList.remove('focus');
    this.focus = i;
    this.items[i].classList.add('focus');
  }

  private refresh(): void {
    const p = this.game.save.profile;
    const def = getCarDefinition(p.selectedCar);
    const cfg = this.game.save.carConfig(def.id);
    this.carName.textContent = def.name;
    this.carMeta.textContent = `${def.maker} · CLASS ${def.carClass} · PI ${performanceIndex(effectiveStats(def, cfg.upgrades))}`;
    const t = getTrackDefinition(p.setup.trackId);
    this.trackName.textContent = `NEXT: ${t.name.toUpperCase()} · ${p.setup.laps} LAPS`;
  }

  onShow(): void {
    this.refresh();
    this.setFocus(0);
    this.game.showroom.setAccent('#00e5ff');
  }
}
