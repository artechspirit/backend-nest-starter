import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'feature_flag';

/**
 * Decorator to protect endpoints or controllers behind a static/dynamic feature flag.
 * @param featureName The name of the feature flag (e.g., 'billing', 'webhooks')
 */
export const FeatureFlag = (featureName: string) =>
  SetMetadata(FEATURE_FLAG_KEY, featureName);
