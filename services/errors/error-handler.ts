import { AxiosError } from 'axios';
import { ApiError } from './api-error';
import { ApiErrorData } from '../api/types';

/**
 * Обрабатывает ошибки axios и преобразует их в ApiError
 * @param error - ошибка от axios или другая ошибка
 * @returns экземпляр ApiError
 */
export function handleApiError(error: unknown): ApiError {
  // Если это уже ApiError, возвращаем как есть
  if (error instanceof ApiError) {
    return error;
  }

  // Если это AxiosError
  if (error instanceof AxiosError) {
    return handleAxiosError(error);
  }

  // Если это обычная Error
  if (error instanceof Error) {
    return new ApiError(
      error.message || 'Произошла неизвестная ошибка',
      null,
      '',
      null,
      error
    );
  }

  // Если это что-то другое
  return new ApiError(
    'Произошла неизвестная ошибка',
    null,
    '',
    null,
    new Error(String(error))
  );
}

/**
 * Обрабатывает ошибки axios
 * @param error - ошибка от axios
 * @returns экземпляр ApiError
 */
function handleAxiosError(error: AxiosError): ApiError {
  const { response, request, message, code } = error;

  // Ошибка сети (нет ответа от сервера)
  if (!response && request) {
    const errorMessage = code === 'ECONNABORTED'
      ? 'Превышено время ожидания ответа от сервера'
      : 'Ошибка сети. Проверьте подключение к интернету';

    return new ApiError(
      errorMessage,
      null,
      '',
      null,
      error
    );
  }

  // Ошибка с ответом от сервера
  if (response) {
    const { status, statusText, data } = response;
    const errorData = data as ApiErrorData | undefined;

    // Формируем сообщение об ошибке
    let errorMessage = getErrorMessage(status, errorData);

    return new ApiError(
      errorMessage,
      status,
      statusText,
      errorData || null,
      error
    );
  }

  // Другие ошибки axios
  return new ApiError(
    message || 'Произошла ошибка при выполнении запроса',
    null,
    '',
    null,
    error
  );
}

/**
 * Получает понятное сообщение об ошибке на основе статуса и данных
 * @param status - HTTP статус код
 * @param data - данные ошибки от сервера
 * @returns сообщение об ошибке
 */
function getErrorMessage(status: number, data?: ApiErrorData): string {
  // Если есть сообщение в данных ответа
  if (data?.message) {
    return data.message;
  }

  // Стандартные сообщения по статусам
  switch (status) {
    case 400:
      return 'Некорректный запрос. Проверьте отправляемые данные';
    case 401:
      return 'Требуется авторизация';
    case 403:
      return 'Доступ запрещен';
    case 404:
      return 'Запрашиваемый ресурс не найден';
    case 409:
      return 'Конфликт данных';
    case 422:
      return 'Ошибка валидации данных';
    case 429:
      return 'Слишком много запросов. Попробуйте позже';
    case 500:
      return 'Внутренняя ошибка сервера';
    case 502:
      return 'Ошибка шлюза';
    case 503:
      return 'Сервис временно недоступен';
    case 504:
      return 'Превышено время ожидания ответа от сервера';
    default:
      return `Ошибка сервера (${status})`;
  }
}

/**
 * Логирует ошибку API в консоль
 * @param error - ошибка для логирования
 */
export function logApiError(error: ApiError): void {
  console.error(error.toLogString());

  // Дополнительная информация для отладки
  if (__DEV__) {
    console.error('Error details:', {
      status: error.status,
      statusText: error.statusText,
      data: error.data,
      isNetworkError: error.isNetworkError,
      isTimeoutError: error.isTimeoutError,
      stack: error.stack,
    });
  }
}
