import { Place, matchesQuery, rankByDistance, ratingLabel, searchDemoPlaces, searchPlaces } from './places';

const NEAR = { latitude: 40.7308, longitude: -73.9973 }; // Washington Square

const place = (over: Partial<Place> = {}): Place => ({
  id: 'p1',
  name: 'Joe’s Pizza',
  category: 'Pizza',
  address: '7 Carmine St',
  pos: { latitude: 40.7305, longitude: -74.0021 },
  source: 'demo',
  ...over,
});

describe('rankByDistance', () => {
  it('annotates distance and sorts nearest first', () => {
    const far = place({ id: 'far', pos: { latitude: 40.7587, longitude: -73.9787 } });
    const near = place({ id: 'near', pos: { latitude: 40.731, longitude: -73.9975 } });
    const ranked = rankByDistance([far, near], NEAR);
    expect(ranked.map((p) => p.id)).toEqual(['near', 'far']);
    expect(ranked[0].distanceM).toBeLessThan(ranked[1].distanceM!);
  });
});

describe('ratingLabel', () => {
  it('shows the rating with its review count — a 5.0 from 3 people is not a 5.0', () => {
    expect(ratingLabel(place({ rating: 4.5, reviews: 3120 }))).toBe('4.5 (3,120)');
  });
  it('shows a bare rating when the review count is unknown', () => {
    expect(ratingLabel(place({ rating: 4 }))).toBe('4.0');
  });
  it('says nothing when the provider has no opinion (OSM has no ratings)', () => {
    expect(ratingLabel(place({ source: 'osm' }))).toBeNull();
  });
});

describe('matchesQuery', () => {
  it('matches on name, category or address', () => {
    expect(matchesQuery(place(), 'joe')).toBe(true);
    expect(matchesQuery(place(), 'pizza')).toBe(true);
    expect(matchesQuery(place(), 'carmine')).toBe(true);
  });
  it('requires every term (so "pizza carmine" narrows, not widens)', () => {
    expect(matchesQuery(place(), 'pizza carmine')).toBe(true);
    expect(matchesQuery(place(), 'pizza brooklyn')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(matchesQuery(place(), 'JOE’S')).toBe(true);
  });
});

describe('searchDemoPlaces', () => {
  it('with no query, offers what is nearby', () => {
    const results = searchDemoPlaces('', NEAR);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].distanceM).toBeLessThan(results[results.length - 1].distanceM!);
  });
  it('filters by query and still ranks by distance', () => {
    const results = searchDemoPlaces('coffee', NEAR);
    expect(results.every((p) => /coffee/i.test(`${p.name} ${p.category}`))).toBe(true);
  });
});

describe('searchPlaces', () => {
  const rows = [
    {
      place_id: 42,
      lat: '40.7310',
      lon: '-73.9970',
      name: 'Bobst Library',
      display_name: 'Bobst Library, Washington Square S, New York',
      type: 'library',
    },
  ];

  it('maps provider rows into places we can render', async () => {
    const fake = (async () => ({ ok: true, json: async () => rows })) as unknown as typeof fetch;
    const found = await searchPlaces('bobst', NEAR, fake);
    const lib = found.find((p) => p.id === 'osm-42');
    expect(lib).toBeDefined();
    expect(lib!.name).toBe('Bobst Library');
    expect(lib!.pos).toEqual({ latitude: 40.731, longitude: -73.997 });
    expect(lib!.rating).toBeUndefined(); // OSM has no ratings — the card must cope
  });

  it('never strands the group when the provider fails — falls back to what we know', async () => {
    const broken = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const found = await searchPlaces('pizza', NEAR, broken);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((p) => p.source === 'demo')).toBe(true);
  });

  it('does not hit the network for a one-letter query', async () => {
    const spy = jest.fn();
    await searchPlaces('p', NEAR, spy as unknown as typeof fetch);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ranks everything it returns by distance', async () => {
    const fake = (async () => ({ ok: true, json: async () => rows })) as unknown as typeof fetch;
    const found = await searchPlaces('pizza', NEAR, fake);
    const dists = found.map((p) => p.distanceM!);
    expect([...dists].sort((a, b) => a - b)).toEqual(dists);
  });
});
