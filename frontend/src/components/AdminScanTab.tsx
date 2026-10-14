import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import {
  fetchScanStatus,
  triggerUniversalScan,
  rebuildMediaHierarchy,
  fetchMediaToVerify,
  validateMedia,
  matchMedia,
  type ScanStatusResponse,
} from '@/services/adminApi';
import { triggerLibraryRefresh } from '@/services/api';
import { Radius } from '@/constants/theme';

export function AdminScanTab() {
  const [statusData, setStatusData] = useState<ScanStatusResponse | null>(null);
  const [toVerifyList, setToVerifyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [isScanningTriggered, setIsScanningTriggered] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [rebuildingHierarchy, setRebuildingHierarchy] = useState(false);

  // Modale d'association manuelle rapide
  const [selectedMediaForMatch, setSelectedMediaForMatch] = useState<any | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [submittingMatch, setSubmittingMatch] = useState(false);

  const loadData = async () => {
    try {
      const [status, toVerify] = await Promise.all([
        fetchScanStatus(),
        fetchMediaToVerify(),
      ]);
      if (status) setStatusData(status);
      if (toVerify) setToVerifyList(toVerify);
    } catch (err) {
      console.warn('Erreur chargement données scanner:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      fetchScanStatus().then((st) => {
        if (st) {
          setStatusData(st);
          if (!st.isScanning && isScanningTriggered) {
            setIsScanningTriggered(false);
            loadData();
          }
        }
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [isScanningTriggered]);

  const handleLaunchScan = async () => {
    setIsScanningTriggered(true);
    setActionMsg('Scan universel démarré en arrière-plan...');
    const res = await triggerUniversalScan();
    if (!res.success) {
      setActionMsg(`❌ Erreur lancement scan : ${res.error}`);
      setIsScanningTriggered(false);
    }
  };

  const handleRebuildHierarchy = async () => {
    setRebuildingHierarchy(true);
    setActionMsg('Réconciliation et réparation de la hiérarchie en cours...');
    const res = await rebuildMediaHierarchy();
    setRebuildingHierarchy(false);
    if (res.success && res.report) {
      setActionMsg(
        `✅ Hiérarchie réparée avec succès ! (${res.report.inspected} inspectés, ${res.report.reparented} rattachés, ${res.report.fixedOrders} ordres corrigés, ${res.report.cleanedExtras ?? 0} extras décontaminés).`
      );
      loadData();
    } else {
      setActionMsg(`❌ Échec de la réparation : ${res.error || 'Erreur inconnue'}`);
    }
  };

  const handleEnrichMetadata = async () => {
    setEnriching(true);
    setActionMsg('Enrichissement des métadonnées (TVmaze / Wiki) en cours...');
    try {
      const data = await triggerLibraryRefresh(100);
      if (data.success) {
        setActionMsg(`✅ Enrichissement terminé : ${data.enrichedCount} média(s) enrichi(s) sans clé payante !`);
        loadData();
      } else {
        setActionMsg(`❌ Erreur : ${data.error || "Échec de l'enrichissement"}`);
      }
    } catch (err: any) {
      setActionMsg(`❌ Erreur réseau : ${err.message}`);
    } finally {
      setEnriching(false);
    }
  };

  const handleValidate = async (id: string) => {
    const res = await validateMedia(id);
    if (res.success) {
      setActionMsg('✅ Média validé avec succès (score 100%) !');
      loadData();
    } else {
      setActionMsg(`❌ Erreur validation : ${res.error}`);
    }
  };

  const openMatchModal = (media: any) => {
    setSelectedMediaForMatch(media);
    setCustomTitle(media.title);
  };

  const handleConfirmMatch = async () => {
    if (!selectedMediaForMatch) return;
    setSubmittingMatch(true);
    setActionMsg(`Association externe en cours pour "${customTitle}"...`);
    const res = await matchMedia(selectedMediaForMatch.id, { title: customTitle });
    setSubmittingMatch(false);
    if (res.success) {
      setActionMsg(`✅ Média associé avec succès : ${res.matchedTitle} !`);
      setSelectedMediaForMatch(null);
      loadData();
    } else {
      setActionMsg(`❌ Échec de l'association : ${res.error || 'Aucun résultat trouvé'}`);
    }
  };

  if (loading && !statusData) {
    return <ActivityIndicator color="#6366f1" style={{ marginVertical: 40 }} />;
  }

  const isScanning = Boolean(statusData?.isScanning || isScanningTriggered);
  const stats = statusData?.stats || {
    totalNodes: 0,
    moviesCount: 0,
    showsCount: 0,
    episodesCount: 0,
    extrasCount: 0,
    verifiedCount: 0,
    toVerifyCount: 0,
  };

  return (
    <View style={{ gap: 16 }}>
      {/* 1. Carte principale : Contrôle du Scanner Waterfall & Réconciliation */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <Text style={styles.cardTitle}>🚀 Scanner Universel In-Place (Architecture Kyoo++)</Text>
            <Text style={styles.cardSub}>
              Pipeline multimodal en 6 niveaux : détection binaire (OSHash, CRC32, tags MKV), analyse lexicale heuristique, association contextuelle, chapitres intro/outro et hiérarchisation déterministe.
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: isScanning ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)' },
              ]}
            >
              <Text style={[styles.statusText, { color: isScanning ? '#fbbf24' : '#34d399' }]}>
                {isScanning ? '⚡ Scan en cours...' : '🟢 Prêt pour scan'}
              </Text>
            </View>
            {statusData?.finishedAt ? (
              <Text style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
                Dernier : {new Date(statusData.finishedAt).toLocaleTimeString()}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Barre de progression interactive si scan en cours */}
        {isScanning && (
          <View style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: 12, borderRadius: 12, marginVertical: 10, borderWidth: 1, borderColor: '#3b82f6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <ActivityIndicator color="#60a5fa" size="small" />
              <Text style={{ color: '#93c5fd', fontWeight: '700', fontSize: 13 }}>
                Analyse & Ingestion en temps réel...
              </Text>
            </View>
            <Text style={{ color: '#f8fafc', fontSize: 13, fontWeight: '600' }}>
              {statusData?.processedCount ?? 0} fichier(s) traités sur {statusData?.totalDiscovered ?? 'découverte...'}
            </Text>
            {statusData?.currentFile ? (
              <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                En cours : {statusData.currentFile}
              </Text>
            ) : null}
          </View>
        )}

        {/* Boutons d'action principaux */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
          <Pressable
            focusable={true}
            style={[styles.submitBtn, { flex: 1, minWidth: 180 }, isScanning && styles.btnDisabled]}
            onPress={handleLaunchScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>🚀 Lancer le Scan Universel</Text>
            )}
          </Pressable>

          <Pressable
            focusable={true}
            style={[
              styles.submitBtn,
              { flex: 1, minWidth: 180, backgroundColor: '#8b5cf6' },
              (rebuildingHierarchy || isScanning) && styles.btnDisabled,
            ]}
            onPress={handleRebuildHierarchy}
            disabled={rebuildingHierarchy || isScanning}
          >
            {rebuildingHierarchy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>🔄 Réparer la Hiérarchie</Text>
            )}
          </Pressable>

          <Pressable
            focusable={true}
            style={[styles.submitBtn, { flex: 1, minWidth: 180, backgroundColor: '#0284c7' }, (enriching || isScanning) && styles.btnDisabled]}
            onPress={handleEnrichMetadata}
            disabled={enriching || isScanning}
          >
            {enriching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>🧠 Enrichir Métadonnées</Text>
            )}
          </Pressable>
        </View>

        {actionMsg ? <Text style={styles.statusMsg}>{actionMsg}</Text> : null}
      </View>

      {/* 2. Statistiques en Direct de la Médiathèque */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Patrimoine Multimédia Indexé</Text>
        <Text style={styles.cardSub}>
          Répartition en temps réel des entités détectées dans la base EAV.
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1, minWidth: 100, backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#38bdf8', fontSize: 22, fontWeight: '800' }}>{stats.totalNodes}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Total Nœuds</Text>
          </View>

          <View style={{ flex: 1, minWidth: 100, backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#f59e0b', fontSize: 22, fontWeight: '800' }}>{stats.moviesCount}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Films</Text>
          </View>

          <View style={{ flex: 1, minWidth: 100, backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#a855f7', fontSize: 22, fontWeight: '800' }}>{stats.showsCount}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Séries & Animes</Text>
          </View>

          <View style={{ flex: 1, minWidth: 100, backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#10b981', fontSize: 22, fontWeight: '800' }}>{stats.episodesCount}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Épisodes</Text>
          </View>

          <View style={{ flex: 1, minWidth: 100, backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#ec4899', fontSize: 22, fontWeight: '800' }}>{stats.extrasCount}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Bonus & Extras</Text>
          </View>

          <View style={{ flex: 1, minWidth: 100, backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: stats.toVerifyCount > 0 ? '#f43f5e' : '#10b981', fontSize: 22, fontWeight: '800' }}>
              {stats.toVerifyCount}
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>⚠️ À vérifier (&lt;90%)</Text>
          </View>
        </View>

        {/* Dossiers Chaos surveillés */}
        {statusData?.chaosRoots && statusData.chaosRoots.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Dossiers sources surveillés (MEDIA_CHAOS_ROOT) :</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {statusData.chaosRoots.map((r, i) => (
                <View key={i} style={{ backgroundColor: 'rgba(51, 65, 85, 0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: '#cbd5e1', fontSize: 11 }}>📁 {r}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 3. Section "Médias à Vérifier & Réconciliation Manuelle" */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={styles.cardTitle}>⚠️ Médias Nécessitant Vérification ({toVerifyList.length})</Text>
          <Pressable focusable={true} onPress={loadData} style={{ padding: 4 }}>
            <Text style={{ color: '#6366f1', fontSize: 12, fontWeight: '700' }}>🔄 Rafraîchir</Text>
          </Pressable>
        </View>
        <Text style={styles.cardSub}>
          Médias ayant un score de confiance inférieur à 90%. Vous pouvez confirmer le média tel quel ou l'associer manuellement avec les bases externes en 1 clic.
        </Text>

        {toVerifyList.length === 0 ? (
          <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>🎉</Text>
            <Text style={{ color: '#34d399', fontWeight: '700', fontSize: 14 }}>
              Tous les médias de votre bibliothèque sont vérifiés et validés !
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
              Score de confiance optimal (≥ 90%) sur l'intégralité du catalogue.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {toVerifyList.map((item) => {
              const scorePct = Math.round((item.confidenceScore ?? 0.5) * 100);
              const scoreColor = scorePct >= 80 ? '#fbbf24' : '#f87171';
              return (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(71, 85, 105, 0.4)',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 220 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 14 }}>
                        {item.title}
                      </Text>
                      <View style={{ backgroundColor: `${scoreColor}22`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: scoreColor, fontSize: 11, fontWeight: '700' }}>
                          {scorePct}% confiance
                        </Text>
                      </View>
                      <View style={{ backgroundColor: '#334155', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: '#94a3b8', fontSize: 11 }}>{item.nodeType}</Text>
                      </View>
                    </View>

                    <Text style={{ color: '#64748b', fontSize: 11 }} numberOfLines={1}>
                      {item.videoFilePath || item.nfoFilePath || 'Fichier sans chemin'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      focusable={true}
                      style={{
                        backgroundColor: '#10b981',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 14,
                      }}
                      onPress={() => handleValidate(item.id)}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>✅ Valider</Text>
                    </Pressable>

                    <Pressable
                      focusable={true}
                      style={{
                        backgroundColor: '#6366f1',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 14,
                      }}
                      onPress={() => openMatchModal(item)}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>🔍 Matcher</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Modale d'association manuelle rapide */}
      {selectedMediaForMatch && (
        <View
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 20,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#6366f1',
            marginVertical: 10,
          }}
        >
          <Text style={{ color: '#f8fafc', fontWeight: '800', fontSize: 16, marginBottom: 4 }}>
            🔍 Association Manuelle & Réconciliation
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
            Saisissez le titre canonique ou officiel pour rechercher et enrichir ce média depuis TVmaze et Wikipedia.
          </Text>

          <Text style={{ color: '#cbd5e1', fontSize: 12, marginBottom: 4 }}>Titre officiel cible :</Text>
          <TextInput
            style={styles.input}
            value={customTitle}
            onChangeText={setCustomTitle}
            placeholder="Ex: Breaking Bad, Dune, Bleach..."
            placeholderTextColor="#64748b"
            autoFocus
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Pressable
              focusable={true}
              style={[styles.submitBtn, { flex: 1, backgroundColor: '#475569' }]}
              onPress={() => setSelectedMediaForMatch(null)}
              disabled={submittingMatch}
            >
              <Text style={styles.submitText}>Annuler</Text>
            </Pressable>

            <Pressable
              focusable={true}
              style={[styles.submitBtn, { flex: 1 }, submittingMatch && styles.btnDisabled]}
              onPress={handleConfirmMatch}
              disabled={submittingMatch || !customTitle.trim()}
            >
              {submittingMatch ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Valider l'association</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderRadius: Radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSub: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  statusMsg: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
  },
});
