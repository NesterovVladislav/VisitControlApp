/**
 * Конфигурация всех бэкендов приложения
 * Здесь централизованно хранятся настройки для всех API серверов
 */

export interface BackendConfig {
  host: string;
  port?: number;
  protocol: 'http' | 'https';
  basePath?: string;
  timeout?: number;
}

/**
 * Конфигурация всех бэкендов
 */
export const BACKENDS: Record<string, BackendConfig> = {
  visitControlServer: {
    host: 'localhost',
    port: 8080,
    protocol: 'http',
    basePath: '/api',
    timeout: 10000,
  },
  // Здесь можно добавить другие бэкенды:
  // anotherBackend: {
  //   host: 'api.example.com',
  //   protocol: 'https',
  //   basePath: '/v1',
  //   timeout: 15000,
  // },
};

/**
 * Формирует полный URL для бэкенда
 * @param backendName - имя бэкенда из конфигурации
 * @returns полный URL бэкенда
 */
export function getBackendUrl(backendName: string): string {
  const config = BACKENDS[backendName];

  if (!config) {
    throw new Error(`Backend "${backendName}" not found in configuration`);
  }

  const { protocol, host, port, basePath } = config;
  const portPart = port ? `:${port}` : '';
  const basePathPart = basePath ? basePath : '';

  return `${protocol}://${host}${portPart}${basePathPart}`;
}

/**
 * Получает конфигурацию бэкенда
 * @param backendName - имя бэкенда
 * @returns конфигурация бэкенда
 */
export function getBackendConfig(backendName: string): BackendConfig {
  const config = BACKENDS[backendName];

  if (!config) {
    throw new Error(`Backend "${backendName}" not found in configuration`);
  }

  return config;
}
