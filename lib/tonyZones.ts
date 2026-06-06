// tonyZones.ts
// Tony zone translation library for WildLogic v2
// Converts Tony's semantic relative_position zones to actual GeoJSON coordinates
// using the property boundary bounding box — eliminates GPS coordinate hallucination.

export const ZONE_COLORS: Record<string, string> = {
  food_plot: '#4CAF50',
  kill_plot: '#8BC34A',
  access_route: '#FF9800',
  bedding: '#795548',
  stand_site: '#F44336',
  water: '#2196F3',
  staging_area: '#9C27B0',
  sanctuary: '#607D8B',
  default: '#6B7A57',
};

export const ZONE_FILL_OPACITY: Record<string, number> = {
  food_plot: 0.35,
  kill_plot: 0.35,
  access_route: 0.5,
  bedding: 0.4,
  stand_site: 0.8,
  water: 0.45,
  staging_area: 0.35,
  sanctuary: 0.3,
  default: 0.35,
};

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
  centerLat: number;
  centerLng: number;
  width: number;
  height: number;
}

export function getBBoxFromPolygon(geoJSONPolygon: any): BoundingBox {
  const ring: number[][] =
    geoJSONPolygon?.coordinates?.[0] ?? [];

  if (ring.length === 0) {
    throw new Error('getBBoxFromPolygon: polygon has no coordinates');
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const width = maxLng - minLng;
  const height = maxLat - minLat;

  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng,
    centerLat,
    centerLng,
    width,
    height,
  };
}

export function relativePositionToCoords(
  position: string,
  bbox: BoundingBox
): { lat: number; lng: number } {
  const { north, south, east, west, centerLat, centerLng } = bbox;

  const northLat = north * 0.8 + centerLat * 0.2;
  const southLat = south * 0.8 + centerLat * 0.2;
  const eastLng = east * 0.8 + centerLng * 0.2;
  const westLng = west * 0.8 + centerLng * 0.2;

  // For diagonal corners: 70% toward the edge, 30% toward center
  const ne_lat = north * 0.7 + centerLat * 0.3;
  const ne_lng = east * 0.7 + centerLng * 0.3;
  const se_lat = south * 0.7 + centerLat * 0.3;
  const se_lng = east * 0.7 + centerLng * 0.3;
  const sw_lat = south * 0.7 + centerLat * 0.3;
  const sw_lng = west * 0.7 + centerLng * 0.3;
  const nw_lat = north * 0.7 + centerLat * 0.3;
  const nw_lng = west * 0.7 + centerLng * 0.3;

  const normalised = (position ?? 'center').toLowerCase().trim();

  switch (normalised) {
    case 'north':
      return { lat: northLat, lng: centerLng };
    case 'northeast':
    case 'north_east':
      return { lat: ne_lat, lng: ne_lng };
    case 'east':
      return { lat: centerLat, lng: eastLng };
    case 'southeast':
    case 'south_east':
      return { lat: se_lat, lng: se_lng };
    case 'south':
      return { lat: southLat, lng: centerLng };
    case 'southwest':
    case 'south_west':
      return { lat: sw_lat, lng: sw_lng };
    case 'west':
      return { lat: centerLat, lng: westLng };
    case 'northwest':
    case 'north_west':
      return { lat: nw_lat, lng: nw_lng };
    case 'center':
    default:
      return { lat: centerLat, lng: centerLng };
  }
}

export function getSizeInDegrees(
  size: string,
  bbox: BoundingBox
): { latSpan: number; lngSpan: number } {
  const normalised = (size ?? 'medium').toLowerCase().trim();

  let fraction: number;
  switch (normalised) {
    case 'tiny':
      fraction = 0.08;
      break;
    case 'small':
      fraction = 0.15;
      break;
    case 'large':
      fraction = 0.4;
      break;
    case 'medium':
    default:
      fraction = 0.25;
      break;
  }

  return {
    latSpan: bbox.height * fraction,
    lngSpan: bbox.width * fraction,
  };
}

// Deterministic-ish pseudo-random offset so results are stable across renders
// but still look organic. We use simple math rather than Math.random() so the
// output is reproducible for a given center point.
function deterministicOffset(seed: number, scale: number): number {
  // Produces a value in [-scale, +scale]
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * 2 * scale;
}

export function buildZonePolygon(
  center: { lat: number; lng: number },
  size: { latSpan: number; lngSpan: number }
): number[][][] {
  const halfLat = size.latSpan / 2;
  const halfLng = size.lngSpan / 2;

  // ±10% irregular offsets per corner using deterministic seeds
  const jitter = 0.1;
  const seed = center.lat * 1000 + center.lng;

  const nwLat = center.lat + halfLat + deterministicOffset(seed + 1, halfLat * jitter);
  const nwLng = center.lng - halfLng + deterministicOffset(seed + 2, halfLng * jitter);

  const neLat = center.lat + halfLat + deterministicOffset(seed + 3, halfLat * jitter);
  const neLng = center.lng + halfLng + deterministicOffset(seed + 4, halfLng * jitter);

  const seLat = center.lat - halfLat + deterministicOffset(seed + 5, halfLat * jitter);
  const seLng = center.lng + halfLng + deterministicOffset(seed + 6, halfLng * jitter);

  const swLat = center.lat - halfLat + deterministicOffset(seed + 7, halfLat * jitter);
  const swLng = center.lng - halfLng + deterministicOffset(seed + 8, halfLng * jitter);

  // GeoJSON ring: [lng, lat], closed (first === last)
  const ring: number[][] = [
    [nwLng, nwLat],
    [neLng, neLat],
    [seLng, seLat],
    [swLng, swLat],
    [nwLng, nwLat], // close the ring
  ];

  return [ring];
}

export function buildStandPoint(center: { lat: number; lng: number }): number[] {
  // GeoJSON Point coordinate order: [lng, lat]
  return [center.lng, center.lat];
}

export function translateZonesToGeoJSON(
  zones: any[],
  propertyBoundary: any
): any[] {
  if (!zones || zones.length === 0) return [];

  const bbox = getBBoxFromPolygon(propertyBoundary);

  return zones
    .map((zone: any) => {
      try {
        const type: string = zone.type ?? zone.zone_type ?? 'default';
        const position: string = zone.relative_position ?? 'center';
        const sizeLabel: string = zone.relative_size ?? zone.size ?? 'medium';

        const center = relativePositionToCoords(position, bbox);
        const color = getZoneDisplayColor(type, zone.confidence ?? 'medium');
        const fillOpacity =
          ZONE_FILL_OPACITY[type] ?? ZONE_FILL_OPACITY['default'];

        const properties: Record<string, any> = {
          id: zone.id ?? `zone-${Math.random().toString(36).slice(2, 9)}`,
          name: zone.name ?? type,
          type,
          description: zone.description ?? '',
          confidence: zone.confidence ?? 'medium',
          season: zone.season ?? zone.seasons ?? null,
          color,
          fillOpacity,
        };

        if (type === 'stand_site') {
          const coordinates = buildStandPoint(center);
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates,
            },
            properties,
          };
        }

        // All other types become polygons
        const sizeDeg = getSizeInDegrees(sizeLabel, bbox);
        const coordinates = buildZonePolygon(center, sizeDeg);
        return {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates,
          },
          properties,
        };
      } catch (err) {
        // Skip malformed zones rather than crashing the whole set
        console.warn('[tonyZones] Skipping malformed zone:', zone, err);
        return null;
      }
    })
    .filter((f): f is any => f !== null);
}

export function getZoneDisplayColor(type: string, confidence: string): string {
  const base = ZONE_COLORS[type] ?? ZONE_COLORS['default'];

  const normalised = (confidence ?? 'medium').toLowerCase().trim();

  if (normalised === 'high') {
    // Full saturation — return base color as-is
    return base;
  }

  // Parse hex to RGB
  const hex = base.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  let muteAmount: number;
  if (normalised === 'medium') {
    muteAmount = 0.2; // blend 20% toward a neutral grey
  } else {
    // low or anything else
    muteAmount = 0.5; // blend 50% toward neutral grey
  }

  const neutral = 128;
  const mr = Math.round(r + (neutral - r) * muteAmount);
  const mg = Math.round(g + (neutral - g) * muteAmount);
  const mb = Math.round(b + (neutral - b) * muteAmount);

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mr)}${toHex(mg)}${toHex(mb)}`;
}
