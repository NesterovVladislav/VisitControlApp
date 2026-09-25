import * as Crypto from 'expo-crypto';

import { createPinSalt, derivePinVerifier, isFourDigitPin } from './pin-crypto';

describe('PIN cryptography', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['', '123', '12345', '12a4', '１２３４', ' 1234'])('rejects invalid PIN %p', (pin) => {
    expect(isFourDigitPin(pin)).toBe(false);
  });

  it('accepts exactly four ASCII digits including a leading zero', () => {
    expect(isFourDigitPin('0427')).toBe(true);
  });

  it('creates a 32-character hex salt from asynchronous secure bytes', async () => {
    jest
      .spyOn(Crypto, 'getRandomBytesAsync')
      .mockResolvedValue(Uint8Array.from([0, 1, 15, 16, 31, 32, 63, 64, 127, 128, 191, 192, 223, 224, 254, 255]));

    await expect(createPinSalt()).resolves.toBe('00010f101f203f407f80bfc0dfe0feff');
  });

  it('derives stable salted verifiers without returning the PIN', async () => {
    jest.spyOn(Crypto, 'digestStringAsync').mockImplementation(async (_algorithm, value) => {
      const values: Record<string, string> = {
        'salt-a:1234': 'a'.repeat(64),
        'salt-b:1234': 'b'.repeat(64),
      };
      return values[value] as Crypto.Digest;
    });

    await expect(derivePinVerifier('1234', 'salt-a')).resolves.toBe('a'.repeat(64));
    await expect(derivePinVerifier('1234', 'salt-a')).resolves.not.toContain('1234');
    await expect(derivePinVerifier('1234', 'salt-b')).resolves.toBe('b'.repeat(64));
  });

  it('rejects an invalid PIN before hashing', async () => {
    const digest = jest.spyOn(Crypto, 'digestStringAsync');

    await expect(derivePinVerifier('12a4', 'salt-a')).rejects.toThrow('PIN must contain exactly four digits');
    expect(digest).not.toHaveBeenCalled();
  });
});
