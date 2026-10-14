import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  user: any;
  profileTypes?: any[];
  onUpdate: (id: string, updates: any) => Promise<void>;
  onDelete: (user: any) => void;
}

export function AdminUserRow({ user, profileTypes = [], onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [csaAge, setCsaAge] = useState(user.maxCsaAgeLimit ? String(user.maxCsaAgeLimit) : '');

  const availableRoles = profileTypes.length > 0
    ? profileTypes.map((p) => p.id)
    : ['ADMINISTRATEUR', 'MEMBRE', 'ENFANT', 'SAFEZONE', 'SEULEMENT_DES_MARVEL'];

  const currentRole = (user.profileRole || (user.isAdmin ? 'ADMINISTRATEUR' : 'MEMBRE')).toUpperCase();
  const matchedType = profileTypes.find((p) => p.id.toUpperCase() === currentRole);
  const roleLabel = matchedType?.label || currentRole;
  const isAdminAccount = Boolean(user.isAdmin || currentRole === 'ADMINISTRATEUR');

  // Définition visuelle du bouton unifié (Rôle / Pack)
  let badgeIcon = '🏷️';
  let badgeBg = 'rgba(99, 102, 241, 0.25)';
  let borderColor = '#6366f1';
  let textColor = '#a5b4fc';

  if (isAdminAccount) {
    badgeIcon = '👑';
    badgeBg = 'rgba(234, 179, 8, 0.25)';
    borderColor = '#eab308';
    textColor = '#fef08a';
  } else if (currentRole === 'MEMBRE') {
    badgeIcon = '👤';
    badgeBg = 'rgba(59, 130, 246, 0.25)';
    borderColor = '#3b82f6';
    textColor = '#93c5fd';
  } else if (currentRole === 'ENFANT') {
    badgeIcon = '👶';
    badgeBg = 'rgba(16, 185, 129, 0.25)';
    borderColor = '#10b981';
    textColor = '#6ee7b7';
  } else if (currentRole === 'SAFEZONE') {
    badgeIcon = '🛡️';
    badgeBg = 'rgba(14, 165, 233, 0.25)';
    borderColor = '#0ea5e9';
    textColor = '#7dd3fc';
  } else if (currentRole === 'SEULEMENT_DES_MARVEL') {
    badgeIcon = '🦸';
    badgeBg = 'rgba(239, 68, 68, 0.25)';
    borderColor = '#ef4444';
    textColor = '#fca5a5';
  }

  // Le bouton unifié alterne les types de profils / rôles
  const cyclePackAndRole = () => {
    const nextIdx = (availableRoles.indexOf(currentRole) + 1) % availableRoles.length;
    const nextRole = availableRoles[nextIdx];
    const isNextAdmin = nextRole === 'ADMINISTRATEUR' || Boolean(profileTypes.find((p) => p.id === nextRole)?.isAdmin);

    if (isNextAdmin) {
      onUpdate(user.id, {
        profileRole: nextRole,
        isAdmin: true,
        canDownload: true,
        canWatchIptv: true,
        maxCsaAgeLimit: null,
        blockedTags: [],
        blockedFolders: [],
      });
    } else {
      onUpdate(user.id, {
        profileRole: nextRole,
        isAdmin: false,
      });
    }
  };

  return (
    <View style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.35)', padding: Spacing.two, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 14 }}>{user.displayName}</Text>
            {user.hasPassword ? <Text style={{ fontSize: 11 }}>🔑</Text> : null}
          </View>
          <Text style={{ color: '#64748b', fontSize: 11 }}>{user.email}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Bouton Unique : Fusion Complète Membre / Admin et Pack de Profil */}
          <Pressable
            focusable={true}
            onPress={cyclePackAndRole}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: Radius.pill,
              backgroundColor: badgeBg,
              borderWidth: 1,
              borderColor: borderColor,
            }}
          >
            <Text style={{ color: textColor, fontSize: 11, fontWeight: '800' }}>
              {badgeIcon} {roleLabel}
            </Text>
          </Pressable>

          {/* Téléchargements : Tout autorisé d'office pour Administrateur */}
          <Pressable
            focusable={!isAdminAccount}
            disabled={isAdminAccount}
            onPress={() => onUpdate(user.id, { canDownload: !user.canDownload })}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: Radius.pill,
              backgroundColor: (isAdminAccount || user.canDownload) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            }}
          >
            <Text style={{ color: (isAdminAccount || user.canDownload) ? '#34d399' : '#f87171', fontSize: 11, fontWeight: '700' }}>
              📥 {isAdminAccount ? 'DL: Illimité' : (user.canDownload ? 'DL: On' : 'DL: Off')}
            </Text>
          </Pressable>

          {/* TV Live : Tout autorisé d'office pour Administrateur */}
          <Pressable
            focusable={!isAdminAccount}
            disabled={isAdminAccount}
            onPress={() => onUpdate(user.id, { canWatchIptv: !user.canWatchIptv })}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: Radius.pill,
              backgroundColor: (isAdminAccount || user.canWatchIptv) ? 'rgba(56, 189, 248, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            }}
          >
            <Text style={{ color: (isAdminAccount || user.canWatchIptv) ? '#38bdf8' : '#f87171', fontSize: 11, fontWeight: '700' }}>
              📺 {isAdminAccount ? 'TV: Illimité' : (user.canWatchIptv ? 'TV: On' : 'TV: Off')}
            </Text>
          </Pressable>

          <Pressable focusable={true} onPress={() => setExpanded(!expanded)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: 'rgba(71, 85, 105, 0.5)' }}>
            <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '700' }}>{expanded ? '▲ Masquer' : '▼ Paramètres'}</Text>
          </Pressable>
        </View>
      </View>

      {expanded && (
        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(71, 85, 105, 0.3)', gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Contrôle parental (Âge CSA max) :</Text>
              {isAdminAccount ? (
                <Text style={{ color: '#fef08a', fontSize: 12, fontStyle: 'italic', paddingVertical: 4 }}>
                  👑 Tout autorisé obligatoirement (Accès illimité)
                </Text>
              ) : (
                <TextInput
                  style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, fontSize: 12 }}
                  placeholder="Ex: 10, 12, 16 ou vide"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  value={csaAge}
                  onChangeText={setCsaAge}
                  onBlur={() => onUpdate(user.id, { maxCsaAgeLimit: csaAge ? Number(csaAge) : null })}
                />
              )}
            </View>

            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Nouveau Mot de Passe :</Text>
              <TextInput
                style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, fontSize: 12 }}
                placeholder="Modifier mot de passe..."
                placeholderTextColor="#64748b"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                onBlur={() => { if (newPassword && newPassword.length >= 4) { onUpdate(user.id, { password: newPassword }); setNewPassword(''); } }}
              />
            </View>

            <Pressable focusable={true} onPress={() => onDelete(user)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: 'rgba(239, 68, 68, 0.25)', marginTop: 14, marginLeft: 'auto' }}>
              <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800' }}>🗑️ Supprimer</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
