import React, { useEffect } from 'react';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { useCurrentUser } from '@/services/authStore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ share?: string }>();
  const currentUser = useCurrentUser();

  useEffect(() => {
    if (!pathname || pathname === '/login') return;

    // Vérifier si un token de partage est présent dans les search params ou dans l'URL du navigateur
    let shareToken = params.share;
    if (!shareToken && typeof window !== 'undefined' && window.location) {
      const sp = new URLSearchParams(window.location.search);
      shareToken = sp.get('share') || undefined;
    }

    const isSpecificSharedMedia =
      (pathname.startsWith('/media') || pathname.startsWith('/player')) && !!shareToken;

    if (!currentUser) {
      if (!isSpecificSharedMedia) {
        let returnUrl = pathname;
        if (typeof window !== 'undefined' && window.location) {
          returnUrl = `${window.location.pathname}${window.location.search}`;
        }
        router.replace({
          pathname: '/login',
          params: {
            returnUrl,
            error: 'Connexion requise pour accéder à cette section',
          },
        } as any);
      }
      return;
    }

    // Protection de la console d'administration
    if (pathname.startsWith('/admin') && !currentUser.isAdmin) {
      router.replace({
        pathname: '/',
        params: {
          error: 'Accès refusé : privilèges administrateur requis',
        },
      } as any);
    }
  }, [pathname, currentUser, params.share]);

  return <>{children}</>;
}
