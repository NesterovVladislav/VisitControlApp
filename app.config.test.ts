import type { ConfigContext, ExpoConfig } from 'expo/config';

import buildConfig from './app.config';

const context = {
  config: { name: 'VisitControlApp', slug: 'VisitControlApp' },
} as ConfigContext;

function pluginNames(config: ExpoConfig): string[] {
  return (config.plugins ?? []).map((plugin) =>
    typeof plugin === 'string' ? plugin : (plugin[0] ?? ''),
  );
}

describe('native transport security config', () => {
  const originalFlag = process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP;
    } else {
      process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP = originalFlag;
    }
  });

  it('blocks cleartext HTTP by default on both platforms', () => {
    delete process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP;
    const config = buildConfig(context);

    expect(pluginNames(config)).not.toContain('./plugins/with-cleartext-traffic');
    expect(pluginNames(config)).toContain('expo-secure-store');
    expect(config.ios?.infoPlist?.NSAppTransportSecurity).toBeUndefined();
  });

  it('enables cleartext only for an explicitly marked test build', () => {
    process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP = '1';
    const config = buildConfig(context);

    expect(pluginNames(config)).toContain('./plugins/with-cleartext-traffic');
    expect(config.ios?.infoPlist?.NSAppTransportSecurity).toEqual({
      NSAllowsArbitraryLoads: true,
    });
  });
});
