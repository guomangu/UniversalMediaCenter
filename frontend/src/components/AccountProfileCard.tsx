import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { UserProfile } from '@/services/authStore';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  profile: UserProfile;
  isCurrent: boolean;
  onSelect: (pin?: string) => Promise<{ success: boolean; error?: string }>;
}

export function AccountProfileCard({ profile, isCurrent, onSelect }: Props) {
  const [askingPin, setAskingPin] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleClick = async () => {
    if (profile.hasPin && !askingPin) {
      setAskingPin(true);
      return;
    }
    setLoading(true);
    setErr('');
    const res = await onSelect(pin.trim() || undefined);
    setLoading(false);
    if (!res.success) {
      setErr(res.error || 'Erreur');
    }
  };

  return (
    <View style={{ backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.6)', borderRadius: Radius.lg, borderWidth: 1, borderColor: isCurrent ? '#6366f1' : 'rgba(71, 85, 105, 0.3)', padding: Spacing.two, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: Radius.pill, backgroundColor: profile.isAdmin ? '#4338ca' : '#334155', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>{profile.displayName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 14 }}>{profile.displayName}</Text>
              {profile.isAdmin ? <Text style={{ color: '#818cf8', fontSize: 10, fontWeight: '800', backgroundColor: 'rgba(99, 102, 241, 0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill }}>👑 Admin</Text> : null}
              {profile.hasPin ? <Text style={{ fontSize: 11 }}>🔒</Text> : null}
            </View>
            <Text style={{ color: '#64748b', fontSize: 11 }}>{profile.email}</Text>
          </View>
        </View>

        {!askingPin && (
          <Pressable focusable={true} onPress={handleClick} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.3)' : '#6366f1' }}>
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 11 }}>{isCurrent ? 'Actif' : 'Sélectionner'}</Text>
          </Pressable>
        )}
      </View>

      {askingPin && (
        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(71, 85, 105, 0.25)' }}>
          <Text style={{ color: '#c7d2fe', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>Entrez le code PIN :</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TextInput style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, color: '#f8fafc', fontSize: 14 }} placeholder="Code PIN" placeholderTextColor="#64748b" secureTextEntry keyboardType="numeric" maxLength={6} value={pin} onChangeText={setPin} />
            <Pressable onPress={() => { setAskingPin(false); setErr(''); setPin(''); }} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: '#475569', justifyContent: 'center' }}><Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>Annuler</Text></Pressable>
            <Pressable onPress={handleClick} disabled={loading} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: '#6366f1', justifyContent: 'center' }}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>OK</Text>}
            </Pressable>
          </View>
          {err ? <Text style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>{err}</Text> : null}
        </View>
      )}
    </View>
  );
}
