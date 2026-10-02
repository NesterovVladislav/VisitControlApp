import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useAppSelector } from '../store';
import { ADMIN_ROLE } from '../store/types/auth';

/**
 * Открывает «Состав группы», где добавляют и убирают детей, в стеке своей вкладки: переход в чужой стек
 * переключил бы вкладку. Только администратору — сотрудник видит группы, но состав не меняет (на бэкенде USER_WRITE).
 */
export function useOpenGroupMembers(stack: 'visits' | 'garden' = 'visits'): ((groupId: string) => void) | undefined {
  const router = useRouter();
  const isAdmin = useAppSelector((state) => state.auth.user?.role === ADMIN_ROLE);
  return useMemo(
    () =>
      isAdmin
        ? (groupId: string) =>
            router.push({
              pathname: stack === 'visits' ? '/visits/group-members' : '/garden/group-members',
              params: { groupId },
            })
        : undefined,
    [isAdmin, router, stack]
  );
}
