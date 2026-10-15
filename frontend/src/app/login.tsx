import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { fetchAuthStatus, loginWithPassword, registerAccount, useCurrentUser } from '@/services/authStore';
import { Radius, Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnUrl?: string; error?: string; mode?: string }>();
  const currentUser = useCurrentUser();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Initialisation à false pour éviter tout écran blanc ou spinner bloquant au SSR (Rendu instantané 0 ms)
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean>(true);
  const [hasAdmin, setHasAdmin] = useState<boolean>(true);
  const [isRegisterMode, setIsRegisterMode] = useState(params.mode === 'register');

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(params.error || '');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    fetchAuthStatus()
      .then((status) => {
        if (!isMounted) return;
        setHasUsers(status.hasUsers);
        setHasAdmin(status.hasAdmin);

        // L'écran de création du premier admin n'est activé QUE s'il n'existe aucun admin ni utilisateur
        if (!status.hasAdmin && !status.hasUsers) {
          setIsRegisterMode(true);
        } else if (params.mode === 'register') {
          setIsRegisterMode(true);
        } else {
          setIsRegisterMode(false);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // En cas d'erreur ou d'indisponibilité réseau, rester sur la connexion standard par sécurité
        setHasUsers(true);
        setHasAdmin(true);
        setIsRegisterMode(false);
      })
      .finally(() => {
        if (isMounted) setLoadingStatus(false);
      });

    return () => {
      isMounted = false;
    };
  }, [params.mode]);

  // Si déjà connecté, rediriger vers returnUrl ou accueil
  useEffect(() => {
    if (currentUser && !submitting) {
      const destination = params.returnUrl ? decodeURIComponent(params.returnUrl) : '/';
      router.replace(destination as any);
    }
  }, [currentUser]);

  const handleSubmit = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email || !password) {
      setErrorMessage('Veuillez renseigner votre adresse e-mail et votre mot de passe.');
      return;
    }

    if (isRegisterMode && !displayName.trim()) {
      setErrorMessage('Veuillez renseigner votre nom ou pseudonyme.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegisterMode) {
        const res = await registerAccount(email, password, displayName);
        if (!res.success) {
          setErrorMessage(res.error || 'Erreur lors de la création du compte.');
          setSubmitting(false);
          return;
        }
        setSuccessMessage('Compte créé avec succès ! Connexion en cours...');
      } else {
        const res = await loginWithPassword(email, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Identifiants invalides.');
          setSubmitting(false);
          return;
        }
        setSuccessMessage('Connexion réussie !');
      }

      const destination = params.returnUrl ? decodeURIComponent(params.returnUrl) : '/';
      setTimeout(() => {
        router.replace(destination as any);
      }, 350);
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur est survenue.');
      setSubmitting(false);
    }
  };

  // Ne s'affiche que s'il n'existe absolument aucun admin et aucun compte utilisateur en base
  const isFirstAdminCreation = !hasAdmin && !hasUsers;

  return (
    <View style={styles.container}>
      <View style={[styles.card, isMobile && styles.cardMobile]}>
        <View style={styles.logoHeader}>
          <Text style={styles.logoBadge}>🎬 UMS</Text>
          <Text style={styles.title}>
            {isFirstAdminCreation
              ? 'Création du premier Administrateur'
              : isRegisterMode
              ? 'Créer un compte'
              : 'Connexion à votre espace'}
          </Text>
          <Text style={styles.subtitle}>
            {isFirstAdminCreation
              ? 'Aucun compte configuré. Le premier compte créé deviendra automatiquement Administrateur avec tous les privilèges.'
              : isRegisterMode
              ? 'Accédez aux films, séries, chaînes IPTV et salons de discussion.'
              : 'Connectez-vous pour accéder au catalogue et à vos médias favoris.'}
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.alertError}>
            <Text style={styles.alertErrorText}>⚠️ {errorMessage}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.alertSuccess}>
            <Text style={styles.alertSuccessText}>✅ {successMessage}</Text>
          </View>
        ) : null}

        {Platform.OS === 'web' ? (
          <form
            onSubmit={handleSubmit}
            method="post"
            action="#"
            style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}
          >
            {isRegisterMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="displayName" style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 600 }}>
                  Nom complet ou pseudo
                </label>
                <input
                  id="displayName"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Ex : Alexandre Dumas"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  style={webInputStyle}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="username" style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 600 }}>
                Adresse email
              </label>
              <input
                id="username"
                name="username"
                type="email"
                autoComplete="username"
                placeholder="nom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={webInputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="password" style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 600 }}>
                Mot de passe {isRegisterMode ? '(au moins 6 caractères)' : ''}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={webInputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: isFirstAdminCreation ? '#4f46e5' : '#6366f1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '13px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                marginTop: '8px',
                transition: 'background-color 0.2s',
              }}
            >
              {submitting
                ? 'Traitement en cours...'
                : isFirstAdminCreation
                ? '👑 Initialiser et créer l’administrateur'
                : isRegisterMode
                ? 'Créer mon compte'
                : 'Se connecter'}
            </button>
          </form>
        ) : null}

        {!isFirstAdminCreation ? (
          <View style={styles.switchModeRow}>
            <Text style={styles.switchText}>
              {isRegisterMode ? 'Vous avez déjà un compte ?' : 'Pas encore de compte ?'}
            </Text>
            <Pressable
              focusable={true}
              onPress={() => {
                setIsRegisterMode(!isRegisterMode);
                setErrorMessage('');
                setSuccessMessage('');
              }}
              style={styles.switchBtn}
            >
              <Text style={styles.switchBtnText}>
                {isRegisterMode ? 'Se connecter' : 'Créer un compte'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {params.returnUrl ? (
          <Pressable
            focusable={true}
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Retour à la page précédente</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const webInputStyle: React.CSSProperties = {
  backgroundColor: 'rgba(15, 23, 42, 0.8)',
  border: '1px solid rgba(99, 102, 241, 0.35)',
  borderRadius: '12px',
  padding: '12px 14px',
  color: '#f8fafc',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  width: '100%',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
  },
  cardMobile: {
    padding: Spacing.three,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  logoBadge: {
    fontSize: 22,
    fontWeight: '900',
    color: '#a5b4fc',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  alertError: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    borderRadius: Radius.md,
    padding: Spacing.two,
    marginBottom: Spacing.three,
  },
  alertErrorText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  alertSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    borderRadius: Radius.md,
    padding: Spacing.two,
    marginBottom: Spacing.three,
  },
  alertSuccessText: {
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  switchModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  switchText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  switchBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  switchBtnText: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 13,
  },
  backBtn: {
    alignSelf: 'center',
    marginTop: Spacing.two,
    paddingVertical: 6,
  },
  backBtnText: {
    color: '#64748b',
    fontSize: 12,
  },
});
