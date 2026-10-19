import React, { useState, useRef } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { ForumMessage, uploadForumMedia } from '@/services/forumApi';
import { Radius } from '@/constants/theme';

interface Props {
  replyMsg: ForumMessage | null;
  quotedMedia?: { id: string; title: string; poster?: string } | null;
  onCancelReply: () => void;
  onCancelQuote?: () => void;
  onSend: (payload: {
    content: string;
    mediaType: string;
    mediaUrl?: string;
    fileName?: string;
    quotedMediaId?: string;
    quotedMediaTitle?: string;
    quotedMediaPoster?: string;
  }) => void;
}

export function ForumInputBar({
  replyMsg,
  quotedMedia,
  onCancelReply,
  onCancelQuote,
  onSend,
}: Props) {
  const [text, setText] = useState('');
  const [activeMedia, setActiveMedia] = useState<{ type: string; url?: string; name?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetType, setTargetType] = useState<string>('IMAGE');
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleSend = () => {
    if (!text.trim() && !activeMedia && !quotedMedia) return;
    onSend({
      content: text.trim(),
      mediaType: activeMedia?.type || 'TEXT',
      mediaUrl: activeMedia?.url,
      fileName: activeMedia?.name,
      quotedMediaId: quotedMedia?.id,
      quotedMediaTitle: quotedMedia?.title,
      quotedMediaPoster: quotedMedia?.poster,
    });
    setText('');
    setActiveMedia(null);
    onCancelQuote?.();
  };

  const handleStop = () => {
    if (inputRef.current) {
      inputRef.current.blur?.();
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }
  };

  const triggerPicker = (type: string, accept: string) => {
    setTargetType(type);
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    setUploading(true);
    const res = await uploadForumMedia(file, file.name, targetType);
    setUploading(false);

    if (res.success && res.url) {
      setActiveMedia({ type: res.mediaType || targetType, url: res.url, name: res.fileName || file.name });
    }
    e.target.value = '';
  };

  const toggleVoiceRecording = async () => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      triggerPicker('AUDIO', 'audio/*');
      return;
    }

    if (isRecording) {
      // Arrêter l'enregistrement
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Démarrer l'enregistrement vocal
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((track) => track.stop());
          setUploading(true);
          const res = await uploadForumMedia(audioBlob, `vocal-${Date.now()}.webm`, 'AUDIO');
          setUploading(false);

          if (res.success && res.url) {
            // Publication immédiate du message vocal dans la discussion
            onSend({
              content: '',
              mediaType: 'AUDIO',
              mediaUrl: res.url,
              fileName: 'Message vocal',
              quotedMediaId: quotedMedia?.id,
              quotedMediaTitle: quotedMedia?.title,
              quotedMediaPoster: quotedMedia?.poster,
            });
            onCancelQuote?.();
          }
        };

        recorder.start();
        setIsRecording(true);
      } catch {
        triggerPicker('AUDIO', 'audio/*');
      }
    }
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <input
          type="file"
          ref={fileInputRef as any}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      ) : null}

      {replyMsg && (
        <View style={styles.replyBar}>
          <Text style={styles.replyTxt} numberOfLines={1}>Réponse à {replyMsg.authorName} : {replyMsg.content}</Text>
          <Pressable focusable={true} onPress={onCancelReply}><Text style={styles.cancelTxt}>✕</Text></Pressable>
        </View>
      )}

      {quotedMedia && (
        <View style={styles.quoteBar}>
          <Text style={styles.quoteTxt} numberOfLines={1}>Média lié : {quotedMedia.title}</Text>
          <Pressable focusable={true} onPress={onCancelQuote}><Text style={styles.cancelTxt}>✕</Text></Pressable>
        </View>
      )}

      {activeMedia && (
        <View style={styles.mediaTag}>
          <Text style={styles.mediaTagTxt}>Fichier joint : [{activeMedia.type}] {activeMedia.name}</Text>
          <Pressable focusable={true} onPress={() => setActiveMedia(null)}><Text style={styles.cancelTxt}>✕</Text></Pressable>
        </View>
      )}

      {uploading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator size="small" color="#8e9ab0" />
          <Text style={styles.uploadingTxt}>Téléversement en cours...</Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <Pressable
          focusable={true}
          onPress={toggleVoiceRecording}
          style={[styles.mediaBtn, isRecording && styles.recordingBtn]}
        >
          <Text style={[styles.mediaEmoji, isRecording && styles.recordingTxt]}>
            {isRecording ? 'Terminer & Envoyer' : 'Vocal'}
          </Text>
        </Pressable>
        <Pressable focusable={true} onPress={() => triggerPicker('IMAGE', 'image/*')} style={styles.mediaBtn}>
          <Text style={styles.mediaEmoji}>Image</Text>
        </Pressable>
        <Pressable focusable={true} onPress={() => triggerPicker('VIDEO', 'video/*')} style={styles.mediaBtn}>
          <Text style={styles.mediaEmoji}>Vidéo</Text>
        </Pressable>
        <Pressable focusable={true} onPress={() => triggerPicker('DOCUMENT', '*/*')} style={styles.mediaBtn}>
          <Text style={styles.mediaEmoji}>Fichier</Text>
        </Pressable>
        <Pressable focusable={true} onPress={() => {
          const url = prompt('Entrez le lien direct du GIF (Giphy, Tenor, etc.) :');
          if (url?.trim()) setActiveMedia({ type: 'GIF', url: url.trim(), name: 'Reaction.gif' });
        }} style={styles.mediaBtn}>
          <Text style={styles.mediaEmoji}>GIF</Text>
        </Pressable>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          data-search-input="true"
          placeholder="Écrire un message... (Entrée pour envoyer)"
          placeholderTextColor="#7c8797"
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          focusable={true}
          style={[styles.btn, styles.stopBtn]}
          onPress={handleStop}
          accessibilityLabel="Arrêter la saisie et quitter le champ"
        >
          <Text style={styles.stopTxt}>✕</Text>
        </Pressable>
        <Pressable focusable={true} style={[styles.btn, styles.sendBtn]} onPress={handleSend}>
          <Text style={styles.sendTxt}>➔</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(38, 44, 54, 0.75)',
    borderRadius: Radius.lg,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.12)',
  },
  replyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(50, 60, 75, 0.4)',
    padding: 6,
    borderRadius: Radius.sm,
    marginBottom: 6,
  },
  replyTxt: { color: '#c5cedb', fontSize: 11, flex: 1 },
  quoteBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(50, 60, 75, 0.4)',
    padding: 6,
    borderRadius: Radius.sm,
    marginBottom: 6,
  },
  quoteTxt: { color: '#cfb991', fontSize: 11, flex: 1 },
  cancelTxt: { color: '#8a95a5', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 6 },
  mediaTag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 55, 68, 0.4)',
    padding: 6,
    borderRadius: Radius.sm,
    marginBottom: 6,
  },
  mediaTagTxt: { color: '#88c7a8', fontSize: 11, flex: 1 },
  uploadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    marginBottom: 6,
  },
  uploadingTxt: { color: '#8a95a5', fontSize: 11 },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  mediaBtn: {
    backgroundColor: 'rgba(42, 48, 58, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  recordingBtn: {
    backgroundColor: 'rgba(168, 70, 70, 0.9)',
    borderColor: 'rgba(168, 70, 70, 0.9)',
  },
  mediaEmoji: { color: '#8e9ab0', fontSize: 11, fontWeight: '600' },
  recordingTxt: { color: '#ffffff', fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(30, 36, 45, 0.75)',
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#edeef2',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(160, 175, 195, 0.14)',
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  stopBtn: { backgroundColor: 'rgba(50, 60, 72, 0.6)' },
  stopTxt: { color: '#8a95a5', fontSize: 12 },
  sendBtn: { backgroundColor: '#475569' },
  sendTxt: { color: '#edeef2', fontSize: 13, fontWeight: 'bold' },
});
