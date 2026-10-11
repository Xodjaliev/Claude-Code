/**
 * Optional audio files. Everything in the game has a procedural (synthesised) fallback,
 * so the game is fully playable without any assets.
 *
 * To use real recordings: drop files into `public/audio/` and map them here, e.g.
 *   music_race: 'audio/race-theme.mp3',
 * Paths are relative to index.html. Missing/failed files silently fall back to synthesis.
 */
export type SoundId =
  | 'music_menu'
  | 'music_race'
  | 'sfx_click'
  | 'sfx_hover'
  | 'sfx_purchase'
  | 'sfx_error'
  | 'sfx_countdown'
  | 'sfx_go'
  | 'sfx_checkpoint'
  | 'sfx_lap'
  | 'sfx_finish'
  | 'sfx_shift'
  | 'sfx_crash'
  | 'sfx_nitro'
  | 'sfx_backfire'
  | 'sfx_levelup';

export const AUDIO_ASSETS: Partial<Record<SoundId, string>> = {
  // music_menu: 'audio/menu.mp3',
  // music_race: 'audio/race.mp3',
  // sfx_crash: 'audio/crash.wav',
};
