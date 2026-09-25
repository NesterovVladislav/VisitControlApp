/**
 * Разрешает Android-приложению HTTP-запросы без TLS (android:usesCleartextTraffic="true").
 *
 * Нужен, пока бэкенд доступен только по http://93.77.168.178. В release-сборке Android
 * по умолчанию блокирует такие запросы, в debug они разрешены отдельным манифестом.
 * Убрать плагин из app.json, когда на сервере появится HTTPS.
 */
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return mod;
  });
};
