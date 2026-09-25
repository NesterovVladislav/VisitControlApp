import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

const CLEARTEXT_PLUGIN = './plugins/with-cleartext-traffic';

function pluginName(plugin: NonNullable<ExpoConfig['plugins']>[number]): string {
  return typeof plugin === 'string' ? plugin : (plugin[0] ?? '');
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const staticConfig = appJson.expo as ExpoConfig;
  const allowInsecureHttp = process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP === '1';
  const infoPlist = {
    ...(staticConfig.ios?.infoPlist ?? {}),
    ...(config.ios?.infoPlist ?? {}),
  };
  const plugins = [...(config.plugins ?? staticConfig.plugins ?? [])]
    .filter((plugin) => pluginName(plugin) !== CLEARTEXT_PLUGIN);

  if (allowInsecureHttp) {
    infoPlist.NSAppTransportSecurity = { NSAllowsArbitraryLoads: true };
    plugins.push(CLEARTEXT_PLUGIN);
  } else {
    delete infoPlist.NSAppTransportSecurity;
  }

  return {
    ...staticConfig,
    ...config,
    plugins,
    ios: {
      ...staticConfig.ios,
      ...config.ios,
      infoPlist,
    },
  };
};
