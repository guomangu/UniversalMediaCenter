import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import type { ParsedM3uChannel } from './m3uParser.js';
import { generateSlug } from '../watcher/slugify.js';
import { linkTagToNode } from '../watcher/tagExtractor.js';
import { eq } from 'drizzle-orm';

// Diffuseurs pirates obsolètes connus et serveurs coupés avec 403 deny_backend
const BLOCKED_STREAM_PATTERNS = [
  '145.239.5.177',
];

export async function ingestIptvChannels(channels: ParsedM3uChannel[]): Promise<number> {
  let count = 0;

  for (const ch of channels) {
    if (!ch.streamUrl || BLOCKED_STREAM_PATTERNS.some((p) => ch.streamUrl.includes(p))) {
      continue;
    }

    const slug = `tv-${generateSlug(ch.name || 'ch')}-${Date.now().toString().slice(-4)}`;

    const existing = await db.query.mediaNodes.findFirst({
      where: (t, { and, eq }) => and(eq(t.nodeType, 'LIVE_CHANNEL'), eq(t.title, ch.name)),
    });

    let nodeId: string;
    if (existing) {
      nodeId = existing.id;
      await db
        .update(mediaNodes)
        .set({
          streamUrl: ch.streamUrl,
          clearlogoPath: ch.logoUrl || existing.clearlogoPath,
          updatedAt: new Date(),
        })
        .where(eq(mediaNodes.id, nodeId));
    } else {
      const [inserted] = await db
        .insert(mediaNodes)
        .values({
          nodeType: 'LIVE_CHANNEL',
          state: 'READY',
          title: ch.name,
          sortTitle: ch.name,
          slug,
          streamUrl: ch.streamUrl,
          clearlogoPath: ch.logoUrl,
          searchVectorText: `${ch.name} ${ch.groupTitle || ''} ${ch.country || ''}`.trim(),
        })
        .returning();
      nodeId = inserted.id;
      count++;
    }

    if (ch.groupTitle) {
      await linkTagToNode(nodeId, 'iptv_category', ch.groupTitle);
    }
    if (ch.country) {
      await linkTagToNode(nodeId, 'country', ch.country);
    }
  }

  return count;
}
