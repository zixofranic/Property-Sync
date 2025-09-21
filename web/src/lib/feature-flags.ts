export interface FeatureFlags {
  useMessagingV2: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    useMessagingV2: process.env.NEXT_PUBLIC_USE_MESSAGING_V2 === 'true',
  };
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[flag];
}