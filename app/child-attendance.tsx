import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { ChildAttendancePanel } from '../components/child-attendance-panel';
import { ActionButton, BottomSheet } from '../components/ui';
import { hasAttendanceAccess } from '../hooks/use-own-attendance';
import { useAppDispatch, useAppSelector } from '../store';
import { loadChildrenStart } from '../store/reducers/children';

export default function ChildAttendanceScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { child } = useLocalSearchParams<{ child?: string }>();
  const childId = typeof child === 'string' && child ? child : undefined;
  const { items, listStatus } = useAppSelector((state) => state.children);
  const children = items.filter(hasAttendanceAccess);
  const selected = children.find((item) => item.id === childId);
  const [picker, setPicker] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    if (listStatus === 'idle') dispatch(loadChildrenStart());
  }, [dispatch, listStatus]));

  const onUnavailable = useCallback(() => {
    dispatch(loadChildrenStart({ refresh: true }));
    router.dismissTo('/children');
  }, [dispatch, router]);

  return (
    <>
      <ChildAttendancePanel childId={childId} selected={selected} showIdentity cursor={cursor} onCursorChange={setCursor}
        onUnavailable={onUnavailable} onChooseChild={children.length > 1 ? () => setPicker(true) : undefined} />
      {picker && (
        <BottomSheet title="Выберите ребёнка" onClose={() => setPicker(false)}>
          {children.map((item) => (
            <ActionButton key={item.id} label={`${item.firstName} ${item.surname}`.trim()}
              variant={item.id === childId ? 'primary' : 'text'}
              onPress={() => {
                setPicker(false);
                router.setParams({ child: item.id });
              }} />
          ))}
        </BottomSheet>
      )}
    </>
  );
}
