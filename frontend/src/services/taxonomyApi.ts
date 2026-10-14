const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface TaxonomyTag {
  label: string;
  slug: string;
  count: number;
}

export interface TaxonomyCategory {
  id: string;
  title: string;
  tags: TaxonomyTag[];
}

export interface MediaTileItem {
  id: string;
  title: string;
  nodeType: string;
  releaseYear?: number;
  posterPath?: string;
  communityRating?: number;
}

export async function fetchTaxonomy(): Promise<TaxonomyCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/api/ui/taxonomy`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.categories || [];
  } catch {
    return [];
  }
}

export async function fetchTaxonomyMedias(params: {
  category: string;
  tag: string;
  filter?: string;
  q?: string;
}): Promise<MediaTileItem[]> {
  try {
    const query = new URLSearchParams({
      category: params.category,
      tag: params.tag,
      filter: params.filter || '',
      q: params.q || '',
    }).toString();
    const res = await fetch(`${API_BASE}/api/ui/taxonomy/medias?${query}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}
