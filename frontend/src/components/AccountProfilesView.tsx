import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { UserProfile, fetchProfilesList, loginWithProfile, getCurrentUser } from '@/services/authStore';
import { AccountProfileCard } from './AccountProfileCard';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  onProfileSelected: () => void;
  onGoToCreate: () => void;
}

export function AccountProfilesView({ onProfileSelected, onGoToCreate }: Props) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const current = getCurrentUser();

  const load = async () => {
    setLoading(true);
    const list = await fetchProfilesList();
    setProfiles(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSelect = async (p: UserProfile, pin?: string) => {
    const res = await loginWithProfile(p.id, pin);
    if (res.success) {
      onProfileSelected();
    }
    return res;
  };

  return (
    <View style={{ maxHeight: 420 }}>
      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: Spacing.two }}>
        Sélectionnez votre profil d'écoute et de visionnage :
      </Text>

      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginVertical: 24 }} />
      ) : (
        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
          {profiles.map((p) => (
            <AccountProfileCard
              key={p.id}
              profile={p}
              isCurrent={current?.id === p.id}
              onSelect={(pin) => handleSelect(p, pin)}
            />
          ))}
          {profiles.length === 0 ? (
            <Text style={{ color: '#64748b', textAlign: 'center', marginVertical: 20 }}>Aucun profil existant.</Text>
          ) : null}
        </ScrollView>
      )}

      <Pressable
        focusable={true}
        onPress={onGoToCreate}
        style={{ marginTop: 10, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: 'rgba(99, 102, 241, 0.15)', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.4)', alignItems: 'center' }}
      >
        <Text style={{ color: '#818cf8', fontWeight: '700', fontSize: 12 }}>+ Créer un nouveau profil</Text>
      </Pressable>
    </View>
  );
}
