export const attendanceReasons = {
  ILLNESS: { icon: 'thermometer', label: 'Болезнь' },
  VACATION: { icon: 'briefcase', label: 'Отпуск' },
  FAMILY: { icon: 'home', label: 'Семейные обстоятельства' },
  OTHER: { icon: 'more-horizontal', label: 'Другое' },
} as const;

export function attendanceReason(code: string) {
  return Object.prototype.hasOwnProperty.call(attendanceReasons, code)
    ? attendanceReasons[code as keyof typeof attendanceReasons]
    : attendanceReasons.OTHER;
}
