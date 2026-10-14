import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { fetchAdminUsers, updateAdminUser, deleteAdminUser } from '@/services/adminApi';
import { styles } from './AdminScreen.styles';

export function AdminUsersTab() {
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    const list = await fetchAdminUsers();
    setUserList(list);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleToggleAdmin = async (user: any) => {
    const res = await updateAdminUser(user.id, { isAdmin: !user.isAdmin });
    if (res.success) {
      setMsg(`Rôle de ${user.displayName} mis à jour !`);
      loadUsers();
    } else {
      setMsg(`Erreur : ${res.error}`);
    }
  };

  const handleDelete = async (user: any) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Supprimer définitivement l'utilisateur ${user.displayName} ?`)
      : true;
    if (!confirmDelete) return;

    const res = await deleteAdminUser(user.id);
    if (res.success) {
      setMsg(`Utilisateur ${user.displayName} supprimé.`);
      loadUsers();
    } else {
      setMsg(`Erreur : ${res.error}`);
    }
  };

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={styles.cardTitle}>👥 Gestion des Profils & Permissions</Text>
        <Pressable onPress={loadUsers} style={[styles.statusPill, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
          <Text style={[styles.statusText, { color: '#818cf8' }]}>🔄 Actualiser</Text>
        </Pressable>
      </View>
      <Text style={styles.cardSub}>Créés à la volée ou par invitation. L’administrateur gère les droits et accès.</Text>
      {loading ? <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} /> : null}

      {userList.map((u) => (
        <View key={u.id} style={[styles.railRow, { alignItems: 'center' }]}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 14 }}>{u.displayName}</Text>
            <Text style={{ color: '#64748b', fontSize: 11 }}>{u.email}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Pressable
              onPress={() => handleToggleAdmin(u)}
              style={[styles.statusPill, { backgroundColor: u.isAdmin ? 'rgba(239, 68, 68, 0.2)' : 'rgba(51, 65, 85, 0.6)' }]}
            >
              <Text style={[styles.statusText, { color: u.isAdmin ? '#f87171' : '#94a3b8' }]}>
                {u.isAdmin ? '👑 Admin' : '👤 Membre'}
              </Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(u)} style={[styles.statusPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Text style={[styles.statusText, { color: '#ef4444' }]}>🗑️</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {msg ? <Text style={styles.statusMsg}>{msg}</Text> : null}
    </View>
  );
}
