import * as Crypto from 'expo-crypto';

const FOUR_ASCII_DIGITS = /^\d{4}$/;

export function isFourDigitPin(value: string): boolean {
  return FOUR_ASCII_DIGITS.test(value);
}

export async function createPinSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function derivePinVerifier(pin: string, salt: string): Promise<string> {
  if (!isFourDigitPin(pin)) {
    throw new Error('PIN must contain exactly four digits');
  }

  if (!salt) {
    throw new Error('PIN salt must not be empty');
  }

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`,
  );
}
