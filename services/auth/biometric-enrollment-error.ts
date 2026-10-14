/**
 * Не удалось включить вход по Face ID в браузере (web-session-vault.ts). На телефоне не возникает:
 * там биометрия включается без запроса к датчику.
 */
export type BiometricEnrollmentFailure =
  /** Пользователь закрыл окно Face ID */
  | 'cancelled'
  /** Ключ создан, но Safari просит ещё одно нажатие, чтобы подтвердить Face ID */
  | 'confirmationRequired'
  /** Браузер не умеет PRF или нет встроенного датчика */
  | 'unsupported'
  | 'failed';

export class BiometricEnrollmentError extends Error {
  constructor(public readonly reason: BiometricEnrollmentFailure) {
    super(`Biometric enrollment failed: ${reason}`);
    this.name = 'BiometricEnrollmentError';
  }
}
