import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import { createAdminInvitation, AdminInvitation } from '@/services/adminApi';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  profileTypes?: any[];
  onClose: () => void;
  onCreated: () => void;
}

export function AdminCreateInviteModal({ visible, profileTypes = [], onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [role, setRole] = useState('MEMBRE');
  const [customSlug, setCustomSlug] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AdminInvitation | null>(null);
  const [copiedType, setCopiedType] = useState<'MSG' | 'URL' | null>(null);

  // Générateur de mot de passe convivial (mémorisable et simple pour l'invité)
  const generateAutoPassword = () => {
    const words = ['Soleil', 'Cinema', 'Etoile', 'Voyage', 'Musique', 'Azur', 'Galaxy', 'Pixel', 'Tempo'];
    const randomWord = words[Math.floor(Math.random() * words.length)];
    const randomDigits = Math.floor(100 + Math.random() * 900);
    return `${randomWord}${randomDigits}!`;
  };

  useEffect(() => {
    if (visible && !customPassword) {
      setCustomPassword(generateAutoPassword());
    }
  }, [visible]);

  // Si le modal est fermé, on ne rend rien dans le DOM pour éviter tout autofill parasite
  if (!visible) return null;

  const handleGenerate = async () => {
    if (!name.trim()) {
      setError('Veuillez entrer le nom ou prénom de la personne invitée.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await createAdminInvitation({
        recipientName: name.trim(),
        recipientEmail: email.trim().toLowerCase() || undefined,
        customPassword: customPassword.trim() || undefined,
        profileRole: role,
        customSlug: customSlug.trim() || undefined,
      });

      setLoading(false);
      if (res.success && res.invitation) {
        setResult(res.invitation);
        onCreated();
      } else {
        setError(res.error || 'Erreur lors de la création du lien personnalisé.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Erreur réseau');
    }
  };

  const copyToClipboard = async (text: string, type: 'MSG' | 'URL') => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  const shareToWhatsApp = (text: string) => {
    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setCustomSlug('');
    setCustomPassword(generateAutoPassword());
    setResult(null);
    setError('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <Pressable
          focusable={false}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          {...({ dataSet: { modalBackdrop: 'true' } } as any)}
        />
        <View style={modalStyles.card}>
          <View style={modalStyles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.title}>🔗 Créer un lien personnalisé</Text>
              <Text style={modalStyles.sub}>
                Lien magique en 1 clic pour WhatsApp, Instagram ou SMS avec identifiant et mot de passe intégrés.
              </Text>
            </View>
            <Pressable focusable={true} style={modalStyles.closeBtn} onPress={onClose}>
              <Text style={modalStyles.closeBtnTxt}>✕</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={modalStyles.alertError}>
              <Text style={modalStyles.alertErrorTxt}>⚠️ {error}</Text>
            </View>
          ) : null}

          {result ? (
            /* ================= ÉCRAN DE SUCCÈS & PARTAGE ================= */
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <View style={modalStyles.successBadge}>
                <Text style={modalStyles.successBadgeTxt}>✅ Lien personnalisé prêt à être partagé !</Text>
              </View>

              {/* Encadré du message prêt à envoyer */}
              <View style={modalStyles.msgContainer}>
                <View style={modalStyles.msgHeader}>
                  <Text style={modalStyles.msgHeaderTitle}>Message d'accueil pré-rédigé :</Text>
                  <Pressable
                    focusable={true}
                    onPress={() => copyToClipboard(result.fullInvitationMessage || result.messageText || '', 'MSG')}
                    style={modalStyles.copyIconBtn}
                  >
                    <Text style={modalStyles.copyIconBtnTxt}>
                      {copiedType === 'MSG' ? '✅ Copié !' : '📋 Copier le message'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={modalStyles.msgText}>{result.fullInvitationMessage || result.messageText}</Text>
              </View>

              {/* Boutons de partage 1-clic */}
              <View style={modalStyles.shareActionRow}>
                <Pressable
                  focusable={true}
                  onPress={() => shareToWhatsApp(result.fullInvitationMessage || result.messageText || '')}
                  style={[modalStyles.shareBtn, modalStyles.whatsappBtn]}
                >
                  <Text style={modalStyles.shareBtnTxt}>💬 Partager sur WhatsApp</Text>
                </Pressable>
                <Pressable
                  focusable={true}
                  onPress={() => copyToClipboard(result.inviteUrl, 'URL')}
                  style={[modalStyles.shareBtn, modalStyles.copyUrlBtn]}
                >
                  <Text style={modalStyles.shareBtnTxt}>
                    {copiedType === 'URL' ? '✅ Lien copié !' : '🔗 Copier le lien seul'}
                  </Text>
                </Pressable>
              </View>

              {/* Détails du lien généré */}
              <View style={modalStyles.urlBox}>
                <Text style={modalStyles.urlLabel}>Lien magique direct :</Text>
                <Text style={modalStyles.urlValue} numberOfLines={2}>
                  {result.inviteUrl}
                </Text>
              </View>

              <View style={modalStyles.bottomRow}>
                <Pressable focusable={true} onPress={resetForm} style={modalStyles.newInviteBtn}>
                  <Text style={modalStyles.newInviteBtnTxt}>+ Créer une autre invitation</Text>
                </Pressable>
                <Pressable focusable={true} onPress={onClose} style={modalStyles.doneBtn}>
                  <Text style={modalStyles.doneBtnTxt}>Terminer</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            /* ================= FORMULAIRE DE CRÉATION ================= */
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>Nom ou Prénom du futur utilisateur *</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="Ex : Lucas, Sarah, Tonton Jean..."
                  placeholderTextColor="#64748b"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>Identifiant de connexion (Email ou pseudo) *</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="lucas@famille.fr ou lucas"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={modalStyles.fieldGroup}>
                <View style={modalStyles.fieldLabelRow}>
                  <Text style={modalStyles.fieldLabel}>Mot de passe attribué *</Text>
                  <Pressable
                    focusable={true}
                    onPress={() => setCustomPassword(generateAutoPassword())}
                    style={modalStyles.regenBtn}
                  >
                    <Text style={modalStyles.regenBtnTxt}>🔄 Régénérer</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={modalStyles.input}
                  value={customPassword}
                  onChangeText={setCustomPassword}
                  placeholder="Mot de passe simple"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>Pack & Profil d'accès</Text>
                <View style={modalStyles.roleRow}>
                  {['MEMBRE', 'ENFANT', 'ADOLESCENT', 'INVITE'].map((r) => {
                    const active = role === r;
                    return (
                      <Pressable
                        key={r}
                        focusable={true}
                        onPress={() => setRole(r)}
                        style={[modalStyles.rolePill, active && modalStyles.rolePillActive]}
                      >
                        <Text style={[modalStyles.rolePillTxt, active && modalStyles.rolePillTxtActive]}>
                          {r}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Options avancées (Slug personnalisé) */}
              <Pressable
                focusable={true}
                onPress={() => setShowAdvanced(!showAdvanced)}
                style={modalStyles.toggleAdvanced}
              >
                <Text style={modalStyles.toggleAdvancedTxt}>
                  {showAdvanced ? '▾ Masquer les options avancées' : '▸ Personnaliser l’adresse du lien (optionnel)'}
                </Text>
              </Pressable>

              {showAdvanced && (
                <View style={[modalStyles.fieldGroup, { marginTop: 8 }]}>
                  <Text style={modalStyles.fieldLabel}>Terminaison du lien (/invite/...)</Text>
                  <TextInput
                    style={modalStyles.input}
                    placeholder="ex: pour-lucas"
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                    value={customSlug}
                    onChangeText={setCustomSlug}
                  />
                </View>
              )}

              <Pressable
                focusable={true}
                onPress={handleGenerate}
                disabled={loading}
                style={[modalStyles.submitBtn, loading && { opacity: 0.6 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={modalStyles.submitBtnTxt}>🚀 Générer le lien & le message d'invitation</Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(29, 33, 39, 0.98)',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  sub: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeBtnTxt: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  alertError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: Spacing.three,
  },
  alertErrorTxt: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: Spacing.three,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
    padding: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  regenBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  regenBtnTxt: {
    fontSize: 11,
    color: '#818cf8',
    fontWeight: '700',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  rolePill: {
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  rolePillActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  rolePillTxt: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  rolePillTxtActive: {
    color: '#ffffff',
  },
  toggleAdvanced: {
    paddingVertical: 6,
    marginBottom: 8,
  },
  toggleAdvancedTxt: {
    fontSize: 12,
    color: '#818cf8',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  submitBtnTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  successBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: Spacing.three,
  },
  successBadgeTxt: {
    color: '#34d399',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  msgContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
    marginBottom: Spacing.three,
  },
  msgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  msgHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  copyIconBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  copyIconBtnTxt: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '700',
  },
  msgText: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 19,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shareActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.three,
  },
  shareBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappBtn: {
    backgroundColor: '#16a34a',
  },
  copyUrlBtn: {
    backgroundColor: '#4338ca',
  },
  shareBtnTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  urlBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.3)',
    marginBottom: Spacing.four,
  },
  urlLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
  },
  urlValue: {
    fontSize: 12,
    color: '#38bdf8',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  newInviteBtn: {
    paddingVertical: 8,
  },
  newInviteBtnTxt: {
    color: '#818cf8',
    fontSize: 13,
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  doneBtnTxt: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
});
