import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';
import { AdminUserTagManager } from './AdminUserTagManager';

interface Props {
  user: any;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onDelete: (user: any) => void;
}

const ROLES = ['STANDARD', 'ENFANT', 'ADO', 'ADMIN'];

export function AdminUserRow({ user, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [csaAge, setCsaAge] = useState(user.maxCsaAgeLimit ? String(user.maxCsaAgeLimit) : '');

  const cycleRole = () => {
    const current = user.profileRole || 'STANDARD';
    const nextIdx = (ROLES.indexOf(current) + 1) % ROLES.length;
    const nextRole = ROLES[nextIdx];
    onUpdate(user.id, { profileRole: nextRole, isAdmin: nextRole === 'ADMIN' });
  };

  return (
    <View style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.35)', padding: Spacing.two, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 14 }}>{user.displayName}</Text>
            {user.hasPassword ? <Text style={{ fontSize: 11 }}>🔑</Text> : null}
            <Pressable focusable={true} onPress={cycleRole} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm, backgroundColor: 'rgba(99, 102, 241, 0.2)' }}>
              <Text style={{ color: '#a5b4fc', fontSize: 10, fontWeight: '700' }}>{user.profileRole || 'STANDARD'}</Text>
            </Pressable>
          </View>
          <Text style={{ color: '#64748b', fontSize: 11 }}>{user.email}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pressable
            focusable={true}
            onPress={() => onUpdate(user.id, { isAdmin: !user.isAdmin })}
            style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: user.isAdmin ? 'rgba(99, 102, 241, 0.25)' : 'rgba(51, 65, 85, 0.6)' }}
          >
            <Text style={{ color: user.isAdmin ? '#a5b4fc' : '#94a3b8', fontSize: 11, fontWeight: '700' }}>
              {user.isAdmin ? '👑 Admin' : '👤 Membre'}
            </Text>
          </Pressable>

          <Pressable
            focusable={true}
            onPress={() => onUpdate(user.id, { canDownload: !user.canDownload })}
            style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: user.canDownload ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}
          >
            <Text style={{ color: user.canDownload ? '#34d399' : '#f87171', fontSize: 11, fontWeight: '700' }}>
              📥 {user.canDownload ? 'DL: On' : 'DL: Off'}
            </Text>
          </Pressable>

          <Pressable
            focusable={true}
            onPress={() => onUpdate(user.id, { canWatchIptv: !user.canWatchIptv })}
            style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: user.canWatchIptv ? 'rgba(56, 189, 248, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}
          >
            <Text style={{ color: user.canWatchIptv ? '#38bdf8' : '#f87171', fontSize: 11, fontWeight: '700' }}>
              📺 {user.canWatchIptv ? 'TV: On' : 'TV: Off'}
            </Text>
          </Pressable>

          <Pressable focusable={true} onPress={() => setExpanded(!expanded)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: 'rgba(71, 85, 105, 0.5)' }}>
            <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '700' }}>{expanded ? '▲ Masquer' : '▼ Permissions'}</Text>
          </Pressable>
        </View>
      </View>

      {expanded && (
        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(71, 85, 105, 0.3)', gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Contrôle parental (Âge CSA max) :</Text>
              <TextInput style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, fontSize: 12 }} placeholder="Ex: 10, 12, 16 ou vide" placeholderTextColor="#64748b" keyboardType="numeric" value={csaAge} onChangeText={setCsaAge} onBlur={() => onUpdate(user.id, { maxCsaAgeLimit: csaAge ? Number(csaAge) : null })} />
            </View>

            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Nouveau Mot de Passe :</Text>
              <TextInput style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, fontSize: 12 }} placeholder="Modifier mot de passe..." placeholderTextColor="#64748b" secureTextEntry value={newPassword} onChangeText={setNewPassword} onBlur={() => { if (newPassword && newPassword.length >= 4) { onUpdate(user.id, { password: newPassword }); setNewPassword(''); } }} />
            </View>

            <Pressable focusable={true} onPress={() => onDelete(user)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: 'rgba(239, 68, 68, 0.25)', marginTop: 14, marginLeft: 'auto' }}>
              <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800' }}>🗑️ Supprimer</Text>
            </Pressable>
          </View>

          <AdminUserTagManager
            allowedTags={user.allowedTags || []}
            blockedTags={user.blockedTags || []}
            blockedFolders={user.blockedFolders || []}
            onChangeAllowedTags={(tags) => onUpdate(user.id, { allowedTags: tags })}
            onChangeBlockedTags={(tags) => onUpdate(user.id, { blockedTags: tags })}
            onChangeBlockedFolders={(folders) => onUpdate(user.id, { blockedFolders: folders })}
          />
        </View>
      )}
    </View>
  );
}
