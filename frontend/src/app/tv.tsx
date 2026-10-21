import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SiteHeader, useHeaderHeight } from "@/components/SiteHeader";
import { TvSearchBar } from "@/components/TvSearchBar";
import { TvChannelCard } from "@/components/TvChannelCard";
import { TvGuideGrid } from "@/components/TvGuideGrid";
import { fetchLiveChannels, fetchIptvCategories, fetchEpgNowNext, fetchEpgGuide } from "@/services/api";
import type { EpgProgram } from "@/services/api";
import { playerStore } from "@/services/playerStore";
import { getApiBaseUrl } from "@/services/apiConfig";
import { getAuthToken } from "@/services/authStore";
import { Spacing, MaxContentWidth, Radius } from "@/constants/theme";

type ViewMode = "CHANNELS" | "GUIDE";

const GUIDE_CHANNEL_LIMIT = 80;
const NOW_NEXT_CHANNEL_LIMIT = 150;
const EPG_REFRESH_MS = 5 * 60 * 1000;

export default function TvScreen() {
  const headerPaddingTop = useHeaderHeight(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [serverCategories, setServerCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("CHANNELS");
  const [nowNext, setNowNext] = useState<Record<string, { now: EpgProgram | null; next: EpgProgram | null }>>({});
  const [guidePrograms, setGuidePrograms] = useState<Record<string, EpgProgram[]>>({});
  const [epgLoading, setEpgLoading] = useState(false);

  useEffect(() => {
    fetchIptvCategories()
      .then((cats) => {
        if (cats && cats.length > 0) setServerCategories(cats);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchLiveChannels({
          category: activeCategory === "ALL" ? undefined : activeCategory,
          q: searchQuery.trim() || undefined,
        });
        if (isMounted) {
          setChannels(data);
        }
      } catch (err) {
        console.error("Erreur chargement chaînes IPTV:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    const timer = setTimeout(load, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeCategory]);

  const categories = useMemo(() => {
    if (serverCategories.length > 0) return serverCategories;
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.groupTitle) set.add(c.groupTitle);
    });
    return Array.from(set);
  }, [serverCategories, channels]);

  const nowNextIds = useMemo(
    () => channels.slice(0, NOW_NEXT_CHANNEL_LIMIT).map((c) => c.id),
    [channels]
  );
  const guideIds = useMemo(
    () => channels.slice(0, GUIDE_CHANNEL_LIMIT).map((c) => c.id),
    [channels]
  );
  const nowNextKey = nowNextIds.join(",");
  const guideKey = guideIds.join(",");

  // Programme en cours / suivant pour les cartes chaînes. Rafraîchi toutes les
  // 5 minutes uniquement quand l'onglet Chaînes est actif : aucun polling
  // agressif, aucune requête lorsque l'utilisateur consulte le guide.
  useEffect(() => {
    if (viewMode !== "CHANNELS" || nowNextIds.length === 0) return;
    let cancelled = false;

    const load = () => {
      const apply = (data: any) => {
        if (!cancelled) setNowNext(data || {});
      };
      // `onFreshData` est indispensable : quand un cache existe déjà,
      // `fetchWithCache` renvoie immédiatement l'ancienne valeur et rafraîchit
      // en arrière-plan. Sans ce callback, la grille resterait figée.
      fetchEpgNowNext(nowNextIds, { onFreshData: apply })
        .then(apply)
        .catch(() => {});
    };

    load();
    const interval = setInterval(load, EPG_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [nowNextKey, viewMode]);

  // Grille EPG (6 heures) chargée à la demande, uniquement en mode Guide.
  useEffect(() => {
    if (viewMode !== "GUIDE" || guideIds.length === 0) return;
    let cancelled = false;
    setEpgLoading(true);

    const load = () => {
      const apply = (data: any) => {
        if (!cancelled) setGuidePrograms(data || {});
      };
      fetchEpgGuide(guideIds, 6, { onFreshData: apply })
        .then(apply)
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setEpgLoading(false);
        });
    };

    load();
    const interval = setInterval(load, EPG_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [guideKey, viewMode]);

  const playChannel = (channel: any) => {
    const apiBase = getApiBaseUrl();
    const token = getAuthToken();
    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";
    const streamUrl = channel.streamUrl?.startsWith("http")
      ? `${apiBase}/api/iptv/proxy?url=${encodeURIComponent(channel.streamUrl)}${tokenQuery}`
      : `${apiBase}/api/media/${channel.id}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    playerStore.openMedia({
      id: String(channel.id),
      title: channel.title || "Chaîne Live",
      streamUrl,
      posterUrl: channel.clearlogoPath,
      isLive: true,
      initialTime: 0,
      expand: true,
    });
  };

  const guideChannels = channels.slice(0, GUIDE_CHANNEL_LIMIT);
  const hasGuideData = Object.keys(guidePrograms).length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <SiteHeader />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: headerPaddingTop + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerHero}>
          <Text style={styles.heroTitle}>📺 Télévision en Direct (IPTV)</Text>
          <Text style={styles.heroSub}>
            Flux directs, zapping haute performance et guide des programmes EPG pour chaque chaîne.
          </Text>
        </View>

        <View style={styles.modeRow}>
          <View style={styles.modeGroup}>
            <Pressable
              focusable={true}
              onPress={() => setViewMode("CHANNELS")}
              style={[styles.modeBtn, viewMode === "CHANNELS" && styles.modeBtnActive]}
            >
              <Text style={[styles.modeTxt, viewMode === "CHANNELS" && styles.modeTxtActive]}>📺 Chaînes</Text>
            </Pressable>
            <Pressable
              focusable={true}
              onPress={() => setViewMode("GUIDE")}
              style={[styles.modeBtn, viewMode === "GUIDE" && styles.modeBtnActive]}
            >
              <Text style={[styles.modeTxt, viewMode === "GUIDE" && styles.modeTxtActive]}>🗓️ Guide TV</Text>
            </Pressable>
          </View>
          {viewMode === "GUIDE" && (
            <Text style={styles.guideHint}>
              Grille sur 6 h • <Text style={styles.guideHintLive}>▶ en cours</Text>
            </Text>
          )}
        </View>

        <TvSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          categories={categories}
        />

        {loading ? (
          <View style={styles.loaderCenter}>
            <ActivityIndicator size="large" color="#E5A00D" />
          </View>
        ) : viewMode === "CHANNELS" ? (
          <View style={styles.gridContainer}>
            {channels.map((channel) => (
              <TvChannelCard
                key={channel.id}
                channel={channel}
                nowProgram={nowNext[channel.id]?.now || null}
                nextProgram={nowNext[channel.id]?.next || null}
              />
            ))}
            {channels.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucune chaîne trouvée correspondant à vos critères.</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.guideWrap}>
            {epgLoading && !hasGuideData ? (
              <View style={styles.loaderCenter}>
                <ActivityIndicator size="large" color="#E5A00D" />
                <Text style={styles.loadingTxt}>Chargement du guide des programmes…</Text>
              </View>
            ) : !hasGuideData ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🗓️</Text>
                <Text style={styles.emptyTitle}>Guide EPG non disponible</Text>
                <Text style={styles.emptyText}>
                  Aucun programme n'est encore synchronisé. Un administrateur peut importer une URL
                  XMLTV puis lancer « Synchroniser EPG » depuis le panneau d'administration.
                </Text>
              </View>
            ) : (
              <TvGuideGrid channels={guideChannels} programsByChannel={guidePrograms} onSelectChannel={playChannel} />
            )}

            {channels.length > GUIDE_CHANNEL_LIMIT && hasGuideData && (
              <Text style={styles.limitNote}>
                Guide limité aux {GUIDE_CHANNEL_LIMIT} premières chaînes ({channels.length} au total).
                Affinez la recherche ou la catégorie pour voir les autres.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1014",
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five * 2,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  headerHero: {
    marginBottom: Spacing.three,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: "#94A3B8",
    lineHeight: 20,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.three,
  },
  modeGroup: {
    flexDirection: "row",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: Radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.35)",
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    cursor: (Platform.OS === "web" ? "pointer" : "auto") as any,
  },
  modeBtnActive: { backgroundColor: "#6366f1" },
  modeTxt: { color: "#94a3b8", fontSize: 13, fontWeight: "700" },
  modeTxtActive: { color: "#ffffff" },
  guideHint: { color: "#64748b", fontSize: 11.5 },
  guideHintLive: { color: "#f87171", fontWeight: "700" },
  guideWrap: { gap: 10 },
  loaderCenter: {
    paddingVertical: Spacing.five * 2,
    alignItems: "center",
    gap: 10,
  },
  loadingTxt: { color: "#94a3b8", fontSize: 13 },
  gridContainer: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
    justifyContent: "flex-start",
  },
  emptyState: {
    paddingVertical: Spacing.five * 2,
    width: "100%",
    alignItems: "center",
    gap: 6,
  },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
    maxWidth: 560,
    lineHeight: 20,
  },
  limitNote: {
    color: "#64748b",
    fontSize: 11.5,
    textAlign: "center",
    paddingVertical: 6,
  },
});
