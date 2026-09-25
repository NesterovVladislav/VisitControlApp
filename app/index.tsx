import { Redirect } from 'expo-router';

import { useAppSelector } from '../store';

export default function Index() {
  const phase = useAppSelector((state) => state.auth.phase);

  if (phase === 'authenticated') {
    return <Redirect href="/children" />;
  }
  if (phase === 'unauthenticated') {
    return <Redirect href="/auth" />;
  }
  return null;
}
