import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { fetchAdminUsers, updateAdminUser, deleteAdminUser } from '@/services/adminApi';
import { AdminUserRow } from './AdminUserRow';
import { AdminCreateUserModal } from './AdminCreateUserModal';
import { ConfirmModal } from './ConfirmModal';
import { styles } from './AdminScreen.styles';

export function AdminUsersTab() {
  const [userList, setUserList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  const loadUsers = async () => {
    setLoading(true);
    const list = await fetchAdminUsers();
    setUserList(list);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleUpdate = async (id: string, updates: any) => {
    const res = await updateAdminUser(id, updates);
    if (res.success) {
      setMsg('✅ Compte mis à jour.');
      loadUsers();
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
      loadUsers();
    } else {
      setMsg(`❌ Erreur : ${res.error}`);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return userList;
    return userList.filter((u) =>
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.profileRole && u.profileRole.toLowerCase().includes(q))
    );
  }, [userList, searchQuery]);

  const adminCount = userList.filter((u) => u.isAdmin).length;

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <View>
          <Text style={styles.cardTitle}>👥 Gestion des Profils & Permissions</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            {userList.length} compte{userList.length > 1 ? 's' : ''} ({adminCount} admin{adminCount > 1 ? 's' : ''})
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable focusable={true} onPress={() => setShowCreate(true)} style={[styles.statusPill, { backgroundColor: '#6366f1' }]}>
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 11 }}>+ Créer</Text>
          </Pressable>
          <Pressable focusable={true} onPress={loadUsers} style={[styles.statusPill, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
            <Text style={[styles.statusText, { color: '#818cf8' }]}>🔄</Text>
          </Pressable>
        </View>
      </View>

      {/* Barre de recherche pour gérer un grand nombre de comptes */}
      <TextInput
        style={[styles.input, { marginBottom: 12 }]}
        placeholder="🔍 Filtrer les comptes par nom, email ou profil..."
        placeholderTextColor="#64748b"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {loading ? <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} /> : null}

      {filteredUsers.length === 0 && !loading ? (
        <Text style={{ color: '#64748b', textAlign: 'center', marginVertical: 16 }}>
          {searchQuery ? 'Aucun compte ne correspond à votre recherche.' : 'Aucun compte enregistré.'}
        </Text>
      ) : null}

      {filteredUsers.map((u) => (
        <AdminUserRow key={u.id} user={u} onUpdate={handleUpdate} onDelete={(target) => setUserToDelete(target)} />
      ))}

      {msg ? <Text style={styles.statusMsg}>{msg}</Text> : null}

      <AdminCreateUserModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={loadUsers} />

      <ConfirmModal
        visible={!!userToDelete}
        title="Confirmation de suppression"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le compte "${userToDelete?.displayName}" (${userToDelete?.email}) ? Cette action est irréversible.`}
        confirmText="Supprimer définitivement"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setUserToDelete(null)}
      />
    </View>
  );
}
