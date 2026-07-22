export type QualityPresetName = "preview" | "standard" | "final";

type RenderQualityInput = {
  qualityPreset?: QualityPresetName;
  width?: number;
  height?: number;
  samples?: number;
  maxTimeSeconds?: number;
  [key: string]: unknown;
};

export const QUALITY_PRESETS = {
  preview: { width: 960, height: 540, samples: 16 },
  standard: { width: 1920, height: 1080, samples: 64 },
  final: { width: 3840, height: 2160, samples: 256 },
} as const;

export function applyRenderQuality<T extends RenderQualityInput>(
  input: T,
  defaultPreset?: QualityPresetName,
): T {
  const selected = input.qualityPreset ?? defaultPreset;
  if (!selected) return { ...input };

  const preset = QUALITY_PRESETS[selected];
  const result: RenderQualityInput = {
    ...input,
    qualityPreset: selected,
    width: input.width ?? preset.width,
    height: input.height ?? preset.height,
  };

  if (input.maxTimeSeconds !== undefined) {
    delete result.samples;
  } else {
    result.samples = input.samples ?? preset.samples;
  }

  return result as T;
}
