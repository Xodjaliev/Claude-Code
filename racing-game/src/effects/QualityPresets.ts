export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';
export const QUALITY_LEVELS: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];

export interface QualityProfile {
  pixelRatioCap: number;
  /** Multiplier on top of the cap (render scale). */
  renderScale: number;
  shadows: boolean;
  shadowMapSize: number;
  postFx: boolean;
  bloom: boolean;
  ao: boolean;
  msaa: number;
  fxaa: boolean;
  motionBlur: boolean;
  particleScale: number;
  decorDensity: number;
  maxSkidSegments: number;
}

export const QUALITY: Record<GraphicsQuality, QualityProfile> = {
  low: {
    pixelRatioCap: 1, renderScale: 0.8, shadows: false, shadowMapSize: 512, postFx: false, bloom: false, ao: false, msaa: 0,
    fxaa: false, motionBlur: false, particleScale: 0.4, decorDensity: 0.4, maxSkidSegments: 600,
  },
  medium: {
    pixelRatioCap: 1.25, renderScale: 1, shadows: true, shadowMapSize: 1024, postFx: true, bloom: true, ao: false, msaa: 0,
    fxaa: true, motionBlur: true, particleScale: 0.7, decorDensity: 0.7, maxSkidSegments: 1500,
  },
  high: {
    pixelRatioCap: 1.5, renderScale: 1, shadows: true, shadowMapSize: 2048, postFx: true, bloom: true, ao: false, msaa: 4,
    fxaa: false, motionBlur: true, particleScale: 1, decorDensity: 1, maxSkidSegments: 3000,
  },
  ultra: {
    pixelRatioCap: 2, renderScale: 1, shadows: true, shadowMapSize: 4096, postFx: true, bloom: true, ao: true, msaa: 4,
    fxaa: false, motionBlur: true, particleScale: 1.3, decorDensity: 1, maxSkidSegments: 4000,
  },
};
