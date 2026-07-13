import { LatLng, distanceM } from './geo';

/**
 * A place you could send the group to.
 *
 * This shape is the seam for the real providers. Yelp lands here later
 * (`source: 'yelp'`, with `rating`, `reviews` and `url` filled in from its
 * Business Search response); today the same fields come from OpenStreetMap
 * (which knows where things are but not what people think of them) and from
 * the demo seed (which has both, so the demo looks like the real thing).
 *
 * Anything optional here is genuinely unknown for some providers — the UI must
 * render a place with no rating and no link without looking broken.
 */
export interface Place {
  id: string;
  name: string;
  /** "Coffee shop", "Pizza" — what it is, in the words a person would use */
  category?: string;
  address?: string;
  pos: LatLng;
  /** 0–5, one decimal. Undefined = this provider doesn't know. */
  rating?: number;
  /** how many reviews the rating is built on — a 5.0 from 3 people is not a 5.0 */
  reviews?: number;
  /** Yelp page or the business's own site */
  url?: string;
  /** metres from the searcher — filled in by rankByDistance */
  distanceM?: number;
  source: 'yelp' | 'osm' | 'demo';
}

/** Annotate with distance from `near` and sort nearest-first. */
export function rankByDistance(places: Place[], near: LatLng): Place[] {
  return places
    .map((p) => ({ ...p, distanceM: distanceM(near, p.pos) }))
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
}

/** "★ 4.5 (312)" — or nothing at all when the provider has no opinion. */
export function ratingLabel(p: Place): string | null {
  if (p.rating == null) return null;
  const stars = p.rating.toFixed(1);
  return p.reviews != null ? `${stars} (${p.reviews.toLocaleString()})` : stars;
}

/**
 * Places for the demo walk (Greenwich Village). Real venues, plausible
 * ratings — the demo has to behave like the real world, including having a
 * star rating and a link, or we'd design the search around data we don't show.
 */
const DEMO_PLACES: Place[] = [
  { id: 'd1', name: 'Washington Square Park', category: 'Park', address: 'Washington Sq, New York', pos: { latitude: 40.7308, longitude: -73.9973 }, rating: 4.7, reviews: 4821, url: 'https://www.nycgovparks.org/parks/washington-square-park', source: 'demo' },
  { id: 'd2', name: "Joe's Pizza", category: 'Pizza', address: '7 Carmine St', pos: { latitude: 40.7305, longitude: -74.0021 }, rating: 4.5, reviews: 3120, url: 'https://www.yelp.com/biz/joes-pizza-new-york-3', source: 'demo' },
  { id: 'd3', name: 'Think Coffee', category: 'Coffee', address: '123 4th Ave', pos: { latitude: 40.7306, longitude: -73.9938 }, rating: 4.2, reviews: 640, url: 'https://www.yelp.com/biz/think-coffee-new-york-9', source: 'demo' },
  { id: 'd4', name: 'Blue Note Jazz Club', category: 'Jazz club', address: '131 W 3rd St', pos: { latitude: 40.7307, longitude: -74.0007 }, rating: 4.3, reviews: 1890, url: 'https://www.yelp.com/biz/blue-note-new-york', source: 'demo' },
  { id: 'd5', name: 'Stonewall Inn', category: 'Bar', address: '53 Christopher St', pos: { latitude: 40.7339, longitude: -74.0021 }, rating: 4.4, reviews: 1210, url: 'https://www.yelp.com/biz/the-stonewall-inn-new-york', source: 'demo' },
  { id: 'd6', name: 'Murray’s Cheese', category: 'Cheese shop', address: '254 Bleecker St', pos: { latitude: 40.7311, longitude: -74.0031 }, rating: 4.6, reviews: 980, url: 'https://www.yelp.com/biz/murrays-cheese-new-york', source: 'demo' },
  { id: 'd7', name: 'Bleecker Street Records', category: 'Records', address: '188 W 4th St', pos: { latitude: 40.7327, longitude: -74.0021 }, rating: 4.6, reviews: 410, source: 'demo' },
  { id: 'd8', name: 'Rockefeller Center', category: 'Landmark', address: '45 Rockefeller Plaza', pos: { latitude: 40.7587, longitude: -73.9787 }, rating: 4.6, reviews: 9200, url: 'https://www.rockefellercenter.com', source: 'demo' },
];

/** Case/diacritic-insensitive substring match over the fields a person types. */
export function matchesQuery(p: Place, q: string): boolean {
  const hay = `${p.name} ${p.category ?? ''} ${p.address ?? ''}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

export function searchDemoPlaces(query: string, near: LatLng): Place[] {
  const q = query.trim();
  if (!q) return rankByDistance(DEMO_PLACES, near).slice(0, 6);
  return rankByDistance(DEMO_PLACES.filter((p) => matchesQuery(p, q)), near);
}

/** OpenStreetMap's search response — the fields we actually read. */
interface NominatimRow {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type?: string;
}

/**
 * Real place search, no API key: OpenStreetMap/Nominatim. It knows where
 * things are, but nothing about ratings — those arrive with Yelp.
 *
 * YELP GOES HERE: swap this call for Yelp's /businesses/search (it returns
 * name, coordinates, rating, review_count and url in one shot, which is
 * exactly the Place shape above), keep the same signature, and the UI needs no
 * change. Yelp requires an API key, so it must be proxied — a Supabase Edge
 * Function — rather than shipped in the app.
 */
export async function searchPlaces(
  query: string,
  near: LatLng,
  fetchImpl: typeof fetch = fetch
): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return searchDemoPlaces(q, near);

  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=8&q=' +
    encodeURIComponent(q) +
    `&viewbox=${near.longitude - 0.15},${near.latitude + 0.15},${near.longitude + 0.15},${near.latitude - 0.15}`;

  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'Arrival/1.0 (session map app)' } });
    if (!res.ok) throw new Error(`search ${res.status}`);
    const rows = (await res.json()) as NominatimRow[];
    const places: Place[] = rows.map((r) => ({
      id: `osm-${r.place_id}`,
      name: r.name || r.display_name.split(',')[0],
      category: r.type?.replace(/_/g, ' '),
      address: r.display_name.split(',').slice(1, 3).join(',').trim(),
      pos: { latitude: Number(r.lat), longitude: Number(r.lon) },
      source: 'osm' as const,
    }));
    // demo places are local and richer (ratings, links) — surface them too
    const demo = searchDemoPlaces(q, near);
    return rankByDistance([...demo, ...places], near).slice(0, 10);
  } catch {
    // offline, rate-limited, whatever: the group still has to be able to pick
    // somewhere. Never leave them with an empty list and no explanation.
    return searchDemoPlaces(q, near);
  }
}
