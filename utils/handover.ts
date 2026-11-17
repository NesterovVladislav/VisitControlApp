import { ApiError } from '@/services/errors/api-error';
import { HandoverResult } from '@/store/types/visits';
import { linkLabel } from './people-format';

/** Начало содержимого QR-кода ДоброВхода: по нему отличаем свой код от постороннего. */
export const HANDOVER_PREFIX = 'vc1:';

export function isHandoverCode(data: string): boolean {
  return data.trim().startsWith(HANDOVER_PREFIX);
}

/** «0:45» — сколько ещё действует код. */
export function countdownLabel(seconds: number): string {
  const left = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** «Принято: Мария Иванова» / «Отдан(а): Пётр Сидоров» */
export function handoverResultTitle(result: Pick<HandoverResult, 'status' | 'childName'>): string {
  return result.status === 'IN' ? `Принято: ${result.childName}` : `Отдан(а): ${result.childName}`;
}

/** «Солнышко · привёл(а) Иванова А. (родитель)» */
export function handoverResultDetail(result: HandoverResult): string {
  const action = result.status === 'IN' ? 'привёл(а)' : 'забрал(а)';
  const link = result.linkRole ? ` (${linkLabel(result.linkRole, null)})` : '';
  const who = `${action} ${result.representativeName}${link}`;
  return result.groupName ? `${result.groupName} · ${who}` : who;
}

const CODE_MESSAGES: Record<string, string> = {
  HANDOVER_TOKEN_EXPIRED: 'Код устарел — попросите родителя обновить его',
  HANDOVER_TOKEN_USED: 'Этот код уже использован',
  HANDOVER_TOKEN_INVALID: 'Код не распознан. Попросите родителя показать код заново',
  SELF_CONFIRMATION: 'Свой код сканирует другой сотрудник',
  VISIT_ALREADY_IN: 'Ребёнок уже в саду',
  VISIT_NOT_IN: 'Сегодня приход ребёнка не отмечен',
  VISIT_ALREADY_PENDING: 'Отметка уже ждёт подтверждения сада',
  VISIT_NOT_ALLOWED: 'Этот человек не может привести или забрать ребёнка',
  VISIT_CONFIRMATION_OFF: 'В саду не включено подтверждение посещений',
};

/**
 * Понятный текст ошибки при выдаче или скане QR-кода. null — ошибку не показываем
 * (401: интерсептор уже выходит из аккаунта).
 */
export function handoverErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return 'Не получилось. Попробуйте ещё раз';
  }
  if (error.status === 401) {
    return null;
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз';
  }
  const known = CODE_MESSAGES[String(error.data?.code ?? '')];
  if (known) {
    return known;
  }
  if (error.status === 403) {
    return 'Нет доступа';
  }
  return 'Не получилось. Попробуйте ещё раз';
}
