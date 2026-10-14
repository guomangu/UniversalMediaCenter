import React, { useState, useRef } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { ForumMessage, uploadForumMedia } from '@/services/forumApi';
import { Radius } from '@/constants/theme';

interface Props {
  replyMsg: ForumMessage | null;
  onCancelReply: () => void;
  onSend: (payload: { content: string; mediaType: string; mediaUrl?: string; fileName?: string }) => void;
}

export function ForumInputBar({ replyMsg, onCancelReply, onSend }: Props) {
  const [text, setText] = useState('');
  const [activeMedia, setActiveMedia] = useState<{ type: string; url?: string; name?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetType, setTargetType] = useState<string>('IMAGE');

  const handleSend = () => {
    if (!text.trim() && !activeMedia) return;
    onSend({
      content: text.trim(),
      mediaType: activeMedia?.type || 'TEXT',
      mediaUrl: activeMedia?.url,
      fileName: activeMedia?.name,
    });
    setText('');
    setActiveMedia(null);
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
          <Text style={styles.replyTxt} numberOfLines={1}>↩ Réponse à {replyMsg.authorName} : {replyMsg.content}</Text>
          <Pressable focusable={true} onPress={onCancelReply}><Text style={styles.cancelTxt}>✕</Text></Pressable>
        </View>
      )}

      {activeMedia && (
        <View style={styles.mediaTag}>
          <Text style={styles.mediaTagTxt}>📎 Pièce jointe prête : [{activeMedia.type}] {activeMedia.name}</Text>
          <Pressable focusable={true} onPress={() => setActiveMedia(null)}><Text style={styles.cancelTxt}>✕</Text></Pressable>
        </View>
      )}

      {uploading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator size="small" color="#6366f1" />
          <Text style={styles.uploadingTxt}>Téléversement du fichier en cours...</Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <Pressable focusable={true} onPress={() => triggerPicker('IMAGE', 'image/*')} style={styles.mediaBtn}>
          <Text style={styles.mediaEmoji}>📷 Image</Text>
        </Pressable>
        <Pressable focusable={true} onPress={() => triggerPicker('VIDEO', 'video/*')} style={styles.mediaBtn}>
          <Text style={styles.mediaEmoji}>🎬 Vidéo</Text>
        </Pressable>
        <Pressable focusable={true} onPress={() => triggerPicker('AUDIO', 'audio/*')} style={styles.mediaBtn}>
          <Text style={styles.mediaEmoji}>🎙️ Audio</Text>
        </Pressable>
        <Pressable focusable={true} onPress={() => triggerPicker('DOCUMENT', '*/*')} style={styles.mediaBtn}>
          <Text style={styles.mediaEmoji}>📎 Fichier</Text>
        </Pressable>
        <Pressable focusable={true} onPress={() => {
          const url = prompt('Entrez le lien direct du GIF (Giphy, Tenor, etc.) :');
          if (url?.trim()) setActiveMedia({ type: 'GIF', url: url.trim(), name: 'Reaction.gif' });
        }} style={styles.mediaBtn}>
          <Text style={styles.mediaEmoji}>👾 GIF</Text>
        </Pressable>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Écrire un message... (Entrée = Clavier virtuel, Flèches = Naviguer)"
          placeholderTextColor="#64748b"
          value={text}
          onChangeText={setText}
        />
        {/* Touche Stop demandée pour libérer le focus immédiatement */}
        <Pressable
          focusable={true}
          style={[styles.btn, styles.stopBtn]}
          onPress={handleStop}
          accessibilityLabel="Arrêter la saisie et quitter le champ"
        >
          <Text style={styles.stopTxt}>⏹</Text>
        </Pressable>
        {/* Touche Envoyer */}
        <Pressable
          focusable={true}
          style={[styles.btn, styles.sendBtn]}
          onPress={handleSend}
          accessibilityLabel="Envoyer le message"
        >
          <Text style={styles.sendTxt}>➤</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#1e293b', padding: 8, borderTopWidth: 1, borderTopColor: 'rgba(71, 85, 105, 0.4)' },
  replyBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: Radius.sm, marginBottom: 6 },
  replyTxt: { color: '#a5b4fc', fontSize: 11, flex: 1 },
  cancelTxt: { color: '#f87171', fontWeight: 'bold', paddingHorizontal: 6 },
  mediaTag: { flexDirection: 'row', justifyContent: 'space-between', padding: 6, backgroundColor: 'rgba(79, 70, 229, 0.25)', borderRadius: Radius.sm, marginBottom: 6, borderWidth: 1, borderColor: '#6366f1' },
  mediaTagTxt: { color: '#c7d2fe', fontSize: 11, fontWeight: '700' },
  uploadingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, marginBottom: 6 },
  uploadingTxt: { color: '#818cf8', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  mediaBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: Radius.sm, backgroundColor: 'rgba(51, 65, 85, 0.7)' },
  mediaEmoji: { fontSize: 11, color: '#e2e8f0', fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  input: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.5)', borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, color: '#f8fafc', fontSize: 13 },
  btn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  stopBtn: { backgroundColor: '#475569' },
  stopTxt: { color: '#f8fafc', fontSize: 14, fontWeight: 'bold' },
  sendBtn: { backgroundColor: '#6366f1' },
  sendTxt: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
});
