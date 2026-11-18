export const attendanceReasons = {
  ILLNESS: { mark: 'Б', label: 'Болезнь' },
  VACATION: { mark: 'О', label: 'Отпуск' },
  FAMILY: { mark: 'С', label: 'Семейные обстоятельства' },
  OTHER: { mark: 'Д', label: 'Другое' },
};

export function attendanceReason(code: string) {
  return Object.prototype.hasOwnProperty.call(attendanceReasons, code)
    ? attendanceReasons[code as keyof typeof attendanceReasons]
    : attendanceReasons.OTHER;
}
