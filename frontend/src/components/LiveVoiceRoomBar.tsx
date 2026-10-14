import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { pingSession, MediaSession } from '@/services/sessionApi';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  sessionId: string;
  sessionTitle: string;
  isHost?: boolean;
  onRateHost?: (hostId: string, hostName: string) => void;
  hostUserId?: string;
  hostDisplayName?: string;
}

export function LiveVoiceRoomBar({
  sessionId,
  sessionTitle,
  isHost,
  onRateHost,
  hostUserId,
  hostDisplayName,
}: Props) {
  const [isMuted, setIsMuted] = useState(false);
  const [sessionData, setSessionData] = useState<MediaSession | null>(null);
  const timerRef = useRef<any>(null);

  const doPing = async () => {
    if (!sessionId) return;
    const res = await pingSession(sessionId, { isMuted });
    if (res) {
      setSessionData(res);
    }
  };

  useEffect(() => {
    doPing();
    timerRef.current = setInterval(doPing, 3000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId, isMuted]);

  const participants = sessionData?.participants || [];
  const activeVoiceCount = participants.filter((p) => !p.isMuted).length;

  return (
    <View style={styles.bar}>
      <View style={styles.infoCol}>
        <View style={styles.titleRow}>
          <Text style={styles.liveDot}>🔴</Text>
          <Text style={styles.sessionName} numberOfLines={1}>
            Discussion Directe • {sessionTitle}
          </Text>
          <View style={styles.activePill}>
            <Text style={styles.activeTxt}>
              🎙️ {activeVoiceCount}/{participants.length} en direct
            </Text>
          </View>
        </View>

        {participants.length > 0 ? (
          <View style={styles.avatarsRow}>
            {participants.map((p, idx) => (
              <View key={idx} style={[styles.participantChip, p.isMuted && styles.mutedChip]}>
                <Text style={styles.participantName}>
                  {p.isMuted ? '🔇' : '🗣️'} {p.displayName} {p.isHost ? '👑' : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        {/* Mode Silence vs Entendre la discussion */}
        <Pressable
          focusable={true}
          onPress={() => setIsMuted((prev) => !prev)}
          style={[styles.toggleBtn, isMuted ? styles.mutedBtn : styles.unmutedBtn]}
        >
          <Text style={styles.toggleBtnTxt}>
            {isMuted ? '🔇 Mode Silence' : '🎙️ Entendre la discussion'}
          </Text>
        </Pressable>

        {/* Noter le gérant de la séance */}
        {hostUserId && onRateHost ? (
          <Pressable
            focusable={true}
            onPress={() => onRateHost(hostUserId, hostDisplayName || 'Gérant')}
            style={styles.rateBtn}
          >
            <Text style={styles.rateBtnTxt}>⭐ Noter le gérant</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCol: { flex: 1, minWidth: 260, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { fontSize: 10 },
  sessionName: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  activePill: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  activeTxt: { color: '#c7d2fe', fontSize: 10, fontWeight: '700' },
  avatarsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  participantChip: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  mutedChip: { opacity: 0.6 },
  participantName: { color: '#e2e8f0', fontSize: 11, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  unmutedBtn: {
    backgroundColor: '#10b981',
  },
  mutedBtn: {
    backgroundColor: '#475569',
  },
  toggleBtnTxt: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  rateBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  rateBtnTxt: { color: '#fbbf24', fontSize: 12, fontWeight: '800' },
});
