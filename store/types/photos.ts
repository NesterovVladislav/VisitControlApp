/** Что стало с заявкой на фотографию. APPROVED в ответе на отправку — фотография заменена сразу. */
export type PhotoRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/**
 * Заявка на фотографию в профиле: свою или своего ребёнка (visit-control-service/docs/profile-photos.md).
 * Родитель и сотрудник подают её на подтверждение, администратор и директор меняют фотографию сразу.
 */
export interface PhotoRequest {
  id: string;
  status: PhotoRequestStatus;
  /** Чья фотография: взрослый или ребёнок */
  userId: string;
  /** «Иван Петров» */
  userName: string;
  /** Действующая фотография: путь относительно API */
  currentPhotoUrl: string | null;
  /** Предлагаемая картинка, пока заявка ждёт: путь относительно API */
  imageUrl: string | null;
  /** Причина отклонения */
  reason: string | null;
  /** Кто подал: «Иванова А.». Только в списке у администратора */
  applicantName: string | null;
}

/** Чью фотографию меняют: свою или своего ребёнка. */
export interface PhotoTarget {
  userId: string;
  /** Не задан — своя фотография */
  childId?: string;
}

export interface PhotosState {
  /** Свои заявки: на себя и на своих детей, ждущие и недавно отклонённые */
  own: PhotoRequest[];
  /** Заявки сада, которые ждут администратора */
  pending: PhotoRequest[];
  /** Чьи фотографии сейчас отправляются или удаляются */
  busyUserIds: string[];
  cancellingIds: string[];
  decidingIds: string[];
  error: string | null;
}
