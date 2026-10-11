# Audio files (optional)

The game synthesises every sound and both music tracks at runtime, so this folder can stay empty.

To use real recordings, put files here (`.mp3`, `.ogg`, `.wav`) and map them in
`src/audio/AudioAssets.ts`, for example:

```ts
export const AUDIO_ASSETS = {
  music_menu: 'audio/menu-theme.mp3',
  music_race: 'audio/race-theme.mp3',
  sfx_crash: 'audio/crash.wav',
};
```

Any id that is missing or fails to load falls back to the procedural version.
