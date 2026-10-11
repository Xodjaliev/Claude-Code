import { getCarDefinition, PAINT_SWATCHES, RIM_SWATCHES, STAT_KEYS, STAT_LABELS } from '../../car/CarCatalog';
import {
  BODYKIT_OPTIONS,
  DECAL_OPTIONS,
  effectiveStats,
  FINISH_OPTIONS,
  performanceIndex,
  RIM_OPTIONS,
  SPOILER_OPTIONS,
  STAT_PER_LEVEL,
  UNDERGLOW_OPTIONS,
  UPGRADE_MAX_LEVEL,
  UPGRADE_NAMES,
  upgradeCost,
  VisualPartOption,
} from '../../car/Upgrades';
import type { Game } from '../../game/Game';
import { formatNumber } from '../../utils/format';
import { button, clear, h, slider, statBar } from '../dom';
import type { Screen } from '../UIManager';
import { profileBar } from './MainMenuScreen';

type Tab = 'paint' | 'performance' | 'visual';

/** Garage: paint, performance upgrades and visual parts for the selected car. */
export class GarageScreen implements Screen {
  readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly game: Game;
  private tab: Tab = 'paint';
  private readonly title: HTMLElement;

  constructor(game: Game) {
    this.game = game;
    this.panel = h('div', { class: 'panel side-panel right' });
    this.title = h('div', { class: 'title screen-title' }, '');
    this.root = h('div', { class: 'screen' }, this.title, this.panel, profileBar(game).el, button('◀ Back', () => game.ui.show('menu'), 'back-btn'));
    // hide the profile chip on the right where the panel lives
    (this.root.querySelector('.profile-bar') as HTMLElement).style.display = 'none';
  }

  onShow(): void {
    this.game.refreshShowroomCar();
    this.render();
  }

  private get carId(): string {
    return this.game.save.profile.selectedCar;
  }

  private render(): void {
    const game = this.game;
    const def = getCarDefinition(this.carId);
    const cfg = game.save.carConfig(def.id);
    clear(this.title);
    this.title.append(h('small', null, 'GARAGE'), def.name);
    clear(this.panel);
    const coins = h('span', { class: 'chip coin', style: 'font-size:16px' }, formatNumber(game.save.profile.coins));
    this.panel.appendChild(
      h(
        'div',
        { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' },
        h('span', { class: 'label' }, `PI ${performanceIndex(effectiveStats(def, cfg.upgrades))} · CLASS ${def.carClass}`),
        coins,
      ),
    );
    const tabs = h('div', { class: 'tabs' });
    (['paint', 'performance', 'visual'] as Tab[]).forEach((t) =>
      tabs.appendChild(
        h(
          'button',
          {
            class: `tab ${this.tab === t ? 'active' : ''}`,
            onClick: () => {
              this.tab = t;
              this.render();
            },
          },
          t === 'paint' ? 'Paint' : t === 'performance' ? 'Performance' : 'Visual',
        ),
      ),
    );
    this.panel.appendChild(tabs);
    if (this.tab === 'paint') this.renderPaint();
    else if (this.tab === 'performance') this.renderPerformance();
    else this.renderVisual();
  }

  private savePaint(fn: (c: ReturnType<Game['save']['carConfig']>) => void): void {
    const id = this.carId;
    this.game.save.update((p) => fn(p.carConfigs[id]));
    this.game.showroom.updatePaint(this.game.save.carConfig(id));
  }

  private swatchGrid(colors: string[], current: string, onPick: (c: string) => void): HTMLElement {
    const grid = h('div', { class: 'swatches' });
    for (const c of colors) {
      grid.appendChild(
        h('div', {
          class: `swatch ${c.toLowerCase() === current.toLowerCase() ? 'active' : ''}`,
          style: `background:${c}`,
          onClick: () => {
            onPick(c);
            this.render();
          },
        }),
      );
    }
    return grid;
  }

  private renderPaint(): void {
    const cfg = this.game.save.carConfig(this.carId);
    const p = this.panel;
    p.appendChild(h('div', { class: 'label section-head' }, 'BODY COLOUR'));
    p.appendChild(this.swatchGrid(PAINT_SWATCHES, cfg.color, (c) => this.savePaint((x) => (x.color = c))));
    const custom = h('input', { type: 'color' }) as HTMLInputElement;
    custom.value = cfg.color;
    custom.addEventListener('input', () => this.savePaint((x) => (x.color = custom.value)));
    p.appendChild(h('div', { class: 'setting-row', style: 'border:0' }, h('span', null, 'Custom colour'), h('div', { class: 'ctl' }, custom)));
    p.appendChild(h('div', { class: 'label section-head' }, 'FINISH'));
    const fin = h('div', { class: 'option-grid' });
    for (const f of FINISH_OPTIONS) {
      fin.appendChild(
        h(
          'button',
          {
            class: `option ${cfg.finish === f.value ? 'active' : ''}`,
            onClick: () => {
              this.savePaint((x) => (x.finish = f.value));
              this.render();
            },
          },
          f.label,
        ),
      );
    }
    p.appendChild(fin);
    p.appendChild(h('div', { class: 'label section-head' }, 'RIM COLOUR'));
    p.appendChild(this.swatchGrid(RIM_SWATCHES, cfg.rimColor, (c) => this.savePaint((x) => (x.rimColor = c))));
    p.appendChild(h('div', { class: 'label section-head' }, 'ACCENT / LIVERY COLOUR'));
    p.appendChild(
      this.swatchGrid(['#111111', '#f2f2f2', '#d0021b', '#ffcc00', '#00c8d7', '#1f7bff', '#ff2bd6', '#8fdc00'], cfg.accentColor, (c) => {
        this.game.save.update((pp) => (pp.carConfigs[this.carId].accentColor = c));
        this.game.refreshShowroomCar();
      }),
    );
    p.appendChild(
      h(
        'div',
        { class: 'setting-row' },
        h('span', null, 'Window tint'),
        h(
          'div',
          { class: 'ctl' },
          slider(cfg.visual.tint, 0, 1, 0.05, (v) => {
            this.game.save.update((pp) => (pp.carConfigs[this.carId].visual.tint = v));
          }),
        ),
      ),
    );
    const tintApply = () => this.game.refreshShowroomCar();
    p.querySelector('input[type=range]')?.addEventListener('change', tintApply);
    const num = h('input', { type: 'text', maxlength: '2', style: 'width:60px;text-align:center' }) as HTMLInputElement;
    num.value = String(cfg.raceNumber);
    num.addEventListener('change', () => {
      const n = Math.max(1, Math.min(99, parseInt(num.value, 10) || 1));
      num.value = String(n);
      this.game.save.update((pp) => (pp.carConfigs[this.carId].raceNumber = n));
      this.game.refreshShowroomCar();
    });
    p.appendChild(h('div', { class: 'setting-row' }, h('span', null, 'Race number'), h('div', { class: 'ctl' }, num)));
  }

  private renderPerformance(): void {
    const game = this.game;
    const def = getCarDefinition(this.carId);
    const cfg = game.save.carConfig(def.id);
    const p = this.panel;
    for (const k of STAT_KEYS) {
      const lvl = cfg.upgrades[k];
      p.appendChild(
        h('div', { class: 'stat-row' }, h('span', null, STAT_LABELS[k]), statBar(def.stats[k], lvl * STAT_PER_LEVEL), h('span', null, (def.stats[k] + lvl * STAT_PER_LEVEL).toFixed(1))),
      );
    }
    p.appendChild(h('div', { class: 'label section-head' }, 'UPGRADES'));
    for (const k of STAT_KEYS) {
      const lvl = cfg.upgrades[k];
      const pips = h('div', { class: 'upgrade-pips' });
      for (let i = 0; i < UPGRADE_MAX_LEVEL; i++) pips.appendChild(h('i', { class: i < lvl ? 'on' : '' }));
      const maxed = lvl >= UPGRADE_MAX_LEVEL;
      const cost = upgradeCost(def, lvl);
      const btn = button(
        maxed ? 'MAX' : [h('span', { class: 'coin' }, formatNumber(cost))],
        () => {
          const r = game.progression.upgrade(def.id, k);
          if (r.ok) {
            game.audio.play('sfx_purchase', { volume: 0.6 });
            game.ui.toast(`${UPGRADE_NAMES[k]} → level ${lvl + 1}`, 'ok');
          } else {
            game.audio.play('sfx_error', { volume: 0.5 });
            game.ui.toast(r.reason, 'err');
          }
          this.render();
        },
        maxed ? 'small' : 'small gold',
      );
      btn.disabled = maxed;
      p.appendChild(
        h(
          'div',
          { class: 'upgrade-row' },
          h('div', null, h('div', { class: 'name' }, UPGRADE_NAMES[k]), h('div', { class: 'label', style: 'font-size:11px' }, `${STAT_LABELS[k]} +${STAT_PER_LEVEL} per level`), pips),
          btn,
        ),
      );
    }
  }

  private partSection<T extends string | null>(title: string, category: 'spoiler' | 'rims' | 'bodyKit' | 'decal' | 'underglow', options: VisualPartOption<T>[], current: T): void {
    const game = this.game;
    const p = this.panel;
    p.appendChild(h('div', { class: 'label section-head' }, title));
    const grid = h('div', { class: 'option-grid' });
    for (const o of options) {
      const owned = game.progression.ownsPart(this.carId, category, o.value) || o.price === 0;
      const active = o.value === current;
      grid.appendChild(
        h(
          'button',
          {
            class: `option ${active ? 'active' : ''} ${owned ? '' : 'locked'}`,
            onClick: () => {
              if (active) return;
              const r = game.progression.equipPart(this.carId, category, o.value, o.price);
              if (!r.ok) {
                game.audio.play('sfx_error', { volume: 0.5 });
                game.ui.toast(r.reason, 'err');
                return;
              }
              if (!owned) {
                game.audio.play('sfx_purchase', { volume: 0.6 });
                game.ui.toast(`Installed ${o.label}`, 'ok');
              }
              game.refreshShowroomCar();
              this.render();
            },
          },
          category === 'underglow' && o.value ? h('span', { style: `color:${o.value}` }, '● ') : null,
          o.label,
          h('small', null, active ? 'Equipped' : owned ? 'Owned' : `${formatNumber(o.price)} ¢`),
        ),
      );
    }
    p.appendChild(grid);
  }

  private renderVisual(): void {
    const v = this.game.save.carConfig(this.carId).visual;
    this.partSection('SPOILER', 'spoiler', SPOILER_OPTIONS, v.spoiler);
    this.partSection('RIMS', 'rims', RIM_OPTIONS, v.rims);
    this.partSection('BODY KIT', 'bodyKit', BODYKIT_OPTIONS, v.bodyKit);
    this.partSection('DECALS', 'decal', DECAL_OPTIONS, v.decal);
    this.partSection('UNDERGLOW', 'underglow', UNDERGLOW_OPTIONS, v.underglow);
  }
}
