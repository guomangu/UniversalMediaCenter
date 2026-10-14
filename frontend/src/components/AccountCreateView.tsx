import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { registerOnTheFly, fetchPublicConfig } from '@/services/adminApi';
import { loginWithProfile } from '@/services/authStore';
import { styles } from './AccountModal.styles';

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

export function AccountCreateView({ onCreated, onCancel }: Props) {
  const [cfg, setCfg] = useState<any>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { fetchPublicConfig().then(setCfg); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return setErr('Veuillez saisir un pseudo ou prénom.');
    setLoading(true);
    setErr('');

    const res = await registerOnTheFly({
      displayName: name.trim(),
      pin: pin.trim() || undefined,
      invitationCode: code.trim() || undefined,
    });

    if (res.success && res.user) {
      // Connexion immédiate
      await loginWithProfile(res.user.id, pin.trim() || undefined);
      setLoading(false);
      onCreated();
    } else {
      setLoading(false);
      setErr(res.error || 'Erreur lors de la création du profil.');
    }
  };

  return (
    <View>
      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
        {cfg?.invitationOnly ? 'Serveur privé : code d’invitation requis.' : 'Créez votre profil en 2 secondes sans mot de passe complexe.'}
      </Text>

      {cfg?.invitationOnly ? (
        <TextInput style={styles.input} placeholder="Code d’invitation requis" placeholderTextColor="#64748b" value={code} onChangeText={setCode} />
      ) : null}

      <TextInput style={styles.input} placeholder="Pseudo / Prénom (ex: Alice, Salon...)" placeholderTextColor="#64748b" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Code PIN à 4 chiffres (optionnel)" placeholderTextColor="#64748b" keyboardType="numeric" secureTextEntry maxLength={6} value={pin} onChangeText={setPin} />

      {err ? <Text style={styles.errorText}>{err}</Text> : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Pressable onPress={onCancel} style={[styles.submitBtn, { flex: 1, backgroundColor: '#475569' }]}>
          <Text style={styles.submitText}>Retour</Text>
        </Pressable>
        <Pressable onPress={handleCreate} disabled={loading} style={[styles.submitBtn, { flex: 2 }]}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Créer & Se connecter</Text>}
        </Pressable>
      </View>
    </View>
  );
}
