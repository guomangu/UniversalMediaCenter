import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { ForumMessage } from '@/services/forumApi';
import { Radius } from '@/constants/theme';

interface Props {
  replyMsg: ForumMessage | null;
  onCancelReply: () => void;
  onSend: (payload: { content: string; mediaType: string; mediaUrl?: string; fileName?: string }) => void;
}

export function ForumInputBar({ replyMsg, onCancelReply, onSend }: Props) {
  const [text, setText] = useState('');
  const [activeMedia, setActiveMedia] = useState<{ type: string; url?: string; name?: string } | null>(null);

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

  const handlePickMedia = (type: string) => {
    if (type === 'IMAGE') setActiveMedia({ type, url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600', name: 'Affiche.jpg' });
    if (type === 'GIF') setActiveMedia({ type, url: 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif', name: 'Reaction.gif' });
    if (type === 'VIDEO') setActiveMedia({ type, url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', name: 'Extrait.mp4' });
    if (type === 'AUDIO') setActiveMedia({ type, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', name: 'Vocal 0:18' });
    if (type === 'DOCUMENT') setActiveMedia({ type, url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', name: 'Dossier-Presse.pdf' });
    if (type === 'LINK') setActiveMedia({ type, url: 'https://themoviedb.org', name: 'Lien Web' });
  };

  return (
    <View style={styles.container}>
      {replyMsg ? (
        <View style={styles.replyBar}>
          <Text style={styles.replyTxt} numberOfLines={1}>↩ Réponse à {replyMsg.authorName} : {replyMsg.content}</Text>
          <Pressable onPress={onCancelReply}><Text style={styles.cancelTxt}>✕</Text></Pressable>
        </View>
      ) : null}

      {activeMedia ? (
        <View style={styles.mediaTag}>
          <Text style={styles.mediaTagTxt}>Pièce jointe : [{activeMedia.type}] {activeMedia.name}</Text>
          <Pressable onPress={() => setActiveMedia(null)}><Text style={styles.cancelTxt}>✕</Text></Pressable>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        {(['IMAGE', 'GIF', 'VIDEO', 'AUDIO', 'DOCUMENT', 'LINK'] as const).map((t) => (
          <Pressable key={t} onPress={() => handlePickMedia(t)} style={styles.mediaBtn}>
            <Text style={styles.mediaEmoji}>
              {t === 'IMAGE' ? '📷' : t === 'GIF' ? '👾' : t === 'VIDEO' ? '🎬' : t === 'AUDIO' ? '🎙️' : t === 'DOCUMENT' ? '📎' : '🔗'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Écrire un message ou partager un média..."
          placeholderTextColor="#64748b"
          value={text}
          onChangeText={setText}
        />
        <Pressable style={styles.sendBtn} onPress={handleSend}>
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
  mediaTag: { flexDirection: 'row', justifyContent: 'space-between', padding: 4, backgroundColor: 'rgba(79, 70, 229, 0.2)', borderRadius: Radius.sm, marginBottom: 6 },
  mediaTagTxt: { color: '#818cf8', fontSize: 11, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  mediaBtn: { padding: 5, borderRadius: Radius.sm, backgroundColor: 'rgba(51, 65, 85, 0.5)' },
  mediaEmoji: { fontSize: 14 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', borderWidth: 1, borderColor: 'rgba(71, 85, 105, 0.5)', borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, color: '#f8fafc', fontSize: 13 },
  sendBtn: { backgroundColor: '#6366f1', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sendTxt: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});
