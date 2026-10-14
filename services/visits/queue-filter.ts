import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueueFilter } from '../../store/types/visits';

export type QueueFilterStore = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Группы, которые сотрудник выбрал для очереди отметок. Хранятся на устройстве отдельно для каждого
 * пользователя: подменяющий воспитатель выбирает группу сам, без администратора.
 */
function storageKey(userId: string): string {
  return `visit-queue-filter:${userId}`;
}

/** null — выбора нет: показываем всю очередь. Повреждённое значение считаем отсутствующим. */
export async function loadQueueFilter(
  userId: string,
  store: QueueFilterStore = AsyncStorage
): Promise<QueueFilter | null> {
  try {
    const raw = await store.getItem(storageKey(userId));
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const { groupIds, withoutGroup } = parsed as Partial<QueueFilter>;
    if (!Array.isArray(groupIds) || !groupIds.every((id) => typeof id === 'string')) {
      return null;
    }
    return { groupIds, withoutGroup: withoutGroup === true };
  } catch {
    return null;
  }
}

export async function saveQueueFilter(
  userId: string,
  filter: QueueFilter | null,
  store: QueueFilterStore = AsyncStorage
): Promise<void> {
  if (filter) {
    await store.setItem(storageKey(userId), JSON.stringify(filter));
  } else {
    await store.removeItem(storageKey(userId));
  }
}
