import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { fetchAdminUsers, updateAdminUser, deleteAdminUser } from '@/services/adminApi';
import { AdminUserRow } from './AdminUserRow';
import { AdminCreateUserModal } from './AdminCreateUserModal';
import { styles } from './AdminScreen.styles';
import { Radius } from '@/constants/theme';

export function AdminUsersTab() {
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);

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
      setMsg('Compte mis à jour avec succès.');
      loadUsers();
    } else {
      setMsg(`Erreur : ${res.error}`);
    }
  };

  const handleDelete = async (user: any) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Supprimer définitivement l'utilisateur ${user.displayName} ?`)
      : true;
    if (!confirm) return;

    const res = await deleteAdminUser(user.id);
    if (res.success) {
      setMsg(`Utilisateur ${user.displayName} supprimé.`);
      loadUsers();
    } else {
      setMsg(`Erreur : ${res.error}`);
    }
  };

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

      {loading ? <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} /> : null}

      {userList.map((u) => (
        <AdminUserRow key={u.id} user={u} onUpdate={handleUpdate} onDelete={handleDelete} />
      ))}

      {msg ? <Text style={styles.statusMsg}>{msg}</Text> : null}

      <AdminCreateUserModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={loadUsers} />
    </View>
  );
}
