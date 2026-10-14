import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import {
  pingVoiceCall,
  leaveVoiceCall,
  sendVoiceAudioChunk,
  getVoiceAudioChunks,
  SessionParticipant,
} from '@/services/sessionApi';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  topicSlug: string;
  topicTitle: string;
  onLeaveCall: () => void;
}

export function LiveVoiceRoomBar({
  topicSlug,
  topicTitle,
  onLeaveCall,
}: Props) {
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [isLiveSpeaking, setIsLiveSpeaking] = useState(false);
  const timerRef = useRef<any>(null);
  const pollChunksTimerRef = useRef<any>(null);
  const lastChunkTimestampRef = useRef<number>(Date.now() - 3000);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const currentRecorderRef = useRef<MediaRecorder | null>(null);
  const stopTimeoutRef = useRef<any>(null);

  // File d'attente audio séquentielle pour éviter toute cacophonie ou coupure de son
  const audioQueueRef = useRef<{ id: string; url: string }[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const playedChunkIdsRef = useRef<Set<string>>(new Set());

  const playNextInQueue = () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    const item = audioQueueRef.current.shift();
    if (!item) return;

    isPlayingRef.current = true;
    try {
      const audio = new Audio(item.url);
      const finish = () => {
        isPlayingRef.current = false;
        playNextInQueue();
      };
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);
    } catch {
      isPlayingRef.current = false;
      playNextInQueue();
    }
  };

  // Ping de présence et rafraîchissement des participants
  const doPing = async () => {
    if (!topicSlug) return;
    const res = await pingVoiceCall(topicSlug, isMuted);
    if (res.success && res.participants) {
      setParticipants(res.participants);
    }
  };

  useEffect(() => {
    doPing();
    timerRef.current = setInterval(doPing, 3000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [topicSlug, isMuted]);

  // Écoute continue et ordonnancée des flux vocaux des autres participants
  useEffect(() => {
    if (!topicSlug || Platform.OS !== 'web') return;

    pollChunksTimerRef.current = setInterval(async () => {
      try {
        const chunks = await getVoiceAudioChunks(topicSlug, lastChunkTimestampRef.current);
        if (chunks && chunks.length > 0) {
          for (const c of chunks) {
            lastChunkTimestampRef.current = Math.max(lastChunkTimestampRef.current, c.timestamp);
            if (c.id && !playedChunkIdsRef.current.has(c.id) && c.audioBase64) {
              playedChunkIdsRef.current.add(c.id);
              // Limiter la taille du set de tracking
              if (playedChunkIdsRef.current.size > 200) {
                const arr = Array.from(playedChunkIdsRef.current);
                playedChunkIdsRef.current = new Set(arr.slice(arr.length - 100));
              }

              const audioSrc = `data:${c.mimeType || 'audio/webm'};base64,${c.audioBase64}`;
              audioQueueRef.current.push({ id: c.id, url: audioSrc });
              playNextInQueue();
            }
          }
        }
      } catch {}
    }, 1200);

    return () => {
      if (pollChunksTimerRef.current) clearInterval(pollChunksTimerRef.current);
      audioQueueRef.current = [];
      isPlayingRef.current = false;
    };
  }, [topicSlug]);

  // Envoi de flux vocal continu lorsque le micro est actif (non muet)
  // Utilisation de fragments fermés autonomes (MediaRecorder.stop() toutes les 2.5s)
  // garantissant un en-tête EBML/Audio valide sur 100% des fragments envoyés
  useEffect(() => {
    if (isMuted || Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      if (currentRecorderRef.current && currentRecorderRef.current.state !== 'inactive') {
        try { currentRecorderRef.current.stop(); } catch {}
      }
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setIsLiveSpeaking(false);
      return;
    }

    let isCancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((stream) => {
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        setIsLiveSpeaking(true);

        const recordNextSlice = () => {
          if (isCancelled || !mediaStreamRef.current || !mediaStreamRef.current.active) return;

          let mimeType = 'audio/webm';
          if (typeof MediaRecorder !== 'undefined') {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
              mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
              mimeType = 'audio/webm';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
              mimeType = 'audio/mp4';
            }
          }

          const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
          currentRecorderRef.current = recorder;
          const collectedBlobs: Blob[] = [];

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              collectedBlobs.push(e.data);
            }
          };

          recorder.onstop = () => {
            if (collectedBlobs.length > 0) {
              const fullBlob = new Blob(collectedBlobs, { type: mimeType });
              const reader = new FileReader();
              reader.onloadend = () => {
                const res = reader.result as string;
                if (res) {
                  const base64 = res.split(',')[1];
                  if (base64) {
                    sendVoiceAudioChunk(topicSlug, base64, mimeType);
                  }
                }
              };
              reader.readAsDataURL(fullBlob);
            }

            // Enchaîner immédiatement sur le fragment suivant tant que le micro est actif
            if (!isCancelled && mediaStreamRef.current?.active) {
              recordNextSlice();
            }
          };

          recorder.start();

          // Chaque tranche de 2.5s est clôturée de façon autonome pour générer un conteneur audio complet
          stopTimeoutRef.current = setTimeout(() => {
            if (recorder.state === 'recording') {
              try { recorder.stop(); } catch {}
            }
          }, 2500);
        };

        recordNextSlice();
      })
      .catch((err) => {
        console.warn('Microphone access denied or error:', err);
        setIsMuted(true);
        setIsLiveSpeaking(false);
      });

    return () => {
      isCancelled = true;
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (currentRecorderRef.current && currentRecorderRef.current.state !== 'inactive') {
        try { currentRecorderRef.current.stop(); } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setIsLiveSpeaking(false);
    };
  }, [topicSlug, isMuted]);

  const handleLeave = async () => {
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    if (currentRecorderRef.current && currentRecorderRef.current.state !== 'inactive') {
      try { currentRecorderRef.current.stop(); } catch {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    await leaveVoiceCall(topicSlug);
    onLeaveCall();
  };

  const activeVoiceCount = participants.filter((p) => !p.isMuted).length;

  return (
    <View style={styles.bar}>
      <View style={styles.infoCol}>
        <View style={styles.titleRow}>
          <Text style={styles.liveDot}>🔴</Text>
          <Text style={styles.sessionName} numberOfLines={1}>
            Appel Vocal en Direct • #{topicTitle}
          </Text>
          <View style={[styles.activePill, isLiveSpeaking && styles.speakingPill]}>
            <Text style={styles.activeTxt}>
              {isLiveSpeaking ? '🎙️ Vous parlez en continu' : `🎙️ ${activeVoiceCount}/${participants.length} en direct`}
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
        {/* Bascule Micro : En direct vs Mode Silence */}
        <Pressable
          focusable={true}
          onPress={() => setIsMuted((prev) => !prev)}
          style={[styles.toggleBtn, isMuted ? styles.mutedBtn : styles.unmutedBtn]}
        >
          <Text style={styles.toggleBtnTxt}>
            {isMuted ? '🔇 Micro coupé' : '🎙️ Micro actif'}
          </Text>
        </Pressable>

        {/* Quitter l'appel vocal direct */}
        <Pressable
          focusable={true}
          onPress={handleLeave}
          style={styles.leaveBtn}
        >
          <Text style={styles.leaveBtnTxt}>🔴 Quitter l'appel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoCol: { flex: 1, minWidth: 260, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  liveDot: { fontSize: 13 },
  sessionName: { color: '#f8fafc', fontWeight: '800', fontSize: 14 },
  activePill: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  speakingPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10b981',
  },
  activeTxt: { color: '#c7d2fe', fontSize: 11, fontWeight: '700' },
  avatarsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  participantChip: {
    backgroundColor: 'rgba(51, 65, 85, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  mutedChip: {
    backgroundColor: 'rgba(51, 65, 85, 0.35)',
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  participantName: { color: '#f1f5f9', fontSize: 11, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  unmutedBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10b981',
  },
  mutedBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  toggleBtnTxt: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  leaveBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  leaveBtnTxt: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
});
