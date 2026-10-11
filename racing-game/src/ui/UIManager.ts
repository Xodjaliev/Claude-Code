import type { Game, RaceOutcome } from '../game/Game';
import type { RaceSession } from '../game/RaceSession';
import type { GameSettings } from '../game/Settings';
import type { ShowroomFraming } from '../game/Showroom';
import { button, h } from './dom';
import { HUD } from './HUD';
import { CarsScreen } from './screens/CarsScreen';
import { GarageScreen } from './screens/GarageScreen';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { PauseScreen } from './screens/PauseScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TracksScreen } from './screens/TracksScreen';
import { TouchControls } from './TouchControls';

export type ScreenId = 'menu' | 'play' | 'garage' | 'cars' | 'tracks' | 'settings' | 'hud' | 'pause' | 'results';

export interface Screen {
  readonly root: HTMLElement;
  onShow?(): void;
  onHide?(): void;
  update?(dt: number): void;
}

const FRAMINGS: Partial<Record<ScreenId, ShowroomFraming>> = {
  menu: 'menu',
  play: 'play',
  garage: 'garage',
  cars: 'cars',
  tracks: 'tracks',
  settings: 'settings',
};

const TIPS = [
  'Tap the handbrake (Space) while turning to start a drift — drifting refills your nitro faster.',
  'Nitro is strongest on long straights. Save it for the exit of a corner.',
  'Press C to switch between chase, hood and cockpit cameras.',
  'Stuck against a wall? Press R to reset your car onto the track.',
  'Upgrade your car in the Garage — every level adds real performance.',
  'Clean races (few wall hits) earn bonus coins.',
  'Win races to gain XP and unlock new cars and tracks.',
];

export class UIManager {
  readonly root: HTMLElement;
  current: ScreenId = 'menu';
  readonly hud: HUD;
  readonly touch: TouchControls;
  private readonly game: Game;
  private readonly screens: Record<Exclude<ScreenId, 'hud'>, Screen>;
  private readonly hudScreen: HTMLElement;
  private readonly loadingEl: HTMLElement;
  private readonly loadingBar: HTMLElement;
  private readonly loadingLabel: HTMLElement;
  private readonly loadingTitle: HTMLElement;
  private readonly loadingSub: HTMLElement;
  private readonly loadingTip: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly fpsEl: HTMLElement;
  private readonly results: ResultsScreen;
  private settingsFrom: ScreenId = 'menu';
  private titleOverlay: HTMLElement | null = null;

  constructor(game: Game) {
    this.game = game;
    this.root = h('div', { id: 'ui' });
    game.root.appendChild(this.root);

    this.hud = new HUD(() => game.pauseRace());
    this.hudScreen = h('div', { class: 'screen', style: 'pointer-events:none' }, this.hud.root);
    this.touch = new TouchControls(game.input);
    this.results = new ResultsScreen(game);
    this.screens = {
      menu: new MainMenuScreen(game),
      play: new PlayScreen(game),
      garage: new GarageScreen(game),
      cars: new CarsScreen(game),
      tracks: new TracksScreen(game),
      settings: new SettingsScreen(game),
      pause: new PauseScreen(game),
      results: this.results,
    };
    this.root.appendChild(this.hudScreen);
    this.root.appendChild(this.touch.root);
    for (const s of Object.values(this.screens)) this.root.appendChild(s.root);

    this.loadingBar = h('div');
    this.loadingLabel = h('div', { class: 'label' }, 'Loading');
    this.loadingTitle = h('div', { class: 'title track-name' }, '');
    this.loadingSub = h('div', { class: 'label', style: 'margin-top:6px;color:var(--accent)' }, '');
    this.loadingTip = h('div', { class: 'tip' }, '');
    this.loadingEl = h(
      'div',
      { class: 'loading' },
      h('div', { class: 'inner' }, this.loadingSub, this.loadingTitle, h('div', { class: 'bar' }, this.loadingBar), this.loadingLabel, this.loadingTip),
    );
    this.toasts = h('div', { class: 'toasts' });
    this.fpsEl = h('div', { class: 'fps' }, '0 FPS');
    this.root.append(this.loadingEl, this.toasts, this.fpsEl);

    // click / hover sounds for every button
    this.root.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('button, .swatch, .option, .car-card, .track-card');
      if (t && !(t as HTMLButtonElement).disabled) game.audio.play('sfx_click', { volume: 0.5 });
    });
    this.root.addEventListener('pointerover', (e) => {
      const t = (e.target as HTMLElement).closest('.menu-item');
      if (t && (e as PointerEvent).pointerType === 'mouse') game.audio.play('sfx_hover', { volume: 0.4 });
    });

    this.showTitle();
    this.show('menu');
  }

  private showTitle(): void {
    const overlay = h(
      'div',
      { class: 'start-overlay' },
      h(
        'div',
        { class: 'inner' },
        h('div', { class: 'title t1' }, 'VELOCITY RUSH'),
        h('div', { class: 'label', style: 'letter-spacing:0.5em;margin-top:10px' }, 'ARCADE STREET RACING'),
        h('div', { class: 'press' }, this.game.settings.touchEnabled ? 'TAP TO START' : 'CLICK OR PRESS ANY KEY'),
      ),
    );
    const go = () => {
      if (!this.titleOverlay) return;
      this.game.audio.unlock();
      this.game.audio.playMusic('menu');
      this.titleOverlay.remove();
      this.titleOverlay = null;
      window.removeEventListener('keydown', go);
    };
    overlay.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
    this.titleOverlay = overlay;
    this.root.appendChild(overlay);
  }

  show(id: ScreenId): void {
    if (id === 'settings' && this.current !== 'settings') this.settingsFrom = this.current;
    const prev = this.current;
    if (prev !== 'hud' && this.screens[prev as Exclude<ScreenId, 'hud'>]) {
      const s = this.screens[prev as Exclude<ScreenId, 'hud'>];
      if (prev !== id) s.onHide?.();
      s.root.classList.remove('visible');
    }
    this.current = id;
    const inRace = this.game.state === 'race';
    this.hudScreen.classList.toggle('visible', inRace && (id === 'hud' || id === 'pause' || id === 'results' || id === 'settings'));
    this.touch.show(inRace && id === 'hud' && this.game.settings.touchEnabled);
    if (id !== 'hud') {
      const s = this.screens[id];
      s.root.classList.add('visible');
      s.onShow?.();
    }
    const f = FRAMINGS[id];
    if (f && !inRace) this.game.showroom.setFraming(f);
  }

  back(): void {
    switch (this.current) {
      case 'settings':
        this.show(this.settingsFrom === 'settings' ? 'menu' : this.settingsFrom);
        break;
      case 'play':
      case 'garage':
      case 'cars':
      case 'tracks':
        this.show('menu');
        break;
      case 'pause':
        this.game.resumeRace();
        break;
      default:
        break;
    }
  }

  enterRace(race: RaceSession): void {
    this.hideLoading();
    this.hud.attach(race);
    this.show('hud');
  }

  exitRace(): void {
    this.hud.detach();
    this.hideLoading();
    this.show('menu');
  }

  showResults(outcome: RaceOutcome): void {
    this.results.setOutcome(outcome);
    this.show('results');
  }

  showLoading(title: string, sub: string): void {
    this.loadingTitle.textContent = title;
    this.loadingSub.textContent = sub;
    this.loadingTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.setLoading(0, 'Loading');
    this.loadingEl.classList.add('visible');
  }

  setLoading(p: number, label: string): void {
    this.loadingBar.style.width = `${Math.round(p * 100)}%`;
    this.loadingLabel.textContent = label;
  }

  hideLoading(): void {
    this.loadingEl.classList.remove('visible');
  }

  toast(text: string, kind: 'ok' | 'err' | '' = ''): void {
    const el = h('div', { class: `toast ${kind}` }, text);
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  confirm(text: string, onYes: () => void, yesLabel = 'Confirm'): void {
    const overlay = h('div', { class: 'overlay', style: 'z-index:80;pointer-events:auto' });
    const close = () => overlay.remove();
    overlay.appendChild(
      h(
        'div',
        { class: 'panel confirm-box' },
        h('div', { style: 'font-size:18px;font-weight:700;line-height:1.4' }, text),
        h(
          'div',
          { class: 'row' },
          button('Cancel', close),
          button(
            yesLabel,
            () => {
              close();
              onYes();
            },
            'danger',
          ),
        ),
      ),
    );
    this.root.appendChild(overlay);
  }

  applySettings(s: Readonly<GameSettings>): void {
    this.fpsEl.style.display = s.showFps ? 'block' : 'none';
    this.touch.setMode(s.touchSteering);
    document.body.classList.toggle('touch-mode', this.game.settings.touchEnabled);
    if (this.game.state === 'race') this.touch.show(this.current === 'hud' && this.game.settings.touchEnabled);
  }

  update(dt: number): void {
    if (this.game.state === 'race') this.hud.update(this.game.settings.value);
    if (this.game.settings.value.showFps) this.fpsEl.textContent = `${this.game.fps} FPS`;
    if (this.current !== 'hud') this.screens[this.current].update?.(dt);
  }
}
