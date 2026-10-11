import type { ThemeId } from '../TrackCatalog';
import { buildCityEnvironment } from './CityEnvironment';
import type { EnvironmentBuilder } from './common';
import { buildDesertEnvironment } from './DesertEnvironment';
import { buildMountainEnvironment } from './MountainEnvironment';

/** Theme -> environment generator. Register new themes here. */
export const ENVIRONMENTS: Record<ThemeId, EnvironmentBuilder> = {
  city: buildCityEnvironment,
  desert: buildDesertEnvironment,
  mountain: buildMountainEnvironment,
};

export type { EnvContext, TrackEnvironment } from './common';
