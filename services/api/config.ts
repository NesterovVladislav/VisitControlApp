/** Централизованная конфигурация API приложения. */
export interface BackendConfig {
  host: string;
  port?: number;
  protocol: 'http' | 'https';
  basePath?: string;
  timeout?: number;
}

export const BACKENDS: Record<string, BackendConfig> = {
  visitControlServer: {
    // Локальный стенд по умолчанию. Для release задайте EXPO_PUBLIC_API_URL с HTTPS.
    host: '93.77.168.178',
    protocol: 'http',
    basePath: '/api',
    timeout: 10000,
  },
};

function visitControlUrlOverride(): string | null {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  return value ? value.replace(/\/+$/, '') : null;
}

export function getBackendUrl(backendName: string): string {
  const config = BACKENDS[backendName];
  if (!config) {
    throw new Error(`Backend "${backendName}" not found in configuration`);
  }

  if (backendName === 'visitControlServer') {
    const override = visitControlUrlOverride();
    const insecureTestBuild =
      process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP === '1';
    if (override) {
      if (!__DEV__ && !override.startsWith('https://') && !insecureTestBuild) {
        throw new Error(
          'EXPO_PUBLIC_API_URL must be set to an HTTPS URL for release builds',
        );
      }
      return override;
    }
    if (!__DEV__) {
      throw new Error(
        'EXPO_PUBLIC_API_URL must be set to an HTTPS URL for release builds',
      );
    }
  }

  const { protocol, host, port, basePath } = config;
  const portPart = port ? `:${port}` : '';
  const basePathPart = basePath ?? '';
  return `${protocol}://${host}${portPart}${basePathPart}`;
}

export function getBackendConfig(backendName: string): BackendConfig {
  const config = BACKENDS[backendName];
  if (!config) {
    throw new Error(`Backend "${backendName}" not found in configuration`);
  }
  return config;
}
