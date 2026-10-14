import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function LiveRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tv');
  }, []);
  return null;
}
