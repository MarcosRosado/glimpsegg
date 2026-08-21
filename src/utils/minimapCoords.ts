import {
  MAP_CELL_MIN,
  MAP_CELL_MAX,
  MAP_CELL_SPAN,
  WORLD_UNITS_PER_CELL,
  CELL_TOLERANCE_MIN,
  CELL_TOLERANCE_MAX,
  MAP_IMAGE_INSET,
  MAP_PLAYABLE_WIDTH_PCT,
  MAP_PLAYABLE_HEIGHT_PCT,
} from '../constants/mapGeometry';

/**
 * Conversao de coordenada do mapa do Dota 2 para posicao de tela.
 *
 * CONTRATO: quem chama DECLARA o espaco de origem. Esta funcao nunca adivinha.
 *
 * A versao anterior inferia o espaco pela faixa de valores, e o ramo
 * "0 <= x,y <= 100 => ja esta em porcentagem" engolia coordenadas reais da STRATZ
 * na faixa 64-100 — que e exatamente a base, a jungle e a safelane do Radiant.
 * Resultado: todo o lado Radiant era plotado errado. Por isso a inferencia saiu.
 *
 * Formulas (ver constants/mapGeometry.ts para as medicoes que as sustentam):
 *   cx = x - 64             // 64 -> 0,   192 -> 128
 *   cy = 192 - y            // 192 -> 0,  64  -> 128   (inversao do Y para tela)
 *   percent = (c / 128) * 100
 *   world = (cell - 128) * 128
 */

/** Ponto no espaco 0..128 do SVG, com Y ja invertido para tela. */
export interface MapPoint {
  cx: number;
  cy: number;
}

export interface MapPercent {
  leftPercent: number;
  topPercent: number;
}

/** Coordenada plausivel no espaco de celulas da STRATZ? */
export function isStratzCell(x: number, y: number): boolean {
  return (
    typeof x === 'number' &&
    typeof y === 'number' &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= CELL_TOLERANCE_MIN &&
    x <= CELL_TOLERANCE_MAX &&
    y >= CELL_TOLERANCE_MIN &&
    y <= CELL_TOLERANCE_MAX
  );
}

/**
 * Celula da STRATZ -> espaco 0..128 do SVG (Y invertido).
 * Retorna null para coordenada fora da tolerancia: quem chama filtra e conta o
 * descarte. Clampar seria pior — viraria um pino plausivel num canto do mapa.
 */
export function stratzCellToMap(x: number, y: number): MapPoint | null {
  if (!isStratzCell(x, y)) return null;
  return {
    cx: x - MAP_CELL_MIN,
    cy: MAP_CELL_MAX - y,
  };
}

/**
 * Celula da STRATZ -> porcentagem DO CONTAINER DA IMAGEM, para posicionar elementos
 * HTML sobre o minimapa.
 *
 * Aplica MAP_IMAGE_INSET: o asset da Valve tem faixa fora-de-jogo em volta do terreno
 * jogavel, entao as 128 celulas nao ocupam 100% da imagem. Ignorar isso empurra tudo
 * para fora do centro — foi o bug que fez as ancoras de runa nao baterem com as runas.
 *
 * Para desenhar DENTRO de um SVG cujo viewBox ja é a area jogavel (0..128), use
 * `stratzCellToMap` — la o inset nao se aplica, porque a propria caixa do SVG ja esta
 * posicionada na area jogavel.
 */
export function stratzCellToPercent(x: number, y: number): MapPercent | null {
  const point = stratzCellToMap(x, y);
  if (!point) return null;
  return {
    leftPercent: MAP_IMAGE_INSET.left + (point.cx / MAP_CELL_SPAN) * MAP_PLAYABLE_WIDTH_PCT,
    topPercent: MAP_IMAGE_INSET.top + (point.cy / MAP_CELL_SPAN) * MAP_PLAYABLE_HEIGHT_PCT,
  };
}

/** Unidades de mundo da Valve -> celula da STRATZ. Celula 128 == centro do mapa == mundo 0. */
export function worldToStratzCell(worldX: number, worldY: number): { x: number; y: number } {
  return {
    x: worldX / WORLD_UNITS_PER_CELL + 128,
    y: worldY / WORLD_UNITS_PER_CELL + 128,
  };
}

/** Celula da STRATZ -> unidades de mundo da Valve. */
export function stratzCellToWorld(x: number, y: number): { worldX: number; worldY: number } {
  return {
    worldX: (x - 128) * WORLD_UNITS_PER_CELL,
    worldY: (y - 128) * WORLD_UNITS_PER_CELL,
  };
}

/**
 * Distancia em celulas -> porcentagem do lado da AREA JOGAVEL.
 * Para raio de visao dentro do SVG, prefira as constantes em celulas
 * (WARD_VISION_CELLS) — o viewBox ja esta nessa unidade e escala sozinho.
 */
export function cellsToPercent(cells: number): number {
  return (cells / MAP_CELL_SPAN) * MAP_PLAYABLE_WIDTH_PCT;
}
