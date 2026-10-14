import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirection automatique vers un espace fonctionnel
    const timer = setTimeout(() => {
      router.replace('/');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🧭</Text>
        <Text style={styles.title}>Page Introuvable</Text>
        <Text style={styles.desc}>
          Vous êtes redirigé vers l'accueil de votre médiathèque dans quelques instants...
        </Text>
        <Pressable onPress={() => router.replace('/')} style={styles.btn}>
          <Text style={styles.btnTxt}>Aller à l'accueil maintenant</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: 'center',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    gap: 12,
  },
  icon: { fontSize: 40 },
  title: { fontSize: 20, fontWeight: '900', color: '#f8fafc' },
  desc: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  btn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    marginTop: 6,
  },
  btnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
});
