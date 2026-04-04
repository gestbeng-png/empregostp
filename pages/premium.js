import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { normalizeUserType } from '../lib/defaultPlans';

export default function PremiumRedirect() {
  const router = useRouter();

  useEffect(() => {
      const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/login');
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch(`/api/profile?uid=${user.uid}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      const userTypeRaw = data?.profile?.data?.userType;
      const userType = normalizeUserType(userTypeRaw);
      if (userType === 'candidato') {
        router.replace('/premium/candidatos');
      } else if (userType === 'empresa') {
        router.replace('/premium/empresa');
      } else {
        router.replace('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  return null;
} 
