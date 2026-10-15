import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getApiBaseUrl } from '@/services/apiConfig';
import { setAuthSession } from '@/services/authStore';
import { Radius, Spacing } from '@/constants/theme';

export default function InviteLandingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteData, setInviteData] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setError('Jeton d’invitation manquant');
      setLoading(false);
      return;
    }

    const consumeInvite = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/invite/${token}/data`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || 'Ce lien d’invitation est invalide ou a expiré.');
          setLoading(false);
          return;
        }

        setInviteData(data);

        // Sauvegarde et active immédiatement la session en mémoire et dans le stockage
        setAuthSession(data.user, data.token);

        // Redirection directe vers l'accueil sans besoin de recharger la page
        setTimeout(() => {
          router.replace('/');
        }, 400);
      } catch (err: any) {
        setError(err.message || 'Erreur réseau lors de la validation de l’invitation.');
        setLoading(false);
      }
    };

    consumeInvite();
  }, [token]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logoBadge}>🎬 Universal Media Stack</Text>

        {loading ? (
          <>
            <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 16 }} />
            <Text style={styles.title}>Connexion 1 clic en cours...</Text>
            <Text style={styles.sub}>Validation de votre invitation personnalisée.</Text>
          </>
        ) : error ? (
          <>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>⚠️</Text>
            <Text style={[styles.title, { color: '#f87171' }]}>Lien introuvable</Text>
            <Text style={styles.sub}>{error}</Text>
            <Pressable focusable={true} onPress={() => router.replace('/login')} style={styles.btn}>
              <Text style={styles.btnTxt}>Aller à la page de connexion</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🎉</Text>
            <Text style={styles.title}>Bienvenue, {inviteData?.user?.displayName} !</Text>
            <Text style={styles.sub}>
              Connexion réussie avec votre compte ({inviteData?.user?.email}). Redirection immédiate...
            </Text>
            <Pressable focusable={true} onPress={() => router.replace('/')} style={styles.btn}>
              <Text style={styles.btnTxt}>Accéder directement au catalogue →</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

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
    maxWidth: 440,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    alignItems: 'center',
    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
  },
  logoBadge: {
    fontSize: 18,
    fontWeight: '900',
    color: '#a5b4fc',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radius.pill,
    marginTop: 8,
  },
  btnTxt: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});
