import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Modal } from 'react-native';
import { fetchPublicConfig, registerOnTheFly } from '@/services/adminApi';
import { styles } from './AdminScreen.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  onProfileCreated?: (user: any) => void;
}

export function QuickProfileModal({ visible, onClose, onProfileCreated }: Props) {
  const [cfg, setCfg] = useState<any>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (visible) { setErr(''); fetchPublicConfig().then(setCfg); }
  }, [visible]);

  const handleRegister = async () => {
    if (!name.trim()) return setErr('Veuillez entrer un pseudo ou prénom.');
    setLoading(true);
    setErr('');
    const res = await registerOnTheFly({
      displayName: name.trim(),
      pin: pin.trim() || undefined,
      invitationCode: code.trim() || undefined,
    });
    setLoading(false);
    if (res.success && res.user) {
      setName(''); setPin(''); setCode('');
      onProfileCreated?.(res.user);
      onClose();
    } else {
      setErr(res.error || 'Erreur de création de profil.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={[styles.card, { width: '100%', maxWidth: 440, backgroundColor: '#1e293b' }]}>
          <Text style={styles.cardTitle}>✨ Nouveau Profil Immédiat</Text>
          <Text style={styles.cardSub}>
            {cfg?.invitationOnly ? 'Ce site est sur invitation : code requis.' : 'Création à la volée pour naviguer librement.'}
          </Text>

          {cfg?.invitationOnly ? (
            <TextInput style={styles.input} placeholder="Code d’invitation" placeholderTextColor="#64748b" value={code} onChangeText={setCode} />
          ) : null}

          <TextInput style={styles.input} placeholder="Pseudo / Prénom" placeholderTextColor="#64748b" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Code PIN (Facultatif)" placeholderTextColor="#64748b" keyboardType="numeric" secureTextEntry maxLength={6} value={pin} onChangeText={setPin} />

          {err ? <Text style={[styles.statusMsg, { color: '#f87171' }]}>{err}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Pressable style={[styles.submitBtn, { flex: 1, backgroundColor: '#475569' }]} onPress={onClose}>
              <Text style={styles.submitText}>Annuler</Text>
            </Pressable>
            <Pressable style={[styles.submitBtn, { flex: 2 }, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Créer & Consulter</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
