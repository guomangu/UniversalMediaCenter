import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Linking, Platform } from 'react-native';
import {
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  fetchProfileTypes,
  fetchAdminInvitations,
  deleteAdminInvitation,
  AdminInvitation,
} from '@/services/adminApi';
import { AdminUserRow } from './AdminUserRow';
import { AdminCreateUserModal } from './AdminCreateUserModal';
import { AdminCreateInviteModal } from './AdminCreateInviteModal';
import { ConfirmModal } from './ConfirmModal';
import { styles } from './AdminScreen.styles';
import { Radius, Spacing } from '@/constants/theme';

export function AdminUsersTab() {
  const [userList, setUserList] = useState<any[]>([]);
  const [profileTypes, setProfileTypes] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [users, types, invites] = await Promise.all([
      fetchAdminUsers(),
      fetchProfileTypes(),
      fetchAdminInvitations(),
    ]);
    setUserList(users);
    setProfileTypes(types);
    setInvitations(invites);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdate = async (id: string, updates: any) => {
    const res = await updateAdminUser(id, updates);
    if (res.success) {
      setMsg('✅ Compte mis à jour.');
      loadData();
    } else {
      setMsg(`❌ Erreur : ${res.error}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setActionLoading(true);
    const res = await deleteAdminUser(userToDelete.id);
    setActionLoading(false);
    setUserToDelete(null);

    if (res.success) {
      setMsg(`✅ Utilisateur supprimé.`);
      loadData();
    } else {
      setMsg(`❌ Erreur : ${res.error}`);
    }
  };

  const handleDeleteInvite = async (id: string) => {
    const res = await deleteAdminInvitation(id);
    if (res.success) {
      setMsg('✅ Invitation révoquée.');
      loadData();
    }
  };

  const copyText = async (text: string, token: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2500);
    } catch {}
  };

  const openWhatsApp = (text: string) => {
    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return userList;
    return userList.filter(
      (u) =>
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.profileRole && u.profileRole.toLowerCase().includes(q))
    );
  }, [userList, searchQuery]);

  const adminCount = userList.filter((u) => u.isAdmin).length;

  return (
    <View style={styles.card}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <View>
          <Text style={styles.cardTitle}>👥 Gestion des Comptes & Attribution des Profils</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            {userList.length} compte{userList.length > 1 ? 's' : ''} ({adminCount} admin{adminCount > 1 ? 's' : ''})
            {invitations.length > 0 ? ` • ${invitations.length} lien${invitations.length > 1 ? 's' : ''} d'invitation actif${invitations.length > 1 ? 's' : ''}` : ''}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {/* BOUTON CRÉER UN LIEN PERSONNALISÉ */}
          <Pressable
            focusable={true}
            onPress={() => setShowInviteModal(true)}
            style={[styles.statusPill, { backgroundColor: '#10b981' }]}>
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 11 }}>
              🔗 Créer un lien personnalisé
            </Text>
          </Pressable>

          <Pressable
            focusable={true}
            onPress={() => setShowCreate(true)}
            style={[styles.statusPill, { backgroundColor: '#6366f1' }]}>
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 11 }}>+ Créer compte</Text>
          </Pressable>

          <Pressable
            focusable={true}
            onPress={loadData}
            style={[styles.statusPill, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
            <Text style={[styles.statusText, { color: '#818cf8' }]}>🔄</Text>
          </Pressable>
        </View>
      </View>

      {/* SECTION DES LIENS D'INVITATION PERSONNALISÉS ACTIFS */}
      {invitations.length > 0 && (
        <View
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            borderWidth: 1,
            borderColor: 'rgba(16, 185, 129, 0.25)',
            borderRadius: Radius.lg,
            padding: 12,
            marginBottom: 16,
          }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: '#6ee7b7', fontSize: 13, fontWeight: '700' }}>
              ✨ Liens d'accès direct WhatsApp / Instagram actifs ({invitations.length})
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            {invitations.map((inv) => (
              <View
                key={inv.id}
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.6)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: Radius.md,
                  padding: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 13 }}>
                      👤 {inv.displayName}
                    </Text>
                    <View
                      style={{
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: Radius.pill,
                      }}>
                      <Text style={{ color: '#a5b4fc', fontSize: 10, fontWeight: '700' }}>
                        {inv.profileRole}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                    Identifiant : <Text style={{ color: '#cbd5e1', fontWeight: '600' }}>{inv.email}</Text>
                    {inv.password ? ` • Mdp : ${inv.password}` : ''}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Pressable
                    focusable={true}
                    onPress={() => copyText(inv.messageText, inv.id + '_msg')}
                    style={{
                      backgroundColor: copiedToken === inv.id + '_msg' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.25)',
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: Radius.sm,
                    }}>
                    <Text style={{ color: copiedToken === inv.id + '_msg' ? '#6ee7b7' : '#c7d2fe', fontSize: 11, fontWeight: '700' }}>
                      {copiedToken === inv.id + '_msg' ? '✅ Invitation copiée !' : '📋 Copier invitation (Identifiant + MDP + Lien)'}
                    </Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => openWhatsApp(inv.messageText)}
                    style={{
                      backgroundColor: '#10b981',
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: Radius.sm,
                    }}>
                    <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>💬 WhatsApp</Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => copyText(inv.inviteUrl, inv.id + '_url')}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: Radius.sm,
                    }}>
                    <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600' }}>
                      {copiedToken === inv.id + '_url' ? '✅ Copié !' : '🔗 Lien'}
                    </Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => handleDeleteInvite(inv.id)}
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: Radius.sm,
                    }}>
                    <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '700' }}>🗑️</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Barre de recherche immunisée contre le remplissage automatique du navigateur */}
      <View style={{ position: 'relative', marginBottom: 12 }}>
        <TextInput
          style={[styles.input, { marginBottom: 0, paddingRight: searchQuery ? 36 : 14 }]}
          placeholder="🔍 Filtrer les comptes par nom, email ou pack..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          onChangeText={(text) => {
            // Rejette l'injection automatique par le navigateur en arrière-plan quand le champ n'a pas le focus actif
            if (!isSearchFocused && text.length > 0) {
              return;
            }
            setSearchQuery(text);
          }}
          autoComplete="off"
          textContentType="none"
          autoCorrect={false}
          autoCapitalize="none"
          {...({
            type: 'search',
            name: 'admin_users_search_filter',
            id: 'admin_users_search_filter',
            autoComplete: 'off',
            'data-lpignore': 'true',
            'data-1p-ignore': 'true',
            'data-form-type': 'other',
          } as any)}
        />
        {searchQuery ? (
          <Pressable
            focusable={true}
            onPress={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: 10,
              top: 10,
              padding: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: Radius.pill,
            }}>
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700' }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} /> : null}

      {filteredUsers.length === 0 && !loading ? (
        <Text style={{ color: '#64748b', textAlign: 'center', marginVertical: 16 }}>
          {searchQuery ? 'Aucun compte ne correspond à votre recherche.' : 'Aucun compte enregistré.'}
        </Text>
      ) : null}

      {filteredUsers.map((u) => (
        <AdminUserRow
          key={u.id}
          user={u}
          profileTypes={profileTypes}
          onUpdate={handleUpdate}
          onDelete={(target) => setUserToDelete(target)}
        />
      ))}

      {msg ? <Text style={styles.statusMsg}>{msg}</Text> : null}

      <AdminCreateUserModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadData}
      />

      <AdminCreateInviteModal
        visible={showInviteModal}
        profileTypes={profileTypes}
        onClose={() => setShowInviteModal(false)}
        onCreated={loadData}
      />

      <ConfirmModal
        visible={Boolean(userToDelete)}
        title="Supprimer ce compte"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le compte de ${userToDelete?.displayName} (${userToDelete?.email}) ?`}
        confirmText="Supprimer"
        confirmColor="#ef4444"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setUserToDelete(null)}
      />
    </View>
  );
}
