import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, Platform, StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';
import { resolveImageUrl } from '@/services/api';
import type { EpgProgram } from '@/services/api';

interface Props {
  channels: any[];
  programsByChannel: Record<string, EpgProgram[]>;
  onSelectChannel: (channel: any) => void;
}

const CHANNEL_COL_WIDTH = 156;
const ROW_HEIGHT = 74;
const HEADER_HEIGHT = 34;
const PX_PER_MINUTE = 2.2;
const WINDOW_MINUTES = 6 * 60;

function formatTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function TvGuideGrid({ channels, programsByChannel, onSelectChannel }: Props) {
  const timelineWidth = WINDOW_MINUTES * PX_PER_MINUTE;

  // Rafraîchit le repère « maintenant » chaque minute sans recharger la grille.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setClockTick((tick) => tick + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const windowStart = useMemo(() => {
    const now = Date.now();
    const halfHour = 30 * 60 * 1000;
    return new Date(Math.floor(now / halfHour) * halfHour - halfHour);
  }, []);

  const windowEnd = new Date(windowStart.getTime() + WINDOW_MINUTES * 60 * 1000);
  const now = new Date();
  const nowOffset = Math.max(0, Math.min(timelineWidth, ((now.getTime() - windowStart.getTime()) / 60000) * PX_PER_MINUTE));

  const ticks = useMemo(() => {
    const result: { label: string; left: number }[] = [];
    for (let minute = 0; minute <= WINDOW_MINUTES; minute += 60) {
      const at = new Date(windowStart.getTime() + minute * 60 * 1000);
      result.push({ label: formatTime(at), left: minute * PX_PER_MINUTE });
    }
    return result;
  }, [windowStart]);

  if (channels.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>📺</Text>
        <Text style={styles.emptyTitle}>Aucune chaîne à afficher</Text>
        <Text style={styles.emptyText}>Modifiez la recherche ou choisissez une autre catégorie.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Colonne fixe des chaînes */}
      <View style={styles.channelColumn}>
        <View style={styles.channelHeader}>
          <Text style={styles.channelHeaderTxt}>Chaîne</Text>
        </View>
        {channels.map((channel) => (
          <Pressable
            key={channel.id}
            focusable={true}
            onPress={() => onSelectChannel(channel)}
            style={({ pressed }) => [styles.channelRow, pressed && styles.channelRowPressed]}
          >
            <View style={styles.channelLogoWrap}>
              {channel.clearlogoPath && !String(channel.clearlogoPath).includes('dc2.oqee.net') ? (
                <Image source={{ uri: resolveImageUrl(channel.clearlogoPath) }} style={styles.channelLogo} resizeMode="contain" />
              ) : (
                <Text style={styles.channelInitials}>{String(channel.title || 'TV').slice(0, 2).toUpperCase()}</Text>
              )}
            </View>
            <Text style={styles.channelTitle} numberOfLines={2}>{channel.title}</Text>
          </Pressable>
        ))}
      </View>

      {/* Grille temporelle défilable */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ width: timelineWidth }}>
        <View style={{ width: timelineWidth }}>
          <View style={styles.timeHeader}>
            {ticks.map((tick) => (
              <View key={tick.left} style={[styles.timeTick, { left: tick.left }]}>
                <View style={styles.timeTickLine} />
                <Text style={styles.timeTickTxt}>{tick.label}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.timelineBody, { height: channels.length * ROW_HEIGHT }]}>
            {/* Ligne « maintenant » */}
            {now >= windowStart && now <= windowEnd && (
              <View pointerEvents="none" style={[styles.nowLine, { left: nowOffset }]}>
                <View style={styles.nowDot} />
              </View>
            )}

            {channels.map((channel) => {
              const programs = (programsByChannel[channel.id] || [])
                .map((program) => {
                  const start = new Date(program.startTime).getTime();
                  const end = new Date(program.endTime).getTime();
                  return { program, start, end };
                })
                .filter(({ start, end }) => end > windowStart.getTime() && start < windowEnd.getTime());

              return (
                <View key={channel.id} style={styles.timelineRow}>
                  {programs.length === 0 ? (
                    <Text style={styles.noProgramTxt}>Aucun programme EPG pour cette chaîne</Text>
                  ) : (
                    programs.map(({ program, start, end }) => {
                      const visibleStart = Math.max(start, windowStart.getTime());
                      const visibleEnd = Math.min(end, windowEnd.getTime());
                      const left = ((visibleStart - windowStart.getTime()) / 60000) * PX_PER_MINUTE;
                      const width = Math.max(40, ((visibleEnd - visibleStart) / 60000) * PX_PER_MINUTE - 3);
                      const isLive = start <= now.getTime() && end > now.getTime();

                      return (
                        <Pressable
                          key={program.id}
                          focusable={true}
                          onPress={() => onSelectChannel(channel)}
                          style={({ pressed }) => [
                            styles.program,
                            { left, width },
                            isLive && styles.programLive,
                            pressed && styles.programPressed,
                          ]}
                        >
                          <Text style={[styles.programTitle, isLive && styles.programTitleLive]} numberOfLines={1}>
                            {isLive ? '▶ ' : ''}{program.title}
                          </Text>
                          <Text style={styles.programTime} numberOfLines={1}>
                            {formatTime(program.startTime)} – {formatTime(program.endTime)}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
    overflow: 'hidden',
  },
  channelColumn: {
    width: CHANNEL_COL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: 'rgba(71, 85, 105, 0.4)',
    backgroundColor: 'rgba(20, 27, 40, 0.95)',
    zIndex: 2,
  },
  channelHeader: {
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.4)',
  },
  channelHeaderTxt: { color: '#94a3b8', fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase' },
  channelRow: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.18)',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  channelRowPressed: { backgroundColor: 'rgba(99, 102, 241, 0.14)' },
  channelLogoWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  channelLogo: { width: '86%', height: '86%' },
  channelInitials: { color: '#c7d2fe', fontSize: 11, fontWeight: '800' },
  channelTitle: { color: '#e2e8f0', fontSize: 11.5, fontWeight: '700', flex: 1 },
  timeHeader: {
    height: HEADER_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.4)',
    backgroundColor: 'rgba(20, 27, 40, 0.95)',
    position: 'relative',
  },
  timeTick: { position: 'absolute', top: 0, bottom: 0, width: 70 },
  timeTickLine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(71, 85, 105, 0.4)' },
  timeTickTxt: { color: '#94a3b8', fontSize: 10.5, fontWeight: '700', marginLeft: 5, marginTop: 9 },
  timelineBody: { position: 'relative' },
  timelineRow: {
    height: ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.18)',
    position: 'relative',
  },
  program: {
    position: 'absolute',
    top: 7,
    height: ROW_HEIGHT - 14,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(51, 65, 85, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 5,
    justifyContent: 'center',
    overflow: 'hidden',
    cursor: (Platform.OS === 'web' ? 'pointer' : 'auto') as any,
  },
  programLive: {
    backgroundColor: 'rgba(99, 102, 241, 0.35)',
    borderColor: 'rgba(129, 140, 248, 0.7)',
  },
  programPressed: { opacity: 0.8 },
  programTitle: { color: '#e2e8f0', fontSize: 10.5, fontWeight: '700' },
  programTitleLive: { color: '#ffffff' },
  programTime: { color: '#94a3b8', fontSize: 9, marginTop: 2 },
  noProgramTxt: { color: '#475569', fontSize: 10.5, fontStyle: 'italic', paddingLeft: 10, paddingTop: 28 },
  nowLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ef4444',
    zIndex: 5,
  },
  nowDot: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.35)',
  },
  emptyEmoji: { fontSize: 30 },
  emptyTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#94a3b8', fontSize: 13 },
});
