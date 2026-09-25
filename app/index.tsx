import { Redirect } from 'expo-router';

import { useAppSelector } from '../store';
import { ADMIN_ROLE } from '../store/types/auth';

export default function Index() {
  const { phase, user, mode } = useAppSelector((state) => state.auth);

  if (phase === 'authenticated') {
    return <Redirect href={user?.role === ADMIN_ROLE && mode === 'admin' ? '/visits' : '/children'} />;
  }
  if (phase === 'unauthenticated') {
    return <Redirect href="/auth" />;
  }
  return null;
}
