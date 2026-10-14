export function parseMediaChaosRoots(envVal?: string): string[] {
  const raw =
    envVal ||
    process.env.MEDIA_CHAOS_ROOT ||
    process.env.MEDIA_CHAOS_ROOTS ||
    './media/chaos';

  return raw
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
