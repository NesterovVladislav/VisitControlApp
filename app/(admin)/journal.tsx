import { useFocusEffect } from '@react-navigation/native';
import { Redirect } from 'expo-router';
import { useCallback } from 'react';

import JournalList from '../../components/staff-journal';
import { useAppDispatch, useAppSelector } from '../../store';
import { loadJournalStart, loadPresentStart } from '../../store/reducers/visits';

export default function JournalScreen() {
  const dispatch = useAppDispatch();
  const employee = useAppSelector(state => state.auth.user?.role === 'EMPLOYEE');
  useFocusEffect(useCallback(() => {
    if (employee) {
      dispatch(loadPresentStart());
      dispatch(loadJournalStart());
    }
  }, [dispatch, employee]));
  if (!employee) return <Redirect href="/visits" />;
  return <JournalList selectable />;
}
