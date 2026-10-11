import { CAMERA_LABELS, CAMERA_MODES, CameraMode } from '../../camera/CameraController';
import { GraphicsQuality, QUALITY_LEVELS } from '../../effects/QualityPresets';
import type { Game } from '../../game/Game';
import { ACTION_LABELS, BINDABLE_ACTIONS, BindableAction, DEFAULT_BINDINGS, keyLabel } from '../../game/Input';
import type { GameSettings } from '../../game/Settings';
import { device } from '../../utils/device';
import { button, clear, h, segmented, slider, toggle } from '../dom';
import type { Screen } from '../UIManager';

type Section = 'graphics' | 'audio' | 'controls' | 'camera' | 'game';

/** Graphics, audio, controls (with key rebinding), camera and gameplay options. */
export class SettingsScreen implements Screen {
  readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly game: Game;
  private section: Section = 'graphics';

  constructor(game: Game) {
    this.game = game;
    this.panel = h('div', { class: 'panel settings-panel' });
    this.root = h(
      'div',
      { class: 'screen', style: 'background:rgba(3,4,10,.35)' },
      h('div', { class: 'title screen-title' }, h('small', null, 'OPTIONS'), 'SETTINGS'),
      this.panel,
      button('◀ Back', () => game.ui.back(), 'back-btn'),
    );
  }

  onShow(): void {
    this.render();
  }

  private set(patch: Partial<GameSettings>, rerender = false): void {
    this.game.settings.set(patch);
    if (rerender) this.render();
  }

  private row(label: string, ctl: HTMLElement | HTMLElement[], hint?: string): HTMLElement {
    return h(
      'div',
      { class: 'setting-row' },
      h('div', null, label, hint ? h('div', { class: 'label', style: 'font-size:11px;letter-spacing:.08em;margin-top:2px' }, hint) : null),
      h('div', { class: 'ctl' }, ...(Array.isArray(ctl) ? ctl : [ctl])),
    );
  }

  private render(): void {
    const s = this.game.settings.value;
    const p = this.panel;
    clear(p);
    const tabs = h('div', { class: 'tabs' });
    const names: Record<Section, string> = { graphics: 'Graphics', audio: 'Audio', controls: 'Controls', camera: 'Camera', game: 'Game' };
    (Object.keys(names) as Section[]).forEach((k) =>
      tabs.appendChild(
        h(
          'button',
          {
            class: `tab ${this.section === k ? 'active' : ''}`,
            onClick: () => {
              this.section = k;
              this.render();
            },
          },
          names[k],
        ),
      ),
    );
    p.appendChild(tabs);

    if (this.section === 'graphics') {
      p.appendChild(
        this.row(
          'Graphics quality',
          segmented<GraphicsQuality>(
            QUALITY_LEVELS.map((q) => ({ value: q, label: q[0].toUpperCase() + q.slice(1) })),
            s.graphics,
            (v) => this.set({ graphics: v }),
          ),
          'Scenery density & shadow resolution apply on the next race',
        ),
      );
      p.appendChild(this.row('Motion blur / speed FX', toggle(s.motionBlur, (v) => this.set({ motionBlur: v }))));
      p.appendChild(this.row('FPS counter', toggle(s.showFps, (v) => this.set({ showFps: v }))));
      if (device.supportsFullscreen()) {
        p.appendChild(
          this.row(
            'Fullscreen',
            button(device.isFullscreen() ? 'Exit fullscreen' : 'Enter fullscreen', async () => {
              await device.toggleFullscreen();
              this.render();
            }, 'small'),
          ),
        );
      }
      p.appendChild(
        h(
          'div',
          { class: 'label', style: 'margin-top:14px;line-height:1.6;letter-spacing:.06em' },
          'LOW: no shadows/post-fx · MEDIUM: shadows, bloom, FXAA · HIGH: MSAA, 2K shadows · ULTRA: 4K shadows, ambient occlusion',
        ),
      );
    } else if (this.section === 'audio') {
      const vol = (key: 'masterVolume' | 'sfxVolume' | 'musicVolume') => {
        const val = h('span', { style: 'min-width:40px;text-align:right' }, `${Math.round(s[key] * 100)}%`);
        return [
          slider(s[key], 0, 1, 0.05, (v) => {
            val.textContent = `${Math.round(v * 100)}%`;
            this.set({ [key]: v } as Partial<GameSettings>);
          }),
          val,
        ];
      };
      p.appendChild(this.row('Master volume', vol('masterVolume')));
      p.appendChild(this.row('Sound volume', vol('sfxVolume'), 'Engine, effects, ambience'));
      p.appendChild(this.row('Music volume', vol('musicVolume')));
      p.appendChild(this.row('Test sound', button('Play', () => this.game.audio.play('sfx_lap', { volume: 0.8 }), 'small')));
    } else if (this.section === 'controls') {
      p.appendChild(
        this.row(
          'Steering sensitivity',
          (() => {
            const val = h('span', { style: 'min-width:40px;text-align:right' }, `${s.steeringSensitivity.toFixed(1)}×`);
            return [
              slider(s.steeringSensitivity, 0.5, 1.6, 0.1, (v) => {
                val.textContent = `${v.toFixed(1)}×`;
                this.set({ steeringSensitivity: v });
              }),
              val,
            ];
          })(),
        ),
      );
      p.appendChild(
        this.row(
          'Touch controls',
          segmented(
            [
              { value: 'auto', label: 'Auto' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ] as { value: GameSettings['touchControls']; label: string }[],
            s.touchControls,
            (v) => this.set({ touchControls: v }),
          ),
        ),
      );
      p.appendChild(
        this.row(
          'Touch steering',
          segmented(
            [
              { value: 'buttons', label: 'Buttons' },
              { value: 'wheel', label: 'Wheel' },
            ] as { value: GameSettings['touchSteering']; label: string }[],
            s.touchSteering,
            (v) => this.set({ touchSteering: v }),
          ),
        ),
      );
      p.appendChild(h('div', { class: 'label section-head' }, 'KEYBOARD (click to rebind · arrow keys always work)'));
      for (const a of BINDABLE_ACTIONS) p.appendChild(this.bindingRow(a, s));
      p.appendChild(
        h(
          'div',
          { style: 'margin-top:12px' },
          button('Reset bindings', () => this.set({ bindings: { ...DEFAULT_BINDINGS } }, true), 'small'),
        ),
      );
      p.appendChild(
        h('div', { class: 'label', style: 'margin-top:14px;line-height:1.6;letter-spacing:.06em' }, 'GAMEPAD: RT gas · LT brake · stick steer · A nitro · B/X handbrake · Y camera · Back reset · Start pause'),
      );
    } else if (this.section === 'camera') {
      p.appendChild(
        this.row(
          'Default camera',
          segmented<CameraMode>(CAMERA_MODES.map((m) => ({ value: m, label: CAMERA_LABELS[m] })), s.cameraMode, (v) => {
            this.set({ cameraMode: v });
            const race = this.game.race;
            if (race) race.cameraCtl.setMode(v, race.player.car);
          }),
        ),
      );
      p.appendChild(this.row('Camera shake', toggle(s.cameraShake, (v) => this.set({ cameraShake: v }))));
      const fovVal = h('span', { style: 'min-width:40px;text-align:right' }, `${s.fov}°`);
      p.appendChild(
        this.row('Field of view', [
          slider(s.fov, 55, 85, 1, (v) => {
            fovVal.textContent = `${v}°`;
            this.set({ fov: v });
          }),
          fovVal,
        ]),
      );
    } else {
      const name = h('input', { type: 'text', maxlength: '14', style: 'width:180px' }) as HTMLInputElement;
      name.value = s.playerName;
      name.addEventListener('change', () => this.set({ playerName: name.value.trim().toUpperCase().slice(0, 14) || 'PLAYER' }));
      p.appendChild(this.row('Driver name', name));
      p.appendChild(
        this.row(
          'Speed units',
          segmented(
            [
              { value: 'kmh', label: 'KM/H' },
              { value: 'mph', label: 'MPH' },
            ] as { value: GameSettings['units']; label: string }[],
            s.units,
            (v) => this.set({ units: v }),
          ),
        ),
      );
      const st = this.game.save.profile.stats;
      p.appendChild(
        h(
          'div',
          { class: 'label', style: 'margin:16px 0;line-height:1.8;letter-spacing:.08em' },
          `RACES ${st.races} · WINS ${st.wins} · PODIUMS ${st.podiums} · DISTANCE ${st.distanceKm.toFixed(1)} KM · BEST DRIFT ${st.bestDrift}`,
        ),
      );
      p.appendChild(
        this.row(
          'Reset progress',
          button('Reset', () =>
            this.game.ui.confirm('Delete all progress, cars, upgrades and records? This cannot be undone.', () => {
              this.game.save.resetProgress();
              this.game.leaderboard.clear();
              this.game.refreshShowroomCar();
              this.game.ui.toast('Progress reset', 'ok');
              this.render();
            }, 'Delete'),
          'small danger'),
        ),
      );
      p.appendChild(this.row('Restore default settings', button('Defaults', () => {
        this.game.settings.reset();
        this.render();
      }, 'small')));
    }
  }

  private bindingRow(action: BindableAction, s: Readonly<GameSettings>): HTMLElement {
    const btn = h('button', { class: 'binding-btn' }, keyLabel(s.bindings[action])) as HTMLButtonElement;
    btn.addEventListener('click', () => {
      btn.classList.add('listening');
      btn.textContent = 'Press a key…';
      this.game.input.captureNextKey((code) => {
        btn.classList.remove('listening');
        if (code === 'Escape' && action !== 'pause') {
          btn.textContent = keyLabel(this.game.settings.value.bindings[action]);
          return;
        }
        const bindings = { ...this.game.settings.value.bindings };
        // swap if the key was used by another action
        for (const a of BINDABLE_ACTIONS) if (a !== action && bindings[a] === code) bindings[a] = bindings[action];
        bindings[action] = code;
        this.set({ bindings }, true);
      });
    });
    return this.row(ACTION_LABELS[action], btn);
  }
}
