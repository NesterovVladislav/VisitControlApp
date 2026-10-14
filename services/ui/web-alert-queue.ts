import type { AlertButton, AlertOptions } from 'react-native';

/**
 * Очередь диалогов для браузера. В react-native-web `Alert.alert` ничего не делает: нажатие «Удалить»
 * или «Выйти» просто не показывало бы подтверждения. В веб-сборке `Alert.alert` подменяется на
 * `showWebAlert` (components/web-alert-host.web.tsx), а экраны остаются как есть — и на Android тоже.
 *
 * Диалоги показываются по одному, в порядке вызова — как системные.
 */
export interface WebAlertRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  /** Закрывается нажатием мимо диалога (как `cancelable` на Android) */
  cancelable: boolean;
  onDismiss?: () => void;
}

type Listener = () => void;

let nextId = 1;
let queue: WebAlertRequest[] = [];
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function showWebAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
): void {
  queue = [
    ...queue,
    {
      id: nextId++,
      title,
      message,
      // Без кнопок системный диалог показывает одну «OK»
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
      cancelable: Boolean(options?.cancelable),
      onDismiss: options?.onDismiss,
    },
  ];
  notify();
}

export function currentWebAlert(): WebAlertRequest | null {
  return queue[0] ?? null;
}

function remove(id: number): boolean {
  const before = queue.length;
  queue = queue.filter((request) => request.id !== id);
  if (queue.length === before) return false;
  notify();
  return true;
}

/** Нажата кнопка: диалог закрывается, затем выполняется её действие — как у системного. */
export function pressWebAlertButton(id: number, button: AlertButton): void {
  if (!remove(id)) return;
  button.onPress?.();
}

/** Нажатие мимо диалога. Закрывает только диалог с `cancelable`. */
export function dismissWebAlert(id: number): void {
  const request = queue.find((item) => item.id === id);
  if (!request?.cancelable) return;
  remove(id);
  request.onDismiss?.();
}

export function subscribeWebAlerts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Больше двух кнопок — столбиком, иначе в ряд. */
export function isVerticalLayout(buttons: AlertButton[]): boolean {
  return buttons.length > 2;
}

/**
 * Порядок кнопок как в iOS: «Отмена» слева, если кнопки в ряд, и внизу, если столбиком.
 */
export function orderWebAlertButtons(buttons: AlertButton[]): AlertButton[] {
  const cancel = buttons.filter((button) => button.style === 'cancel');
  const rest = buttons.filter((button) => button.style !== 'cancel');
  return isVerticalLayout(buttons) ? [...rest, ...cancel] : [...cancel, ...rest];
}

export function resetWebAlertsForTests(): void {
  queue = [];
  nextId = 1;
  listeners.clear();
}
