import { RegistrationRequestView } from '../store/types/requests';
import { dayTitle, timeOfDay } from './visit-dates';

/** «Иванова Мария Петровна» */
export function fullName(request: RegistrationRequestView): string {
  return [request.surname, request.firstName, request.patronymic].filter(Boolean).join(' ');
}

/** «Сегодня, 18:40», «Вчера, 24 сентября, 18:40» */
export function submittedAt(iso: string): string {
  return `${dayTitle(iso)}, ${timeOfDay(iso)}`;
}
