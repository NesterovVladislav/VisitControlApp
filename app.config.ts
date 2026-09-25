import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const staticConfig = appJson.expo as ExpoConfig;
  const allowInsecureHttp = process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP === '1';
  const infoPlist = { ...(staticConfig.ios?.infoPlist ?? {}) };

  if (allowInsecureHttp) {
    infoPlist.NSAppTransportSecurity = { NSAllowsArbitraryLoads: true };
  } else {
    delete infoPlist.NSAppTransportSecurity;
  }

  return {
    ...staticConfig,
    ...config,
    ios: {
      ...staticConfig.ios,
      ...config.ios,
      infoPlist,
    },
  };
};
