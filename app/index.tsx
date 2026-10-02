import { Redirect } from 'expo-router';

import { useAppSelector } from '../store';
import { isStaffRole } from '../store/types/auth';

export default function Index() {
  const { phase, user, mode } = useAppSelector((state) => state.auth);

  if (phase === 'authenticated') {
    return <Redirect href={isStaffRole(user?.role) && mode === 'admin' ? '/visits' : '/children'} />;
  }
  if (phase === 'unauthenticated') {
    return <Redirect href="/auth" />;
  }
  return null;
}
