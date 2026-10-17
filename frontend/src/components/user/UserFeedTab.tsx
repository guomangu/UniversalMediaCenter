import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Radius, Spacing } from '@/constants/theme';
import {
  fetchFeedReposts,
  fetchFriendsReposts,
  fetchUserReposts,
  deleteRepost,
  MediaRepostItem,
} from '@/services/repostApi';
import { resolveImageUrl } from '@/services/api';

type FeedFilter = 'ALL' | 'FRIENDS' | 'MINE';

function formatTimeAgo(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "À l'instant";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `Il y a ${diffDays} j`;
    return new Date(dateStr).toLocaleDateString('fr-FR');
  } catch {
    return '';
  }
}

export function UserFeedTab() {
  const router = useRouter();
  const [filter, setFilter] = useState<FeedFilter>('ALL');
  const [feed, setFeed] = useState<MediaRepostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = async (currentFilter = filter) => {
    setLoading(true);
    let items: MediaRepostItem[] = [];
    if (currentFilter === 'ALL') {
      items = await fetchFeedReposts();
    } else if (currentFilter === 'FRIENDS') {
      items = await fetchFriendsReposts();
    } else {
      items = await fetchUserReposts();
    }
    setFeed(items);
    setLoading(false);
  };

  useEffect(() => {
    loadFeed(filter);
  }, [filter]);

  const handleDelete = async (id: string) => {
    const ok = await deleteRepost(id);
    if (ok) {
      setFeed((prev) => prev.filter((r) => r.id !== id));
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Barre de filtres YouTube / Social */}
      <View style={styles.filterRow}>
        <Pressable
          focusable={true}
          onPress={() => setFilter('ALL')}
          style={[styles.filterChip, filter === 'ALL' && styles.filterChipActive]}
        >
          <Text style={[styles.filterTxt, filter === 'ALL' && styles.filterTxtActive]}>
            🌟 Tous les avis
          </Text>
        </Pressable>

        <Pressable
          focusable={true}
          onPress={() => setFilter('FRIENDS')}
          style={[styles.filterChip, filter === 'FRIENDS' && styles.filterChipActive]}
        >
          <Text style={[styles.filterTxt, filter === 'FRIENDS' && styles.filterTxtActive]}>
            👥 Amis uniquement
          </Text>
        </Pressable>

        <Pressable
          focusable={true}
          onPress={() => setFilter('MINE')}
          style={[styles.filterChip, filter === 'MINE' && styles.filterChipActive]}
        >
          <Text style={[styles.filterTxt, filter === 'MINE' && styles.filterTxtActive]}>
            ✍️ Mes avis
          </Text>
        </Pressable>
      </View>

      {/* 2. En-tête de section */}
      <View style={styles.secHeader}>
        <Text style={styles.secTitle}>
          {filter === 'ALL'
            ? `🌟 Fil d'actualité & Critiques (${feed.length})`
            : filter === 'FRIENDS'
            ? `👥 Avis de vos amis (${feed.length})`
            : `✍️ Vos avis & critiques publiés (${feed.length})`}
        </Text>
        <Pressable focusable={true} onPress={() => loadFeed(filter)} style={styles.refreshBtn}>
          <Text style={styles.refreshTxt}>↻ Actualiser</Text>
        </Pressable>
      </View>

      {/* 3. Contenu de la liste */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#818cf8" size="small" />
          <Text style={styles.loadingTxt}>Chargement des publications...</Text>
        </View>
      ) : feed.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>
            {filter === 'FRIENDS'
              ? 'Aucun avis de vos amis pour le moment'
              : filter === 'MINE'
              ? 'Vous n’avez pas encore rédigé d’avis'
              : 'Aucune publication récente'}
          </Text>
          <Text style={styles.emptyDesc}>
            {filter === 'FRIENDS'
              ? 'Invitez des amis dans l’onglet « Amis » pour découvrir leurs recommandations et leurs notes !'
              : 'Donnez votre avis avec une note et un commentaire depuis la fiche de vos films et séries favoris.'}
          </Text>
          <Pressable focusable={true} onPress={() => router.push('/')} style={styles.actionBtn}>
            <Text style={styles.actionBtnTxt}>Parcourir le catalogue</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {feed.map((item) => {
            const media = item.media || item.node;
            const posterUri = resolveImageUrl(media?.posterPath);
            const timeAgo = formatTimeAgo(item.createdAt);

            return (
              <View key={item.id} style={styles.card}>
                {/* En-tête de l'avis : Auteur, Note, Date */}
                <View style={styles.cardHeader}>
                  <View style={styles.authorRow}>
                    <View style={styles.avatarWrap}>
                      <Text style={styles.avatarTxt}>{item.author?.avatarUrl || '👤'}</Text>
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.authorName}>{item.author?.displayName || 'Membre'}</Text>
                        {item.isFriend ? (
                          <View style={styles.friendPill}>
                            <Text style={styles.friendPillTxt}>Ami</Text>
                          </View>
                        ) : null}
                        {item.isMine ? (
                          <View style={styles.minePill}>
                            <Text style={styles.minePillTxt}>Moi</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.dateTxt}>{timeAgo}</Text>
                    </View>
                  </View>

                  {item.rating ? (
                    <View style={styles.ratingBadge}>
                      <Text style={styles.stars}>{'★'.repeat(item.rating)}</Text>
                      <Text style={styles.ratingNum}>{item.rating}/5</Text>
                    </View>
                  ) : null}
                </View>

                {/* Commentaire de l'utilisateur */}
                {item.comment ? (
                  <View style={styles.commentBox}>
                    <Text style={styles.commentTxt}>« {item.comment} »</Text>
                  </View>
                ) : null}

                {/* Bloc Média associé cliquable */}
                {media ? (
                  <Pressable
                    focusable={true}
                    onPress={() => router.push(`/media/${media.id}` as any)}
                    style={styles.mediaRow}
                  >
                    {posterUri ? (
                      <Image source={{ uri: posterUri }} style={styles.mediaPoster} resizeMode="cover" />
                    ) : (
                      <View style={[styles.mediaPoster, styles.posterFallback]}>
                        <Text style={{ fontSize: 16 }}>🎬</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.mediaTitle} numberOfLines={1}>
                        {media.title}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {media.releaseYear ? (
                          <Text style={styles.mediaYear}>{media.releaseYear}</Text>
                        ) : null}
                        {media.displayBadge || media.seasonEpisodeTag ? (
                          <Text style={styles.badgeTxt}>
                            {media.displayBadge || media.seasonEpisodeTag}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.viewMediaArrow}>Voir la fiche →</Text>
                  </Pressable>
                ) : null}

                {/* Actions sur l'avis (ex: suppression si c'est le mien) */}
                {item.isMine ? (
                  <View style={styles.cardActions}>
                    <Pressable
                      focusable={true}
                      onPress={() => handleDelete(item.id)}
                      style={styles.delBtn}
                    >
                      <Text style={styles.delBtnTxt}>🗑 Supprimer mon avis</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    padding: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  filterChipActive: {
    backgroundColor: '#6366f1',
  },
  filterTxt: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  filterTxtActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  secHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#818cf8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refreshBtn: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  refreshTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  loadingBox: { padding: 30, alignItems: 'center', gap: 10 },
  loadingTxt: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' },
  emptyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { color: '#f1f5f9', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  emptyDesc: { color: '#94a3b8', fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 420 },
  actionBtn: {
    backgroundColor: '#6366f1',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.pill,
  },
  actionBtnTxt: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 18 },
  authorName: { color: '#f8fafc', fontWeight: '800', fontSize: 13 },
  friendPill: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  friendPillTxt: { color: '#4ade80', fontSize: 9.5, fontWeight: '700' },
  minePill: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  minePillTxt: { color: '#a5b4fc', fontSize: 9.5, fontWeight: '700' },
  dateTxt: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  stars: { color: '#fbbf24', fontSize: 13, letterSpacing: 1 },
  ratingNum: { color: '#fde68a', fontSize: 11, fontWeight: '800' },
  commentBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  commentTxt: { color: '#e2e8f0', fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.25)',
  },
  mediaPoster: { width: 40, height: 56, borderRadius: 8, backgroundColor: '#334155' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  mediaTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 13 },
  mediaYear: { color: '#94a3b8', fontSize: 11 },
  badgeTxt: { color: '#818cf8', fontSize: 11, fontWeight: '700' },
  viewMediaArrow: { color: '#818cf8', fontSize: 11, fontWeight: '700', paddingRight: 4 },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.2)',
    paddingTop: 8,
  },
  delBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  delBtnTxt: { color: '#f87171', fontSize: 11, fontWeight: '700' },
});
