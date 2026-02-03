import { latLngToCell, polygonToCells } from "h3-js";

// 1. Define the Map Bounds interface
interface Bounds { north: number; south: number; east: number; west: number; }

// 2. The Translator Function
export function convertBoxToHex(
  box_2d: [number, number, number, number], // [ymin, xmin, ymax, xmax] (0-1000)
  bounds: Bounds,
  resolution: number
): string[] {
  // Step A: Calculate Lat/Lng width & height of the user's view
  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;

  // Step B: Convert 0-1000 coordinates to real Lat/Lng
  // (ymin is top in image, but north is 'up' in lat)
  const southLat = bounds.south + (box_2d[0] / 1000) * latRange;
  const northLat = bounds.south + (box_2d[2] / 1000) * latRange; // ymax
  const westLng = bounds.west + (box_2d[1] / 1000) * lngRange;
  const eastLng = bounds.west + (box_2d[3] / 1000) * lngRange;

  // Step C: Create the Polygon for H3
  const polygon = [
    [northLat, westLng],
    [northLat, eastLng],
    [southLat, eastLng],
    [southLat, westLng],
    [northLat, westLng] // Close the loop
  ];

  // Step D: Stamp the Grid
  return polygonToCells(polygon, resolution);
}
