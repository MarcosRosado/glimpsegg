/**
 * Converts Dota 2 coordinates (from STRATZ, OpenDota or Valve replay logs)
 * to 0-100 percentage values for rendering on a 2D Minimap canvas/SVG.
 *
 * In standard Dota 2:
 * X ranges from ~64 to ~192 (or -8200 to +8200)
 * Y ranges from ~64 to ~192 (where higher Y is North/Top, but in CSS top is 0%)
 */
export function normalizeMinimapCoords(x: number, y: number): { leftPercent: number; topPercent: number } {
  // If coordinates are already 0 - 100
  if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
    return {
      leftPercent: x,
      topPercent: 100 - y, // Invert Y for screen coordinates
    };
  }

  // If coordinates are in STRATZ 64-192 byte format
  if (x >= 50 && x <= 210 && y >= 50 && y <= 210) {
    const MIN_VAL = 64;
    const MAX_VAL = 192;
    const normX = Math.max(0, Math.min(100, ((x - MIN_VAL) / (MAX_VAL - MIN_VAL)) * 100));
    const normY = Math.max(0, Math.min(100, ((y - MIN_VAL) / (MAX_VAL - MIN_VAL)) * 100));
    return {
      leftPercent: normX,
      topPercent: 100 - normY,
    };
  }

  // If coordinates are in Valve engine units (-8200 to 8200)
  const MAP_BOUND_MIN = -8000;
  const MAP_BOUND_MAX = 8000;
  const normX = Math.max(0, Math.min(100, ((x - MAP_BOUND_MIN) / (MAP_BOUND_MAX - MAP_BOUND_MIN)) * 100));
  const normY = Math.max(0, Math.min(100, ((y - MAP_BOUND_MIN) / (MAP_BOUND_MAX - MAP_BOUND_MIN)) * 100));

  return {
    leftPercent: normX,
    topPercent: 100 - normY,
  };
}
