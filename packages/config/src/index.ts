export const graphicsProfiles = {
  LOW: { hardwareScaling: 1.5, shadows: false, antialias: false },
  MEDIUM: { hardwareScaling: 1, shadows: true, antialias: true },
  HIGH: { hardwareScaling: 0.75, shadows: true, antialias: true },
} as const;

export type GraphicsProfile = keyof typeof graphicsProfiles;
