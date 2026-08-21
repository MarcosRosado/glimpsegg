/**
 * Geometria do mapa do Dota 2 e constantes de visao.
 *
 * ESPACO DE COORDENADAS DA STRATZ ("celulas")
 * -------------------------------------------
 * Eventos posicionais da STRATZ (`wardEvents`, `deathEvents`, `runeEvents`) vem num
 * espaco de bytes que vai de 64 a 192, cobrindo a extensao completa do mundo
 * (-8192 .. +8192 unidades). Logo: 128 celulas para 16384 unidades = 128 unidades
 * por celula.
 *
 * Y cresce para o NORTE, ao contrario do CSS (onde `top: 0` e o topo). Toda conversao
 * precisa inverter o Y.
 *
 * MEDICOES (nao apagar — e o que sustenta as constantes abaixo)
 * ------------------------------------------------------------
 * Amostra de 544 wards reais (6 partidas parseadas, `playbackData.wardEvents`):
 *   - x variou de 64 a 192 EXATAMENTE; y de 68 a 184.
 *   - Todas as coordenadas sao PARES: o grid e quantizado em passos de 2 celulas
 *     (256 unidades de mundo). Nao existe resolucao melhor que isso na API.
 * Spots de runa, estaveis nas 6 partidas (ancoras fixas do mapa, boas para calibrar):
 *   - runas de poder do rio: (114, 136) e (136, 118)
 *   - runas de bounty:       (132, 90)  e (120, 162)
 * CALIBRACAO CONTRA A ARTE (public/minimap.png) — ver MAP_IMAGE_INSET abaixo.
 *
 * A primeira versao esticava 64..192 de borda a borda da imagem. Estava ERRADA: o
 * asset da Valve tem uma faixa fora-de-jogo (linha de arvores + vinheta) em volta do
 * terreno jogavel, entao esticar de borda a borda empurra tudo para fora do centro.
 * O erro chegava a 46px numa imagem de 1024 (4,5% da largura do mapa) — visivel a olho
 * nu, e foi assim que apareceu: as ancoras de runa nao batiam com as runas.
 *
 * O teste que deixou passar era fraco: "a runa cai sobre pixel de agua?". O rio é uma
 * faixa larga e diagonal — quase qualquer coisa passa nesse teste.
 */

export const MAP_CELL_MIN = 64;
export const MAP_CELL_MAX = 192;
export const MAP_CELL_SPAN = MAP_CELL_MAX - MAP_CELL_MIN; // 128

/** Unidades de mundo por celula: 16384 / 128. */
export const WORLD_UNITS_PER_CELL = 128;
export const WORLD_MIN = -8192;
export const WORLD_MAX = 8192;

/** A API quantiza posicao em passos de 2 celulas. Usado so para documentar precisao. */
export const MAP_CELL_QUANTIZATION = 2;

/**
 * Tolerancia de sanidade. Fora daqui a coordenada e rejeitada (retorna null), nunca
 * clampada — clampar transforma dado corrompido em pino plausivel no canto do mapa.
 */
export const CELL_TOLERANCE_MIN = 60;
export const CELL_TOLERANCE_MAX = 200;

/**
 * Ancoras verificadas na API: spots fixos de runa, estaveis em 6 partidas.
 * As de poder hospedam varios tipos de runa (ciclam); as de bounty so o tipo 5.
 * Usadas pelo overlay de calibracao e pelos testes.
 *
 * PRECISAO: a API quantiza posicao em passos de 2 celulas (MAP_CELL_QUANTIZATION) —
 * todo valor observado é par. Logo cada ancora carrega +-1 passo de incerteza, ou seja
 * ~14px numa imagem de 1024. Isso explica o residuo que sobra depois da calibracao:
 * o par de bounty é exatamente simetrico em torno da celula 126, e o de poder deveria
 * ser tambem — (114,136) espelhado da (138,116), mas a API reporta (136,118), a exatos
 * 2 celulas em cada eixo. Nao vale "corrigir" esses valores: seria inventar precisao
 * que a fonte nao tem.
 */
export const MAP_LANDMARKS = {
  powerRuneNorth: { x: 114, y: 136 },
  powerRuneSouth: { x: 136, y: 118 },
  bountyRuneA: { x: 132, y: 90 },
  bountyRuneB: { x: 120, y: 162 },
} as const;

/**
 * Onde as celulas 64..192 caem DENTRO de public/minimap.png, em % da imagem.
 *
 * CALIBRADO A MAO, com lupa de 6x, posicionando as quatro ancoras de runa sobre a arte
 * e resolvendo escala + deslocamento por minimos quadrados com escala UNICA para os
 * dois eixos. Span resultante: 82,41% nos dois eixos (6,593 px/celula em 1024).
 *
 * O QUE ESTE RETANGULO É: as celulas 64 e 192 delimitam a area jogavel. A arte do
 * asset inclui uma faixa de arvores fora-de-jogo bem mais larga do que aparenta, entao
 * a caixa de coordenadas fica bem DENTRO do terreno desenhado — nao coincide com a
 * borda visivel da arte, e nao deve.
 *
 * PORQUE ISSO FOI CALIBRADO A MAO, e nao ajustado por script
 * ---------------------------------------------------------
 * Tres tentativas automaticas falharam, cada uma por um motivo diferente, e vale
 * registrar para ninguem repetir:
 *   1. Esticar 64..192 de borda a borda da imagem (span 100%). Errado por ate 4,5% da
 *      largura. O teste que deixou passar era fraco: "a runa cai sobre pixel de agua?"
 *      — o rio é uma faixa larga e diagonal, quase tudo passa nesse teste.
 *   2. Ajustar os quatro lados livremente contra marcacao aproximada (span 91,16%).
 *      Saiu com 8% de anisotropia num mapa quadrado — sinal claro de estar ajustando
 *      imprecisao de marcacao em vez de geometria.
 *   3. Fixar a escala pela borda medida da arte (span 88,08%). Baseado na premissa
 *      errada de que a caixa de coordenadas coincide com o terreno desenhado.
 * As tentativas 2 e 3 sao quase identicas na regiao central onde as runas ficam
 * (diferem 1-2px la, divergindo so nas bordas), e por isso nenhuma das duas corrigiu o
 * desvio percebido: o erro era comum as duas, e nenhuma quantidade de reajuste dos
 * mesmos parametros contra marcacao imprecisa ia encontrar.
 *
 * LIMITE DE PRECISAO: a API quantiza posicao em passos de 2 celulas
 * (MAP_CELL_QUANTIZATION) — todo valor observado é par. Isso impoe ~13px de incerteza
 * irredutivel no asset de 1024, independente da qualidade da calibracao.
 *
 * PARA RECALIBRAR (novo patch, novo asset): use a ferramenta de calibragem — mapa em
 * tamanho grande, lupa no arraste, ajuste isotropico e as constantes prontas na saida.
 * Ancore primeiro nas duas de BOUNTY DA JUNGLE (base de 73 celulas, menor erro
 * relativo) e depois nas de PODER, que ficam dentro da agua do rio. NAO use a borda da
 * arte como referencia, e mantenha o span igual nos dois eixos.
 */
export const MAP_IMAGE_INSET = {
  left: 9.07,
  right: 8.52,
  top: 7.43,
  bottom: 10.16,
} as const;

/** Fracao da largura/altura da imagem ocupada pelas 128 celulas jogaveis. */
export const MAP_PLAYABLE_WIDTH_PCT = 100 - MAP_IMAGE_INSET.left - MAP_IMAGE_INSET.right;
export const MAP_PLAYABLE_HEIGHT_PCT = 100 - MAP_IMAGE_INSET.top - MAP_IMAGE_INSET.bottom;

/**
 * Visao e duracao de ward (patch 7.4x). Um patch novo = uma edicao aqui.
 * Vizinho de constants/gameVersion.ts de proposito.
 */
export const OBSERVER_VISION_UNITS = 1600;
export const SENTRY_TRUE_SIGHT_UNITS = 1000;
export const OBSERVER_DURATION_SEC = 360;
export const SENTRY_DURATION_SEC = 420;

/** Raios em celulas — e nisso que o SVG desenha, entao escala junto com o container. */
export const OBSERVER_VISION_CELLS = OBSERVER_VISION_UNITS / WORLD_UNITS_PER_CELL; // 12.5
export const SENTRY_VISION_CELLS = SENTRY_TRUE_SIGHT_UNITS / WORLD_UNITS_PER_CELL; // 7.8125

export const WARD_DURATION_SEC: Record<'OBSERVER' | 'SENTRY', number> = {
  OBSERVER: OBSERVER_DURATION_SEC,
  SENTRY: SENTRY_DURATION_SEC,
};

export const WARD_VISION_CELLS: Record<'OBSERVER' | 'SENTRY', number> = {
  OBSERVER: OBSERVER_VISION_CELLS,
  SENTRY: SENTRY_VISION_CELLS,
};

/**
 * `stats.wards[].type` e um Int, nao o enum `WardType` do playbackData.
 * Confirmado por cruzamento numa partida real: playbackData trouxe
 * `{indexId: 1278, time: -9, positionX: 122, positionY: 124, fromPlayer: 3, wardType: SENTRY}`
 * e o `stats.wards` do slot 3 trouxe `{time: -9, type: 1, positionX: 122, positionY: 124}`.
 */
export const STRATZ_WARD_TYPE_INT: Record<number, 'OBSERVER' | 'SENTRY'> = {
  0: 'OBSERVER',
  1: 'SENTRY',
};
