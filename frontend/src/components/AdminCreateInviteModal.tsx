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
                  <Text style={modalStyles.msgHeaderTitle}>Message pour WhatsApp / Instagram / SMS :</Text>
                  <Pressable
                    focusable={true}
                    onPress={() => copyToClipboard(result.messageText, 'MSG')}
                    style={[modalStyles.copyPill, copiedType === 'MSG' && modalStyles.copyPillActive]}
                  >
                    <Text style={modalStyles.copyPillTxt}>
                      {copiedType === 'MSG' ? '✅ Copié !' : '📋 Copier tout'}
                    </Text>
                  </Pressable>
                </View>

                <View style={modalStyles.msgBox}>
                  <Text style={modalStyles.msgBoxTxt}>{result.messageText}</Text>
                </View>

                {/* Boutons d'actions directes */}
                <View style={modalStyles.actionsRow}>
                  <Pressable
                    focusable={true}
                    onPress={() => shareToWhatsApp(result.messageText)}
                    style={modalStyles.whatsAppBtn}
                  >
                    <Text style={modalStyles.whatsAppBtnTxt}>💬 Ouvrir WhatsApp</Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => copyToClipboard(result.messageText, 'MSG')}
                    style={[modalStyles.urlCopyBtn, copiedType === 'MSG' && { backgroundColor: 'rgba(16, 185, 129, 0.25)', borderColor: '#10b981' }]}
                  >
                    <Text style={modalStyles.urlCopyBtnTxt}>
                      {copiedType === 'MSG' ? '✅ Invitation copiée !' : '📋 Copier texte + lien'}
                    </Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => copyToClipboard(result.inviteUrl, 'URL')}
                    style={[modalStyles.urlCopyBtn, { flex: 0.8, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.12)' }]}
                  >
                    <Text style={[modalStyles.urlCopyBtnTxt, { color: '#94a3b8' }]}>
                      {copiedType === 'URL' ? '✅ Lien copié !' : '🔗 Lien seul'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Aperçu de la vignette de partage (Rich Preview WhatsApp / Instagram) */}
              <View style={modalStyles.previewContainer}>
                <Text style={modalStyles.previewHeader}>Aperçu de la vignette dans WhatsApp / Instagram :</Text>
                <View style={modalStyles.socialCard}>
                  <Text style={modalStyles.socialCardTitle}>{result.previewTitle}</Text>
                  <Text style={modalStyles.socialCardDesc}>{result.previewDescription}</Text>
                  <Text style={modalStyles.socialCardUrl}>cool.sweaw.com</Text>
                </View>
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
            /* ================= FORMULAIRE DE PERSONNALISATION ================= */
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Nom / Prénom de la personne */}
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>Nom ou Prénom du futur utilisateur *</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="Ex : Lucas, Marie, Papa..."
                  placeholderTextColor="#64748b"
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
              </View>

              {/* Identifiant / Email personnalisé */}
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>Identifiant de connexion (Email ou pseudo) *</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder={name ? `${name.toLowerCase().replace(/\s+/g, '')}@sweaw.com` : 'Ex : lucas@famille.fr'}
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
                <Text style={modalStyles.fieldHint}>
                  {email
                    ? `Identifiant choisi : ${email}`
                    : `Par défaut : ${name ? name.toLowerCase().replace(/\s+/g, '') + '@sweaw.com' : 'automatique'}`}
                </Text>
              </View>

              {/* Mot de passe personnalisé ou auto-généré */}
              <View style={modalStyles.fieldGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  placeholder="Mot de passe simple..."
                  placeholderTextColor="#64748b"
                  value={customPassword}
                  onChangeText={setCustomPassword}
                  autoCapitalize="none"
                />
                <Text style={modalStyles.fieldHint}>
                  La personne n'aura même pas besoin de le saisir si elle clique sur le lien !
                </Text>
              </View>

              {/* Profil & Permissions */}
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>Pack & Profil d'accès</Text>
                <View style={modalStyles.roleRow}>
                  {['MEMBRE', 'ENFANT', 'SAFEZONE', 'SEULEMENT_DES_MARVEL', 'ADMINISTRATEUR'].map((r) => {
                    const active = role === r;
                    const matched = profileTypes.find((p) => p.id === r);
                    const label = matched?.label || r;
                    return (
                      <Pressable
                        key={r}
                        focusable={true}
                        onPress={() => setRole(r)}
                        style={[modalStyles.rolePill, active && modalStyles.rolePillActive]}
                      >
                        <Text style={[modalStyles.rolePillTxt, active && modalStyles.rolePillTxtActive]}>
                          {active ? '✓ ' : ''}{label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Option avancée : Slug personnalisé */}
              <Pressable
                focusable={true}
                onPress={() => setShowAdvanced(!showAdvanced)}
                style={modalStyles.toggleAdvanced}
              >
                <Text style={modalStyles.toggleAdvancedTxt}>
                  {showAdvanced ? '▼ Masquer l’URL personnalisée' : '▶ Personnaliser l’URL du lien (optionnel)'}
                </Text>
              </Pressable>

              {showAdvanced && (
                <View style={[modalStyles.fieldGroup, { marginTop: 8 }]}>
                  <Text style={modalStyles.fieldLabel}>Terminaison du lien (/invite/...)</Text>
                  <TextInput
                    style={modalStyles.input}
                    placeholder="Ex : lucas (pour /invite/lucas)"
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                    value={customSlug}
                    onChangeText={setCustomSlug}
                  />
                </View>
              )}

              {/* Bouton de soumission */}
              <Pressable
                focusable={true}
                disabled={loading}
                onPress={handleGenerate}
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
    lineHeight: 17,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  closeBtnTxt: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  alertError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 12,
  },
  alertErrorTxt: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
  },
  regenBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: Radius.pill,
  },
  regenBtnTxt: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '700',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  rolePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  rolePillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366f1',
  },
  rolePillTxt: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  rolePillTxtActive: {
    color: '#c7d2fe',
    fontWeight: '700',
  },
  toggleAdvanced: {
    marginVertical: 4,
  },
  toggleAdvancedTxt: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 13,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnTxt: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  successBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 14,
    alignItems: 'center',
  },
  successBadgeTxt: {
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: '700',
  },
  msgContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    marginBottom: 14,
  },
  msgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  msgHeaderTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  copyPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  copyPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  copyPillTxt: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '700',
  },
  msgBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  msgBoxTxt: {
    color: '#edeef2',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  whatsAppBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  whatsAppBtnTxt: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  urlCopyBtn: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  urlCopyBtnTxt: {
    color: '#c7d2fe',
    fontSize: 12,
    fontWeight: '700',
  },
  previewContainer: {
    marginBottom: 16,
  },
  previewHeader: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  socialCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radius.md,
    padding: 10,
    gap: 4,
  },
  socialCardTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  socialCardDesc: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
  },
  socialCardUrl: {
    color: '#64748b',
    fontSize: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 10,
  },
  newInviteBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  newInviteBtnTxt: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  doneBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  doneBtnTxt: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
