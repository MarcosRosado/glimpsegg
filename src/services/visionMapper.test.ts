import { describe, it, expect } from 'vitest';
import {
  buildVisionData,
  computePlayerVisionStats,
  observerUptimePct,
  wardsBySlot,
} from './visionMapper';
import { MatchPlayer } from '../types/dota';
import { OBSERVER_DURATION_SEC, SENTRY_DURATION_SEC } from '../constants/mapGeometry';

/** Dez jogadores com os slots reais do Dota: 0-4 Radiant, 128-132 Dire. */
function makePlayers(): MatchPlayer[] {
  const mk = (slot: number, heroId: number): MatchPlayer =>
    ({ playerSlot: slot, heroId, isRadiant: slot < 128 } as MatchPlayer);
  return [
    mk(0, 1), mk(1, 2), mk(2, 3), mk(3, 4), mk(4, 5),
    mk(128, 11), mk(129, 12), mk(130, 13), mk(131, 14), mk(132, 15),
  ];
}

const ev = (o: Partial<Record<string, any>>) => ({
  indexId: 1, time: 100, positionX: 120, positionY: 130,
  fromPlayer: 0, wardType: 'OBSERVER', action: 'SPAWN', playerDestroyed: null,
  ...o,
});

describe('buildVisionData — caminho PLAYBACK', () => {
  it('pareia SPAWN com DESPAWN pelo indexId e calcula tempo de vida real', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 123,
        playbackData: { wardEvents: [ev({ time: 100 }), ev({ time: 340, action: 'DESPAWN' })] },
        players: [],
      },
      makePlayers(),
      2400,
    );
    expect(v.source).toBe('PLAYBACK');
    expect(v.wards).toHaveLength(1);
    const w = v.wards[0];
    expect(w.spawnTime).toBe(100);
    expect(w.expireTime).toBe(340);
    expect(w.lifetimeSeconds).toBe(240);
    expect(w.expiryInferred).toBe(false);
  });

  it('atribui a ward ao jogador via fromPlayer, inclusive nos slots Dire (128-132)', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 1,
        playbackData: {
          wardEvents: [
            ev({ indexId: 1, fromPlayer: 3 }),
            ev({ indexId: 2, fromPlayer: 130 }),
          ],
        },
        players: [],
      },
      makePlayers(),
      2400,
    );
    const byId = new Map(v.wards.map((w) => [w.indexId, w]));
    expect(byId.get(1)!.team).toBe('RADIANT');
    expect(byId.get(1)!.placedByHeroId).toBe(4);
    expect(byId.get(2)!.team).toBe('DIRE');
    expect(byId.get(2)!.placedByHeroId).toBe(13);
  });

  it('slot irresolvivel vira team UNKNOWN e é contado, nunca inferido pela posicao', () => {
    const v = buildVisionData(
      { parsedDateTime: 1, playbackData: { wardEvents: [ev({ fromPlayer: 77 })] }, players: [] },
      makePlayers(),
      2400,
    );
    expect(v.wards[0].team).toBe('UNKNOWN');
    expect(v.unattributedWards).toBe(1);
  });

  it('fromPlayer null tambem vira UNKNOWN', () => {
    const v = buildVisionData(
      { parsedDateTime: 1, playbackData: { wardEvents: [ev({ fromPlayer: null })] }, players: [] },
      makePlayers(),
      2400,
    );
    expect(v.wards[0].team).toBe('UNKNOWN');
    expect(v.wards[0].placedBySlot).toBeNull();
  });

  it('playerDestroyed produz deward com a coordenada da ward morta', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 1,
        playbackData: {
          wardEvents: [
            ev({ time: 60, positionX: 100, positionY: 150 }),
            ev({ time: 200, action: 'DESPAWN', playerDestroyed: 129, positionX: 100, positionY: 150 }),
          ],
        },
        players: [],
      },
      makePlayers(),
      2400,
    );
    expect(v.wards[0].wasDestroyed).toBe(true);
    expect(v.wards[0].destroyedBySlot).toBe(129);
    expect(v.wards[0].destroyedByHeroId).toBe(12);
    expect(v.dewards).toHaveLength(1);
    expect(v.dewards[0]).toMatchObject({ time: 200, bySlot: 129, team: 'DIRE', x: 100, y: 150 });
  });

  it('DESPAWN sem playerDestroyed = expirou naturalmente, nao foi destruida', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 1,
        playbackData: { wardEvents: [ev({ time: 60 }), ev({ time: 420, action: 'DESPAWN' })] },
        players: [],
      },
      makePlayers(),
      2400,
    );
    expect(v.wards[0].wasDestroyed).toBe(false);
    expect(v.dewards).toHaveLength(0);
  });

  it('indexId reciclado fecha a ward anterior no instante do novo spawn', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 1,
        playbackData: {
          wardEvents: [
            ev({ indexId: 5, time: 100 }),
            ev({ indexId: 5, time: 500, positionX: 150, positionY: 90 }),
          ],
        },
        players: [],
      },
      makePlayers(),
      2400,
    );
    expect(v.wards).toHaveLength(2);
    const first = v.wards.find((w) => w.spawnTime === 100)!;
    expect(first.expireTime).toBe(500);
    expect(first.expiryInferred).toBe(true);
    expect(first.wasDestroyed).toBe(false);
    // Chaves distintas mesmo com o mesmo indexId.
    expect(new Set(v.wards.map((w) => w.key)).size).toBe(2);
  });

  it('DESPAWN orfao é descartado e contado, sem inventar spawn', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 1,
        playbackData: { wardEvents: [ev({ indexId: 9, time: 300, action: 'DESPAWN' })] },
        players: [],
      },
      makePlayers(),
      2400,
    );
    expect(v.wards).toHaveLength(0);
    expect(v.droppedEvents).toBe(1);
    expect(v.source).toBe('NONE');
  });

  it('SPAWN sem DESPAWN no fim do jogo estima a expiracao e marca como inferida', () => {
    const v = buildVisionData(
      { parsedDateTime: 1, playbackData: { wardEvents: [ev({ time: 100 })] }, players: [] },
      makePlayers(),
      2400,
    );
    const w = v.wards[0];
    expect(w.expireTime).toBe(100 + OBSERVER_DURATION_SEC);
    expect(w.expiryInferred).toBe(true);
  });

  it('ward viva ao apitar tem a expiracao clampada na duracao da partida', () => {
    const v = buildVisionData(
      { parsedDateTime: 1, playbackData: { wardEvents: [ev({ time: 1000 })] }, players: [] },
      makePlayers(),
      1100,
    );
    expect(v.wards[0].expireTime).toBe(1100);
    expect(v.wards[0].lifetimeSeconds).toBe(100);
  });

  it('preserva tempos negativos (wards pre-horn) sem clampar', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 1,
        playbackData: {
          wardEvents: [
            ev({ indexId: 1, time: -54, wardType: 'OBSERVER' }),
            ev({ indexId: 2, time: -9, wardType: 'SENTRY' }),
          ],
        },
        players: [],
      },
      makePlayers(),
      2400,
    );
    const times = v.wards.map((w) => w.spawnTime).sort((a, b) => a - b);
    expect(times).toEqual([-54, -9]);
  });

  it('nao confia na ordem do payload', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 1,
        playbackData: {
          wardEvents: [ev({ time: 400, action: 'DESPAWN' }), ev({ time: 100 })],
        },
        players: [],
      },
      makePlayers(),
      2400,
    );
    expect(v.wards).toHaveLength(1);
    expect(v.wards[0].lifetimeSeconds).toBe(300);
    expect(v.droppedEvents).toBe(0);
  });

  it('descarta SPAWN com coordenada fora da tolerancia', () => {
    const v = buildVisionData(
      { parsedDateTime: 1, playbackData: { wardEvents: [ev({ positionX: 0, positionY: 0 })] }, players: [] },
      makePlayers(),
      2400,
    );
    expect(v.wards).toHaveLength(0);
    expect(v.droppedEvents).toBe(1);
  });

  it('sentry usa a duracao de sentry, nao de observer', () => {
    const v = buildVisionData(
      { parsedDateTime: 1, playbackData: { wardEvents: [ev({ time: 0, wardType: 'SENTRY' })] }, players: [] },
      makePlayers(),
      2400,
    );
    expect(v.wards[0].expireTime).toBe(SENTRY_DURATION_SEC);
  });
});

describe('buildVisionData — fallback PLAYER_STATS', () => {
  const rawPlayers = () => [
    { stats: { wards: [{ time: 66, type: 1, positionX: 88, positionY: 154 }], wardDestruction: [{ time: 300, gold: 100, experience: 50, isWard: true }] } },
    ...Array.from({ length: 9 }, () => ({ stats: { wards: [], wardDestruction: [] } })),
  ];

  it('usa stats.wards quando playbackData esta ausente', () => {
    const v = buildVisionData({ parsedDateTime: null, players: rawPlayers() }, makePlayers(), 2400);
    expect(v.source).toBe('PLAYER_STATS');
    expect(v.isReplayParsed).toBe(false);
    expect(v.wards).toHaveLength(1);
  });

  it('decodifica type Int: 0 = OBSERVER, 1 = SENTRY', () => {
    const v = buildVisionData({ players: rawPlayers() }, makePlayers(), 2400);
    expect(v.wards[0].type).toBe('SENTRY');

    const v2 = buildVisionData(
      { players: [{ stats: { wards: [{ time: 10, type: 0, positionX: 120, positionY: 120 }] } }] },
      makePlayers(),
      2400,
    );
    expect(v2.wards[0].type).toBe('OBSERVER');
  });

  it('marca tempo de vida como estimado e o destruidor como DESCONHECIDO (nao falso)', () => {
    const v = buildVisionData({ players: rawPlayers() }, makePlayers(), 2400);
    expect(v.wards[0].expiryInferred).toBe(true);
    expect(v.wards[0].destroyedBySlot).toBeUndefined();
    expect(v.wards[0].wasDestroyed).toBe(false);
  });

  it('dewards desta fonte nao tem coordenada (nao podem virar pino no mapa)', () => {
    const v = buildVisionData({ players: rawPlayers() }, makePlayers(), 2400);
    expect(v.dewards).toHaveLength(1);
    expect(v.dewards[0].x).toBeUndefined();
    expect(v.dewards[0].gold).toBe(100);
  });

  it('atribui a ward ao jogador do mesmo indice do array cru', () => {
    const v = buildVisionData({ players: rawPlayers() }, makePlayers(), 2400);
    expect(v.wards[0].placedBySlot).toBe(0);
    expect(v.wards[0].team).toBe('RADIANT');
  });
});

describe('buildVisionData — caminho NONE', () => {
  it('sem nenhuma fonte, devolve NONE com arrays vazios — nunca ward inventada', () => {
    const v = buildVisionData({ parsedDateTime: null, players: [] }, makePlayers(), 2400);
    expect(v.source).toBe('NONE');
    expect(v.wards).toEqual([]);
    expect(v.dewards).toEqual([]);
  });

  it('trata rawMatch nulo sem explodir', () => {
    const v = buildVisionData(null, makePlayers(), 2400);
    expect(v.source).toBe('NONE');
  });

  it('playbackData com array vazio cai para o fallback, nao para PLAYBACK', () => {
    const v = buildVisionData({ playbackData: { wardEvents: [] }, players: [] }, makePlayers(), 2400);
    expect(v.source).toBe('NONE');
  });
});

describe('deathEvents', () => {
  it('extrai mortes com coordenada e flags', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 1,
        players: [
          {
            stats: {
              deathEvents: [
                { time: 611, positionX: 108, positionY: 118, timeDead: 24, isBurst: false, isEngagedOnDeath: true },
                { time: 734, positionX: 132, positionY: 120, isWardWalkThrough: true, goldLost: 61 },
                { time: 800, positionX: 0, positionY: 0 },
              ],
            },
          },
        ],
      },
      makePlayers(),
      2400,
    );
    expect(v.deaths).toHaveLength(2); // a terceira tem coordenada invalida
    expect(v.deaths[0]).toMatchObject({ time: 611, x: 108, y: 118, team: 'RADIANT', slot: 0 });
    expect(v.deaths[1].isWardWalkThrough).toBe(true);
  });
});

describe('agregados de visao', () => {
  const vision = buildVisionData(
    {
      parsedDateTime: 1,
      playbackData: {
        wardEvents: [
          // observer do slot 0, viva de 0 a 360
          ev({ indexId: 1, time: 0, fromPlayer: 0 }),
          // observer do slot 0, destruida cedo (60s de 360)
          ev({ indexId: 2, time: 600, fromPlayer: 0 }),
          ev({ indexId: 2, time: 660, action: 'DESPAWN', fromPlayer: 0, playerDestroyed: 128 }),
          // sentry do slot 0
          ev({ indexId: 3, time: 100, fromPlayer: 0, wardType: 'SENTRY' }),
        ],
      },
      players: [],
    },
    makePlayers(),
    1200,
  );

  it('conta observers, sentries e wards perdidas cedo', () => {
    const s = computePlayerVisionStats(vision, 0);
    expect(s.hasData).toBe(true);
    expect(s.observersPlaced).toBe(2);
    expect(s.sentriesPlaced).toBe(1);
    expect(s.wardsPlaced).toBe(3);
    expect(s.wardsLostEarly).toBe(1);
  });

  it('creditа o deward a quem destruiu, nao a quem colocou', () => {
    expect(computePlayerVisionStats(vision, 128).dewards).toBe(1);
    expect(computePlayerVisionStats(vision, 0).dewards).toBe(0);
  });

  it('jogador sem ward mas com dado da partida devolve zeros, nao "sem dado"', () => {
    const s = computePlayerVisionStats(vision, 4);
    expect(s.hasData).toBe(true);
    expect(s.wardsPlaced).toBe(0);
  });

  it('uptime de observer é a UNIAO dos intervalos, nao a soma', () => {
    // Radiant: obs 0-360 e obs 600-660 => 420s cobertos de 1200 => 35%
    expect(observerUptimePct(vision, 'RADIANT', 1200)).toBe(35);
  });

  it('uptime nao dupla-conta intervalos sobrepostos', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 1,
        playbackData: {
          wardEvents: [
            ev({ indexId: 1, time: 0, fromPlayer: 0 }),
            ev({ indexId: 1, time: 300, action: 'DESPAWN', fromPlayer: 0 }),
            ev({ indexId: 2, time: 100, fromPlayer: 1 }),
            ev({ indexId: 2, time: 400, action: 'DESPAWN', fromPlayer: 1 }),
          ],
        },
        players: [],
      },
      makePlayers(),
      800,
    );
    // Uniao = 0..400 = 400s de 800 = 50% (a soma ingenua daria 600 => 75%)
    expect(observerUptimePct(v, 'RADIANT', 800)).toBe(50);
  });

  it('uptime é null quando nao ha dado de visao', () => {
    const none = buildVisionData(null, makePlayers(), 1200);
    expect(observerUptimePct(none, 'RADIANT', 1200)).toBeNull();
  });

  it('wardsBySlot agrupa e ignora wards nao atribuidas', () => {
    const v = buildVisionData(
      {
        parsedDateTime: 1,
        playbackData: {
          wardEvents: [ev({ indexId: 1, fromPlayer: 0 }), ev({ indexId: 2, fromPlayer: 999 })],
        },
        players: [],
      },
      makePlayers(),
      2400,
    );
    const map = wardsBySlot(v);
    expect(map.get(0)).toHaveLength(1);
    expect(map.size).toBe(1);
  });
});
