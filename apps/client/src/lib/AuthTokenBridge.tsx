import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setGetToken } from './authToken';

// Keeps the vanilla tRPC client's token source in sync with Clerk's session,
// since that client is created outside the ClerkProvider tree and can't call useAuth() directly.
export default function AuthTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setGetToken(() => getToken());
    return () => setGetToken(null);
  }, [getToken]);

  return null;
}
