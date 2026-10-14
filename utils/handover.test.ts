import { ApiError } from '@/services/errors/api-error';
import {
  countdownLabel,
  handoverErrorMessage,
  handoverResultDetail,
  handoverResultTitle,
  isHandoverCode,
} from './handover';

describe('QR handover', () => {
  it('tells a Visit Control code from any other QR code', () => {
    expect(isHandoverCode('vc1:QRot21ERJnIw1PuVdBzE9KUgwN29dvGcluGD5QFJIwc')).toBe(true);
    expect(isHandoverCode('  vc1:abc ')).toBe(true);
    expect(isHandoverCode('https://example.com')).toBe(false);
  });

  it('shows how long the code is still valid', () => {
    expect(countdownLabel(90)).toBe('1:30');
    expect(countdownLabel(8.2)).toBe('0:09');
    expect(countdownLabel(-3)).toBe('0:00');
  });

  it('says whom the employee accepted or gave away and to whom', () => {
    const result = {
      status: 'IN' as const,
      childName: 'Мария Иванова',
      representativeName: 'Иванова А.',
      linkRole: 'PARENT',
      groupName: 'Солнышко',
    };

    expect(handoverResultTitle(result)).toBe('Принято: Мария Иванова');
    expect(handoverResultDetail(result)).toBe('Солнышко · привёл(а) Иванова А. (родитель)');
    expect(handoverResultTitle({ status: 'OUT', childName: 'Пётр Сидоров' })).toBe('Отдан(а): Пётр Сидоров');
    expect(handoverResultDetail({ ...result, status: 'OUT', linkRole: null, groupName: null }))
      .toBe('забрал(а) Иванова А.');
  });

  it('explains errors in plain words', () => {
    expect(handoverErrorMessage(new ApiError('gone', 410, '', { code: 'HANDOVER_TOKEN_EXPIRED' })))
      .toBe('Код устарел — попросите родителя обновить его');
    expect(handoverErrorMessage(new ApiError('conflict', 409, '', { code: 'HANDOVER_TOKEN_USED' })))
      .toBe('Этот код уже использован');
    expect(handoverErrorMessage(new ApiError('conflict', 409, '', { code: 'VISIT_ALREADY_IN' })))
      .toBe('Ребёнок уже в саду');
    expect(handoverErrorMessage(new ApiError('forbidden', 403))).toBe('Нет доступа');
    expect(handoverErrorMessage(new ApiError('unauthorized', 401))).toBeNull();
    expect(handoverErrorMessage(new Error('boom'))).toBe('Не получилось. Попробуйте ещё раз');
  });
});
