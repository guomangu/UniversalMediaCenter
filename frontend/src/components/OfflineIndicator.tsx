import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Radius } from '@/constants/theme';

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    setOffline(!navigator.onLine);

    const onOffline = () => {
      setOffline(true);
      setReconnected(false);
    };

    const onOnline = () => {
      setOffline(false);
      setReconnected(true);
      const timer = setTimeout(() => setReconnected(false), 3000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!offline && !reconnected) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.pill, offline ? styles.pillOffline : styles.pillOnline]}
    >
      <Text style={styles.text}>
        {offline
          ? 'Mode hors ligne • Consultation fluide des données en cache'
          : 'Connexion rétablie • Données synchronisées'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    bottom: 16,
    alignSelf: 'center',
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }),
  },
  pillOffline: {
    backgroundColor: 'rgba(51, 35, 30, 0.95)',
    borderColor: 'rgba(217, 119, 6, 0.4)',
  },
  pillOnline: {
    backgroundColor: 'rgba(20, 45, 35, 0.95)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  text: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
