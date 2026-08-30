import { describe, it, expect } from 'vitest';
import {
  isStratzCell,
  stratzCellToMap,
  stratzCellToPercent,
  worldToStratzCell,
  stratzCellToWorld,
  cellsToPercent,
} from '../../src/utils/minimapCoords';
import {
  MAP_LANDMARKS,
  MAP_IMAGE_INSET,
  MAP_PLAYABLE_WIDTH_PCT,
  MAP_PLAYABLE_HEIGHT_PCT,
  OBSERVER_VISION_CELLS,
  SENTRY_VISION_CELLS,
} from '../../src/constants/mapGeometry';

const I = MAP_IMAGE_INSET;
const RIGHT = 100 - I.right;
const BOTTOM = 100 - I.bottom;

/**
 * Os cantos NAO caem em 0%/100% da imagem: o asset da Valve tem faixa fora-de-jogo em
 * volta do terreno, entao as 128 celulas ocupam so a area jogavel (MAP_IMAGE_INSET).
 * A primeira versao esticava de borda a borda e errava por ate 4,5% da largura do mapa,
 * o que era visivel a olho nu nas ancoras de runa.
 */
describe('stratzCellToPercent — cantos da AREA JOGAVEL', () => {
  it('mapeia o canto sudoeste (64, 64) para o canto inferior esquerdo do terreno', () => {
    const p = stratzCellToPercent(64, 64)!;
    expect(p.leftPercent).toBeCloseTo(I.left, 6);
    expect(p.topPercent).toBeCloseTo(BOTTOM, 6);
  });

  it('mapeia o canto nordeste (192, 192) para o canto superior direito do terreno', () => {
    const p = stratzCellToPercent(192, 192)!;
    expect(p.leftPercent).toBeCloseTo(RIGHT, 6);
    expect(p.topPercent).toBeCloseTo(I.top, 6);
  });

  it('mapeia o canto noroeste (64, 192) para o canto superior esquerdo do terreno', () => {
    const p = stratzCellToPercent(64, 192)!;
    expect(p.leftPercent).toBeCloseTo(I.left, 6);
    expect(p.topPercent).toBeCloseTo(I.top, 6);
  });

  it('mapeia o canto sudeste (192, 64) para o canto inferior direito do terreno', () => {
    const p = stratzCellToPercent(192, 64)!;
    expect(p.leftPercent).toBeCloseTo(RIGHT, 6);
    expect(p.topPercent).toBeCloseTo(BOTTOM, 6);
  });

  it('mapeia o centro (128, 128) para o centro da area jogavel', () => {
    const p = stratzCellToPercent(128, 128)!;
    expect(p.leftPercent).toBeCloseTo(I.left + MAP_PLAYABLE_WIDTH_PCT / 2, 6);
    expect(p.topPercent).toBeCloseTo(I.top + MAP_PLAYABLE_HEIGHT_PCT / 2, 6);
  });

  it('nenhum canto cai fora da imagem', () => {
    for (const [x, y] of [[64, 64], [192, 192], [64, 192], [192, 64]]) {
      const p = stratzCellToPercent(x, y)!;
      expect(p.leftPercent).toBeGreaterThanOrEqual(0);
      expect(p.leftPercent).toBeLessThanOrEqual(100);
      expect(p.topPercent).toBeGreaterThanOrEqual(0);
      expect(p.topPercent).toBeLessThanOrEqual(100);
    }
  });
});

/**
 * TRAVA DE CALIBRACAO. Estes numeros vieram de ajuste contra a arte, ancorado no par
 * de runas de bounty e validado pelas de poder caindo no rio. Se alguem mexer em
 * MAP_IMAGE_INSET sem recalibrar, este teste avisa.
 */
describe('calibracao do enquadramento do PNG', () => {
  it('as 128 celulas cobrem ~82% da imagem, nao 100%', () => {
    // Calibrado a mao com lupa: 6,593 px/celula em 1024. A arte tem uma faixa de
    // arvores fora-de-jogo larga, entao a area jogavel fica bem dentro do terreno.
    expect(MAP_PLAYABLE_WIDTH_PCT).toBeCloseTo(82.41, 2);
    expect(MAP_PLAYABLE_HEIGHT_PCT).toBeCloseTo(82.41, 2);
  });

  it('a escala é praticamente isotropica (o mapa e a imagem sao quadrados)', () => {
    const aniso = Math.abs(MAP_PLAYABLE_WIDTH_PCT / MAP_PLAYABLE_HEIGHT_PCT - 1);
    expect(aniso).toBeLessThan(0.005);
  });

  it('as runas de poder caem no terco central (estao no rio)', () => {
    for (const l of [MAP_LANDMARKS.powerRuneNorth, MAP_LANDMARKS.powerRuneSouth]) {
      const p = stratzCellToPercent(l.x, l.y)!;
      expect(p.leftPercent).toBeGreaterThan(33);
      expect(p.leftPercent).toBeLessThan(67);
      expect(p.topPercent).toBeGreaterThan(33);
      expect(p.topPercent).toBeLessThan(67);
    }
  });

  it('as ancoras de bounty sao simetricas em torno da celula 126, nao da 128', () => {
    // Medido: (132,90) e (120,162) tem ponto medio exato (126,126). Ou seja, o eixo de
    // simetria observado fica 2 celulas a oeste/sul do centro geometrico da faixa
    // 64..192. A quantizacao da API é de 2 celulas (todo valor é par) e parece ser
    // por piso, o que explica o desvio de uma unidade de quantizacao.
    const { bountyRuneA: a, bountyRuneB: b } = MAP_LANDMARKS;
    expect((a.x + b.x) / 2).toBe(126);
    expect((a.y + b.y) / 2).toBe(126);

    // Em porcentagem, o ponto medio fica pouco a oeste/sul do centro da area jogavel.
    const pa = stratzCellToPercent(a.x, a.y)!;
    const pb = stratzCellToPercent(b.x, b.y)!;
    const cx = I.left + MAP_PLAYABLE_WIDTH_PCT / 2;
    const cy = I.top + MAP_PLAYABLE_HEIGHT_PCT / 2;
    const oneCellX = MAP_PLAYABLE_WIDTH_PCT / 128;
    const oneCellY = MAP_PLAYABLE_HEIGHT_PCT / 128;
    expect((pa.leftPercent + pb.leftPercent) / 2).toBeCloseTo(cx - 2 * oneCellX, 4);
    expect((pa.topPercent + pb.topPercent) / 2).toBeCloseTo(cy + 2 * oneCellY, 4);
  });
});

describe('stratzCellToPercent — inversao do Y', () => {
  it('Y maior (norte) resulta em topPercent menor', () => {
    const norte = stratzCellToPercent(128, 180)!;
    const sul = stratzCellToPercent(128, 80)!;
    expect(norte.topPercent).toBeLessThan(sul.topPercent);
  });
});

describe('REGRESSAO: coordenadas do lado Radiant nao sao tratadas como porcentagem', () => {
  // A implementacao antiga tinha um ramo "if (x >= 0 && x <= 100 && y >= 0 && y <= 100)"
  // que devolvia {leftPercent: x, topPercent: 100 - y}. Toda a base/jungle/safelane do
  // Radiant vive na faixa 64-100, entao caia nesse ramo e era plotada errado.
  it('(88, 94) e interpretado como celula, nao como porcentagem', () => {
    const got = stratzCellToPercent(88, 94)!;
    // Como celula: cx=24/128 e cy=98/128 da area jogavel, deslocados pelo inset.
    expect(got.leftPercent).toBeCloseTo(I.left + (24 / 128) * MAP_PLAYABLE_WIDTH_PCT, 6);
    expect(got.topPercent).toBeCloseTo(I.top + (98 / 128) * MAP_PLAYABLE_HEIGHT_PCT, 6);
    // O bug antigo teria devolvido exatamente {88, 6}
    expect(got.leftPercent).not.toBeCloseTo(88, 1);
    expect(got.topPercent).not.toBeCloseTo(6, 1);
  });

  it('(70, 70) — canto da base Radiant — fica no quadrante inferior esquerdo', () => {
    const got = stratzCellToPercent(70, 70)!;
    expect(got.leftPercent).toBeLessThan(15);
    expect(got.topPercent).toBeGreaterThan(85);
  });
});

describe('rejeicao fora da tolerancia (nunca clampa)', () => {
  it.each([
    [0, 0],
    [59, 128],
    [128, 59],
    [201, 128],
    [128, 201],
    [-8000, 8000],
  ])('rejeita (%i, %i) retornando null', (x, y) => {
    expect(stratzCellToMap(x, y)).toBeNull();
    expect(stratzCellToPercent(x, y)).toBeNull();
    expect(isStratzCell(x, y)).toBe(false);
  });

  it('rejeita NaN e Infinity', () => {
    expect(stratzCellToPercent(NaN, 128)).toBeNull();
    expect(stratzCellToPercent(128, Infinity)).toBeNull();
  });

  it('aceita a borda da tolerancia', () => {
    expect(isStratzCell(60, 200)).toBe(true);
    expect(isStratzCell(200, 60)).toBe(true);
  });

  it('aceita float (deathEvents pode nao vir inteiro)', () => {
    const got = stratzCellToPercent(128.5, 127.5)!;
    expect(got).not.toBeNull();
    expect(got.leftPercent).toBeCloseTo(
      I.left + (64.5 / 128) * MAP_PLAYABLE_WIDTH_PCT,
      6,
    );
  });
});

describe('conversao mundo <-> celula', () => {
  it('celula 128 e o centro do mundo', () => {
    expect(stratzCellToWorld(128, 128)).toEqual({ worldX: 0, worldY: 0 });
    expect(worldToStratzCell(0, 0)).toEqual({ x: 128, y: 128 });
  });

  it('ida e volta preserva o valor', () => {
    for (const [x, y] of [[64, 64], [192, 192], [114, 136], [136, 118]]) {
      const { worldX, worldY } = stratzCellToWorld(x, y);
      const back = worldToStratzCell(worldX, worldY);
      expect(back.x).toBeCloseTo(x, 9);
      expect(back.y).toBeCloseTo(y, 9);
    }
  });

  it('a extensao do mundo bate com os limites do mapa', () => {
    expect(stratzCellToWorld(64, 64)).toEqual({ worldX: -8192, worldY: -8192 });
    expect(stratzCellToWorld(192, 192)).toEqual({ worldX: 8192, worldY: 8192 });
  });
});

describe('MAP_LANDMARKS — ancoras verificadas na API', () => {
  it('todas as ancoras sao coordenadas validas', () => {
    for (const [name, { x, y }] of Object.entries(MAP_LANDMARKS)) {
      expect(isStratzCell(x, y), name).toBe(true);
    }
  });

  it('a runa de poder norte fica acima e a esquerda da sul', () => {
    const n = stratzCellToPercent(MAP_LANDMARKS.powerRuneNorth.x, MAP_LANDMARKS.powerRuneNorth.y)!;
    const s = stratzCellToPercent(MAP_LANDMARKS.powerRuneSouth.x, MAP_LANDMARKS.powerRuneSouth.y)!;
    expect(n.topPercent).toBeLessThan(s.topPercent);
    expect(n.leftPercent).toBeLessThan(s.leftPercent);
  });

  it('as runas de bounty sao aproximadamente simetricas em relacao ao centro', () => {
    const { bountyRuneA, bountyRuneB } = MAP_LANDMARKS;
    // Medido: (132,90) e (120,162) tem ponto medio (126,126) — simetria limpa.
    expect((bountyRuneA.x + bountyRuneB.x) / 2).toBe(126);
    expect((bountyRuneA.y + bountyRuneB.y) / 2).toBe(126);
  });
});

describe('cellsToPercent — raios de visao', () => {
  it('raio de observer é ~9.8% do lado da area jogavel', () => {
    expect(cellsToPercent(OBSERVER_VISION_CELLS)).toBeCloseTo(
      (OBSERVER_VISION_CELLS / 128) * MAP_PLAYABLE_WIDTH_PCT,
      6,
    );
    expect(cellsToPercent(OBSERVER_VISION_CELLS)).toBeGreaterThan(8);
    expect(cellsToPercent(OBSERVER_VISION_CELLS)).toBeLessThan(10);
  });

  it('raio de sentry é ~5.6% do lado da area jogavel', () => {
    expect(cellsToPercent(SENTRY_VISION_CELLS)).toBeGreaterThan(5);
    expect(cellsToPercent(SENTRY_VISION_CELLS)).toBeLessThan(6.5);
  });

  it('observer ve mais longe que sentry', () => {
    expect(OBSERVER_VISION_CELLS).toBeGreaterThan(SENTRY_VISION_CELLS);
  });
});
