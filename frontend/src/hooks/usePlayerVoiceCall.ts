import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  joinVoiceCall,
  leaveVoiceCall,
  pingVoiceCall,
  sendVoiceAudioChunk,
  getVoiceAudioChunks,
  SessionParticipant,
} from '@/services/sessionApi';

interface UsePlayerVoiceCallOptions {
  topicSlug: string;
  isMuted: boolean;
  setIsMuted: (val: boolean | ((prev: boolean) => boolean)) => void;
  isEnabled: boolean;
  showToast: (msg: string) => void;
}

export function usePlayerVoiceCall({
  topicSlug,
  isMuted,
  setIsMuted,
  isEnabled,
  showToast,
}: UsePlayerVoiceCallOptions) {
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [isLiveSpeaking, setIsLiveSpeaking] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const currentRecorderRef = useRef<MediaRecorder | null>(null);
  const stopTimeoutRef = useRef<any>(null);
  const lastChunkTimestampRef = useRef<number>(Date.now() - 3000);
  const playedChunkIdsRef = useRef<Set<string>>(new Set());
  const audioQueueRef = useRef<{ id: string; url: string }[]>([]);
  const isPlayingAudioRef = useRef<boolean>(false);

  const playNextInQueue = () => {
    if (isPlayingAudioRef.current || audioQueueRef.current.length === 0) return;
    const item = audioQueueRef.current.shift();
    if (!item) return;

    isPlayingAudioRef.current = true;
    try {
      const audio = new Audio(item.url);
      let isDone = false;
      const finish = () => {
        if (isDone) return;
        isDone = true;
        isPlayingAudioRef.current = false;
        playNextInQueue();
      };

      audio.onended = finish;
      audio.onerror = finish;
      // Sécurité anti-blocage : si le format audio ne déclenche pas onended, libérer après 4s max
      setTimeout(finish, 4000);

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => finish());
      }
    } catch {
      isPlayingAudioRef.current = false;
      playNextInQueue();
    }
  };

  // 1. Déclarer la présence dans la salle vocale et pinger l'état
  useEffect(() => {
    if (!isEnabled || !topicSlug || Platform.OS !== 'web') return;

    joinVoiceCall(topicSlug, isMuted).catch(() => {});

    const doPing = async () => {
      try {
        const res = await pingVoiceCall(topicSlug, isMuted);
        if (res.success && res.participants) {
          setParticipants(res.participants);
        }
      } catch {}
    };

    doPing();
    const interval = setInterval(doPing, 3500);

    return () => {
      clearInterval(interval);
      leaveVoiceCall(topicSlug).catch(() => {});
    };
  }, [isEnabled, topicSlug, isMuted]);

  // 2. Écouter les fragments vocaux des autres spectateurs
  useEffect(() => {
    if (!isEnabled || !topicSlug || Platform.OS !== 'web') return;

    const pollInterval = setInterval(async () => {
      try {
        const chunks = await getVoiceAudioChunks(topicSlug, lastChunkTimestampRef.current);
        if (chunks && chunks.length > 0) {
          for (const c of chunks) {
            lastChunkTimestampRef.current = Math.max(lastChunkTimestampRef.current, c.timestamp);
            if (c.id && !playedChunkIdsRef.current.has(c.id) && c.audioBase64) {
              playedChunkIdsRef.current.add(c.id);
              if (playedChunkIdsRef.current.size > 150) {
                const arr = Array.from(playedChunkIdsRef.current);
                playedChunkIdsRef.current = new Set(arr.slice(arr.length - 75));
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
      clearInterval(pollInterval);
      audioQueueRef.current = [];
      isPlayingAudioRef.current = false;
    };
  }, [isEnabled, topicSlug]);

  // 3. Capturer et diffuser le micro UNIQUEMENT quand isMuted === false
  useEffect(() => {
    if (!isEnabled || isMuted || Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (currentRecorderRef.current && currentRecorderRef.current.state !== 'inactive') {
        try {
          currentRecorderRef.current.stop();
        } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setIsLiveSpeaking(false);
      return;
    }

    let isCancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
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
                    sendVoiceAudioChunk(topicSlug, base64, mimeType).catch(() => {});
                  }
                }
              };
              reader.readAsDataURL(fullBlob);
            }

            if (!isCancelled && mediaStreamRef.current?.active) {
              recordNextSlice();
            }
          };

          recorder.start();

          stopTimeoutRef.current = setTimeout(() => {
            if (recorder.state === 'recording') {
              try {
                recorder.stop();
              } catch {}
            }
          }, 2500);
        };

        recordNextSlice();
      })
      .catch((err) => {
        console.warn('Microphone access denied:', err);
        setIsMuted(true);
        setIsLiveSpeaking(false);
        showToast('Accès micro refusé ou indisponible ⚠️');
      });

    return () => {
      isCancelled = true;
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (currentRecorderRef.current && currentRecorderRef.current.state !== 'inactive') {
        try {
          currentRecorderRef.current.stop();
        } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setIsLiveSpeaking(false);
    };
  }, [isEnabled, isMuted, topicSlug]);

  return {
    participants,
    isLiveSpeaking,
  };
}
