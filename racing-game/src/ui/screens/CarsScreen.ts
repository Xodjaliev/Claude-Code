import { CAR_CATALOG, CarDefinition, STAT_KEYS, STAT_LABELS } from '../../car/CarCatalog';
import { defaultCarConfig, effectiveStats, performanceIndex, STAT_PER_LEVEL } from '../../car/Upgrades';
import type { Game } from '../../game/Game';
import { computeVehicleSpecs } from '../../physics/VehicleSpecs';
import { formatNumber } from '../../utils/format';
import { button, clear, h, statBar } from '../dom';
import type { Screen } from '../UIManager';
import { profileBar } from './MainMenuScreen';

/** Dealership: browse, buy and select cars. */
export class CarsScreen implements Screen {
  readonly root: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly game: Game;
  private viewing: string;

  constructor(game: Game) {
    this.game = game;
    this.viewing = game.save.profile.selectedCar;
    this.strip = h('div', { class: 'card-strip' });
    this.panel = h('div', { class: 'panel side-panel right' });
    const profile = profileBar(game);
    profile.el.style.display = 'none';
    this.root = h('div', { class: 'screen' }, h('div', { class: 'title screen-title' }, h('small', null, 'DEALERSHIP'), 'CARS'), this.strip, this.panel, profile.el, button('◀ Back', () => game.ui.show('menu'), 'back-btn'));
  }

  onShow(): void {
    this.viewing = this.game.save.profile.selectedCar;
    this.preview();
    this.render();
  }

  onHide(): void {
    this.game.refreshShowroomCar();
  }

  private preview(): void {
    const def = CAR_CATALOG.find((c) => c.id === this.viewing)!;
    const owned = this.game.progression.isCarOwned(def.id);
    this.game.showroom.showCar(def, owned ? this.game.save.carConfig(def.id) : defaultCarConfig(def));
  }

  private render(): void {
    const game = this.game;
    clear(this.strip);
    for (const def of CAR_CATALOG) {
      const owned = game.progression.isCarOwned(def.id);
      const selected = game.save.profile.selectedCar === def.id;
      const lock = game.progression.carLockReason(def.id);
      this.strip.appendChild(
        h(
          'button',
          {
            class: `car-card ${this.viewing === def.id ? 'active' : ''}`,
            onClick: () => {
              this.viewing = def.id;
              this.preview();
              this.render();
            },
          },
          h('div', { class: 'label' }, `${def.maker} · ${def.carClass}`),
          h('div', { class: 'cc-name' }, def.name),
          h('div', { class: 'cc-swatch', style: `background:${owned ? game.save.carConfig(def.id).color : def.defaultColor}` }),
          h(
            'div',
            { class: 'cc-state', style: `color:${selected ? 'var(--accent)' : owned ? 'var(--ok)' : lock ? 'var(--muted)' : 'var(--gold)'}` },
            selected ? 'SELECTED' : owned ? 'OWNED' : lock ? `🔒 ${lock}` : `${formatNumber(def.price)} ¢`,
          ),
        ),
      );
    }
    this.renderDetails(CAR_CATALOG.find((c) => c.id === this.viewing)!);
  }

  private renderDetails(def: CarDefinition): void {
    const game = this.game;
    const owned = game.progression.isCarOwned(def.id);
    const cfg = owned ? game.save.carConfig(def.id) : defaultCarConfig(def);
    const stats = effectiveStats(def, cfg.upgrades);
    const specs = computeVehicleSpecs(def, stats);
    const p = this.panel;
    clear(p);
    p.appendChild(
      h(
        'div',
        { class: 'car-header' },
        h('div', { class: 'label' }, def.maker),
        h('div', { class: 'title name' }, def.name),
        h(
          'div',
          { class: 'meta' },
          h('span', { class: 'class-badge' }, def.carClass),
          h('span', { class: 'chip' }, `PI ${performanceIndex(stats)}`),
          h('span', { class: 'chip' }, `${Math.round(specs.topSpeed * 3.6)} KM/H`),
          h('span', { class: 'chip' }, `${def.massKg} KG`),
          h('span', { class: 'chip' }, `${def.engine.cylinders} CYL${def.engine.turbo ? ' TURBO' : ''}`),
        ),
      ),
    );
    p.appendChild(h('div', { class: 'desc' }, def.description));
    for (const k of STAT_KEYS) {
      const bonus = cfg.upgrades[k] * STAT_PER_LEVEL;
      p.appendChild(h('div', { class: 'stat-row' }, h('span', null, STAT_LABELS[k]), statBar(def.stats[k], bonus), h('span', null, (def.stats[k] + bonus).toFixed(1))));
    }
    const actions = h('div', { style: 'display:flex;gap:10px;margin-top:18px;flex-wrap:wrap' });
    const selected = game.save.profile.selectedCar === def.id;
    if (owned) {
      const sel = button(selected ? 'Selected' : 'Select', () => {
        game.progression.selectCar(def.id);
        game.ui.toast(`${def.name} selected`, 'ok');
        this.render();
      }, 'primary');
      sel.disabled = selected;
      actions.appendChild(sel);
      actions.appendChild(button('Garage', () => {
        game.progression.selectCar(def.id);
        game.ui.show('garage');
      }));
    } else {
      const lock = game.progression.carLockReason(def.id);
      const buy = button(lock ? `🔒 ${lock}` : [h('span', null, 'Buy  '), h('span', { class: 'coin' }, formatNumber(def.price))], () => {
        const r = game.progression.buyCar(def.id);
        if (r.ok) {
          game.audio.play('sfx_purchase', { volume: 0.7 });
          game.ui.toast(`Welcome to the garage, ${def.name}!`, 'ok');
          this.preview();
        } else {
          game.audio.play('sfx_error', { volume: 0.5 });
          game.ui.toast(r.reason, 'err');
        }
        this.render();
      }, 'gold');
      buy.disabled = !!lock;
      actions.appendChild(buy);
    }
    p.appendChild(actions);
    p.appendChild(h('div', { class: 'label', style: 'margin-top:16px' }, `Your coins: ${formatNumber(game.save.profile.coins)}`));
  }
}
