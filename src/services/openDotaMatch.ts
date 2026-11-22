import {
  DamageReport,
  ItemTimingEvent,
  ItemUseCount,
  Lane,
  LaningStats,
  MapTeam,
  MatchDataAvailability,
  MatchDeathEvent,
  MatchDetails,
  MatchObjective,
  MatchObjectiveKind,
  MatchPlayer,
  MatchTeamfight,
  PlayerLaneAdvantage,
  PlayerLaneResult,
  PlayerTimeSeries,
  Role,
  VisionData,
  WardDeward,
  WardPlacement,
  WardType,
} from '../types/dota';
import { HEROES_MAP } from '../constants/heroes';
import { ITEMS_MAP, getItem } from '../constants/items';
import { WARD_DURATION_SEC } from '../constants/mapGeometry';
import { isStratzCell } from '../utils/minimapCoords';
import { cumulativeAt, sumDeltas } from '../utils/insights/timeSeries';
import { computeGlint, glintPercentilesFromMatch, glintRoleOf } from '../utils/glint';
import {
  laneIdFromOpenDota,
  laneOutcomesFrom,
  measureLanes,
  playerLaneAdvantage,
  resolvePlayerLaneResult,
} from '../utils/laneVerdict';
import { computePlayerVisionStats, emptyVisionData, wardsBySlot } from './visionMapper';

/**
 * Partida da OpenDota (`GET /api/matches/{id}`) -> `MatchDetails`, Fase 1 de
 * docs/PLANO-OPENDOTA.md. Desde 2026-11-19 é o UNICO mapper de partida do app (o
 * `mapStratzMatch` saiu na etapa 2 da D4).
 *
 * Pura e exportada: é o que o teste exercita contra as fixtures reais
 * (`__fixtures__/match-parsed-opendota.json` e `match-uneven-lane-opendota.json`).
 *
 * O QUE ESTE CAMINHO NAO TEM, E POR ISSO NAO PREENCHE
 * ---------------------------------------------------
 * Cada item abaixo desliga uma flag de `MatchDataAvailability` ou fica `null`. Nenhum é
 * aproximado aqui — os substitutos sao fases proprias do plano, com aceite medido.
 *
 *  - IMP: nao existe. `imp` fica 0 e `availability.imp` é false. A nota do app é o Glint
 *    experimental (`utils/glint.ts`), com nome proprio — nunca numero proprio com rotulo
 *    de IMP.
 *  - Veredito de rota: NAO vem da OpenDota. Sai da regra propria de `utils/laneVerdict.ts`
 *    (patrimonio aos 10 min de quem estava na rota; Fase 3, aceite medido em 2026-11-19).
 *    Rota desigual ou sem serie de 10 minutos fica `UNKNOWN`.
 *  - `heroAverage`: nao ha curva por minuto (Fase 2).
 *  - Divisao fisico/magico/puro e controle sofrido: `damageReport.receivedTotal` null.
 *    O relatorio sai PARCIAL — so `receivedTargets` (de `damage_taken`) e
 *    `receivedSourceItem` (de `damage_inflictor_received`). Habilidade nao entra: a
 *    OpenDota da o NOME do inflictor e o app nao tem tabela nome -> abilityId.
 *  - Ordem de skills: `ability_upgrades_arr` traz os ids sem o tempo, e a tela mostra o
 *    tempo. `abilityBuild` fica null em vez de sair com 0:00 em toda linha.
 *  - Posicao da morte: `deaths_log` nao tem coordenada. Os eventos vao para
 *    `player.deathEvents` (tempo, autor, ouro, tempo morto) e `vision.deaths` fica vazio.
 *  - `isBurst`, `isDieBack`, `isAttemptTpOut`, `hasHealAvailable`: ficam `undefined`.
 *  - `invisibleSeconds`, `behavior`, `intentionalFeeding`, `award`, `bracket`,
 *    `actualRank`, `analysisOutcome`, `parsedDateTime`: null/ausentes.
 *
 * SERIES POR MINUTO
 * -----------------
 * Os arrays `*_t` da OpenDota sao TODOS cumulativos (indice i = valor no minuto i). O
 * modelo do app (`PlayerTimeSeries`) quer DELTA em tudo menos patrimonio, entao a
 * conversao acontece aqui, uma vez: delta[i] = t[i+1] - t[i], que cobre o minuto
 * i -> i+1 como na STRATZ. Consequencia: a soma dos deltas é o valor no ULTIMO minuto
 * cheio, que pode ficar abaixo do total da partida (os segundos finais nao tem amostra).
 */

/** Fim da fase de rotas, em segundos: os 10 primeiros minutos. */
const LANE_PHASE_SECONDS = 600;

/** Mesmo criterio de "item de nucleo" do caminho STRATZ (`mapItemTimings`). */
const CORE_ITEM_MIN_COST = 1800;

let heroIdByName: Map<string, number> | null = null;
function heroIdFromName(name: unknown): number | undefined {
  if (typeof name !== 'string') return undefined;
  if (!heroIdByName) {
    heroIdByName = new Map(Object.values(HEROES_MAP).map((h) => [h.name, h.id]));
  }
  return heroIdByName.get(name);
}

let itemIdByKey: Map<string, number> | null = null;
/** `purchase_log[].key` é o nome sem o prefixo `item_` (`blink`, `recipe_sange`). */
function itemIdFromKey(key: unknown): number | undefined {
  if (typeof key !== 'string') return undefined;
  if (!itemIdByKey) {
    itemIdByKey = new Map(
      Object.values(ITEMS_MAP)
        .filter((i) => i.id > 0)
        .map((i) => [i.name.replace(/^item_/, ''), i.id]),
    );
  }
  return itemIdByKey.get(key);
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** Cumulativo por minuto, como veio. `null` se a serie nao veio. */
function cumulative(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map(num);
}

/** Cumulativo -> delta por minuto. Precisa de ao menos dois pontos. */
function deltas(raw: unknown): number[] | null {
  const c = cumulative(raw);
  if (!c || c.length < 2) return null;
  const out: number[] = [];
  for (let i = 0; i + 1 < c.length; i += 1) out.push(c[i + 1] - c[i]);
  return out;
}

function mapTimeSeries(p: any): PlayerTimeSeries | null {
  const series: PlayerTimeSeries = {
    lastHitsPerMinute: deltas(p?.lh_t),
    deniesPerMinute: deltas(p?.dn_t),
    networthPerMinute: cumulative(p?.networth_t),
    experiencePerMinute: deltas(p?.xp_t),
    goldPerMinute: deltas(p?.gold_t),
    heroDamagePerMinute: deltas(p?.hero_damage_t),
    towerDamagePerMinute: deltas(p?.tower_damage_t),
    healPerMinute: deltas(p?.hero_healing_t),
    // Sem par na OpenDota: nao ha serie de dano recebido nem de nivel.
    heroDamageReceivedPerMinute: null,
    campStack: deltas(p?.camps_stacked_t),
    level: null,
  };
  return Object.values(series).some((v) => v !== null) ? series : null;
}

/**
 * `position_est` é a estimativa de posicao da propria OpenDota. Medida contra a
 * `position` da STRATZ: igual em 165/170 (97%), core x suporte em 99% (§1 do plano).
 * So existe em partida parseada; sem ela a posicao é 'UNKNOWN', nao um palpite por rota.
 */
function mapPosition(raw: unknown): Role {
  return raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5
    ? (`POSITION_${raw}` as Role)
    : 'UNKNOWN';
}

/** `lane_role`: 1 safe, 2 mid, 3 off, 4 selva. `is_roaming` vence. */
function mapLane(p: any): Lane {
  if (p?.is_roaming === true) return 'ROAMING';
  switch (p?.lane_role) {
    case 1:
      return 'SAFE';
    case 2:
      return 'MID';
    case 3:
      return 'OFF';
    case 4:
      return 'JUNGLE';
    default:
      return 'UNKNOWN';
  }
}

function mapItemTimings(p: any): ItemTimingEvent[] | undefined {
  const log = p?.purchase_log;
  if (!Array.isArray(log) || log.length === 0) return undefined;
  const out: ItemTimingEvent[] = [];
  for (const e of log) {
    // Nome fora do catalogo é pulado: `getItem` devolveria fallback, mas aqui nao ha id
    // para pedir. Item de patch novo aparece depois do `sync-items-full.cjs`.
    const itemId = itemIdFromKey(e?.key);
    if (itemId === undefined) continue;
    out.push({
      itemId,
      time: num(e?.time),
      isCoreItem: getItem(itemId).cost >= CORE_ITEM_MIN_COST,
    });
  }
  return out.length > 0 ? out.sort((a, b) => a.time - b.time) : undefined;
}

/** `item_uses` -> usos por item, maior primeiro. Nome fora do catalogo é pulado, como nas compras. */
function mapItemUses(p: any): ItemUseCount[] | null {
  const raw = p?.item_uses;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: ItemUseCount[] = [];
  for (const [key, uses] of Object.entries(raw)) {
    const itemId = itemIdFromKey(key);
    if (itemId === undefined || typeof uses !== 'number' || !Number.isFinite(uses) || uses <= 0) continue;
    out.push({ itemId, uses });
  }
  return out.sort((a, b) => b.uses - a.uses || a.itemId - b.itemId);
}

function mapBuybackTimes(p: any): number[] | null {
  const log = p?.buyback_log;
  if (!Array.isArray(log)) return null;
  return log.map((e: any) => e?.time).filter((t: unknown): t is number => typeof t === 'number').sort((a, b) => a - b);
}

/**
 * `teamfights` -> lutas com os jogadores por `playerSlot`. O array `players` de cada luta é
 * por INDICE do `players` da partida (conferido: mortes por luta batem com o `deaths_log` em
 * 150 de 150 linhas da fixture). Luta com outro numero de jogadores nao é alinhavel e sai.
 */
function mapTeamfights(m: any, rawPlayers: any[]): MatchTeamfight[] | null {
  const raw = m?.teamfights;
  if (!Array.isArray(raw)) return null;
  const out: MatchTeamfight[] = [];
  for (const f of raw) {
    if (!Array.isArray(f?.players) || f.players.length !== rawPlayers.length) continue;
    if (typeof f.start !== 'number' || typeof f.end !== 'number') continue;
    out.push({
      start: f.start,
      end: f.end,
      lastDeath: num(f.last_death),
      deaths: num(f.deaths),
      players: f.players.map((fp: any, i: number) => ({
        playerSlot: num(rawPlayers[i]?.player_slot),
        deaths: num(fp?.deaths),
        buybacks: num(fp?.buybacks),
        damage: num(fp?.damage),
        healing: num(fp?.healing),
        goldDelta: num(fp?.gold_delta),
        xpDelta: num(fp?.xp_delta),
      })),
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

const BUILDING_KEY = /^npc_dota_(goodguys|badguys)_(.+)$/;

function buildingKind(rest: string): MatchObjectiveKind {
  if (/^tower/.test(rest)) return 'TOWER';
  if (/_rax_/.test(rest) || /^(melee|range)_rax/.test(rest)) return 'BARRACKS';
  if (rest === 'fort') return 'ANCIENT';
  return 'OTHER_BUILDING';
}

const TEAM_BY_OPENDOTA: Record<number, 'RADIANT' | 'DIRE'> = { 2: 'RADIANT', 3: 'DIRE' };

/**
 * `objectives` -> construcoes, Roshan e Tormentor, com o lado que ganhou. Ver o tipo
 * `MatchObjective`: construcao pelo DONO lido do nome (o golpe final pode ser de quem nega);
 * Roshan e Tormentor pelo `team`. Primeiro sangue, courier e Aegis nao sao objetivo de mapa
 * aqui e ficam de fora sem contar como "sem lado".
 */
function mapObjectives(m: any, rawPlayers: any[]): { objectives: MatchObjective[] | null; unresolved: number } {
  const raw = m?.objectives;
  if (!Array.isArray(raw)) return { objectives: null, unresolved: 0 };
  // Mesmo criterio do `isRadiantOf` do mapper: `isRadiant` quando vem, senao slot < 128.
  const radiantSlots = new Set(
    rawPlayers
      .filter((p) => (typeof p?.isRadiant === 'boolean' ? p.isRadiant : num(p?.player_slot) < 128))
      .map((p) => num(p?.player_slot)),
  );
  const out: MatchObjective[] = [];
  let unresolved = 0;
  for (const o of raw) {
    const time = o?.time;
    if (typeof time !== 'number') continue;
    if (o?.type === 'building_kill') {
      const match = typeof o.key === 'string' ? BUILDING_KEY.exec(o.key) : null;
      if (!match) {
        unresolved += 1;
        continue;
      }
      const ownerRadiant = match[1] === 'goodguys';
      const killerSlot = typeof o.player_slot === 'number' ? o.player_slot : null;
      out.push({
        time,
        kind: buildingKind(match[2]),
        takenBy: ownerRadiant ? 'DIRE' : 'RADIANT',
        key: o.key,
        denied: killerSlot !== null && radiantSlots.has(killerSlot) === ownerRadiant,
      });
      continue;
    }
    const kind: MatchObjectiveKind | null =
      o?.type === 'CHAT_MESSAGE_ROSHAN_KILL' ? 'ROSHAN' : o?.type === 'CHAT_MESSAGE_MINIBOSS_KILL' ? 'TORMENTOR' : null;
    if (!kind) continue;
    const takenBy = TEAM_BY_OPENDOTA[o?.team];
    if (!takenBy) {
      unresolved += 1;
      continue;
    }
    out.push({ time, kind, takenBy });
  }
  return { objectives: out.sort((a, b) => a.time - b.time), unresolved };
}

/**
 * Relatorio PARCIAL de dano recebido: de quem veio e de quais itens. `receivedTotal`
 * fica null — é ele que carrega a divisao por tipo e o controle sofrido, e é por ele
 * que `availability.damageReport` se guia.
 */
function mapDamageReport(p: any, enemyHeroIds: Set<number>): DamageReport | null {
  const receivedTargets: DamageReport['receivedTargets'] = [];
  const taken = p?.damage_taken;
  if (taken && typeof taken === 'object') {
    for (const [unit, amount] of Object.entries(taken)) {
      const heroId = heroIdFromName(unit);
      // So heroi INIMIGO. A chave do proprio heroi aparece (ilusao, clone, dano em si
      // mesmo) e a de aliado tambem; nenhuma das duas é "dano recebido do adversario".
      if (heroId === undefined || !enemyHeroIds.has(heroId)) continue;
      receivedTargets.push({ heroId, amount: num(amount) });
    }
  }
  const receivedSourceItem: DamageReport['receivedSourceItem'] = [];
  const inflictors = p?.damage_inflictor_received;
  if (inflictors && typeof inflictors === 'object') {
    for (const [key, amount] of Object.entries(inflictors)) {
      const itemId = itemIdFromKey(key);
      if (itemId === undefined) continue;
      // A OpenDota nao conta acertos por inflictor recebido; `count` 0 = sem dado.
      receivedSourceItem.push({ itemId, count: 0, amount: num(amount) });
    }
  }
  if (receivedTargets.length === 0 && receivedSourceItem.length === 0) return null;
  return { receivedTotal: null, receivedTargets, receivedSourceAbility: [], receivedSourceItem };
}

/**
 * `deaths_log` -> eventos de morte, UM por morte.
 *
 * Heroi com mais de um corpo (Meepo) registra uma linha por corpo no mesmo segundo, e
 * as linhas dos clones trazem o PROPRIO heroi como `key`: na fixture o Meepo tem 7
 * mortes e 27 linhas. Agrupa por `time`; o autor é a chave que nao é o proprio heroi.
 *
 * Morte com Aegis NAO é morte. O placar (`deaths`) nao a conta, e a STRATZ tambem nao: o
 * heroi volta em `AEGIS_REINCARNATION_SECONDS`. Mas o `deaths_log` do Meepo registra essas
 * linhas — caso real do aceite da Fase 1 (2026-11-19): Meepo com 4 mortes nas duas APIs,
 * Aegis pega aos 1.743 s, e um quinto grupo aos 1.818 s com `time_dead: 5`. Foi o unico
 * caso em 104 pegadas de Aegis de 130 partidas; os outros herois nao registram a linha.
 * A regra so age quando ha MAIS grupos do que mortes no placar, e so tira grupo com o tempo
 * exato da Aegis — o menor tempo de renascimento de uma morte real é maior que isso. Se
 * ainda sobrar diferenca, os eventos ficam como vieram: nao se descarta morte por palpite.
 */
const AEGIS_REINCARNATION_SECONDS = 5;

function mapDeaths(
  p: any,
  slot: number,
  heroId: number,
  team: MapTeam,
  slotByHeroId: Map<number, number>,
): MatchDeathEvent[] | null {
  const log = p?.deaths_log;
  if (!Array.isArray(log) || log.length === 0) return null;
  const byTime = new Map<number, MatchDeathEvent>();
  for (const e of log) {
    if (typeof e?.time !== 'number') continue;
    let ev = byTime.get(e.time);
    if (!ev) {
      ev = { time: e.time, team, slot, heroId, attackerSlot: null };
      byTime.set(e.time, ev);
    }
    const killerHeroId = heroIdFromName(e.key);
    if (killerHeroId !== undefined && killerHeroId !== heroId) {
      const killerSlot = slotByHeroId.get(killerHeroId);
      if (killerSlot !== undefined) ev.attackerSlot = killerSlot;
    }
    if (typeof e.time_dead === 'number') ev.timeDead = Math.max(ev.timeDead ?? 0, e.time_dead);
    if (typeof e.gold_lost === 'number') ev.goldLost = Math.max(ev.goldLost ?? 0, e.gold_lost);
    if (typeof e.gold_fed === 'number') ev.goldFed = Math.max(ev.goldFed ?? 0, e.gold_fed);
  }
  let events = [...byTime.values()].sort((a, b) => a.time - b.time);
  const scoreboardDeaths = typeof p?.deaths === 'number' ? p.deaths : null;
  if (scoreboardDeaths !== null && events.length > scoreboardDeaths) {
    let excess = events.length - scoreboardDeaths;
    events = events.filter((ev) => {
      if (excess > 0 && ev.timeDead === AEGIS_REINCARNATION_SECONDS) {
        excess -= 1;
        return false;
      }
      return true;
    });
  }
  return events.length > 0 ? events : null;
}

/**
 * Wards de `obs_log`/`sen_log`, pareadas com `*_left_log` por `ehandle`.
 *
 * Espaco de coordenadas: o MESMO espaco de celulas da STRATZ (64..192), com decimal —
 * a OpenDota da `118.2, 175.3` onde a STRATZ da `118, 174` (§1 do plano). Por isso a
 * validacao é `isStratzCell` e nada é convertido.
 *
 * `attackername` no `*_left_log` (lido da fixture, 97 wards com saida registrada):
 *  - o heroi de QUEM COLOCOU  => expirou sozinha (todas as 60 com vida cheia sao assim);
 *  - um heroi INIMIGO         => deward, com autor;
 *  - qualquer outra coisa (creep, aliado) => saiu antes da hora, autor desconhecido:
 *    `destroyedBySlot` fica `undefined`, que é o "nao sei" do tipo.
 * Ward sem linha de saida estava viva no fim da partida: fim estimado, e rotulado.
 */
function buildVision(
  rawPlayers: any[],
  players: MatchPlayer[],
  durationSeconds: number,
  isParsed: boolean,
): VisionData {
  const wards: WardPlacement[] = [];
  const dewards: WardDeward[] = [];
  let dropped = 0;
  const playerByHeroId = new Map(players.map((pl) => [pl.heroId, pl]));

  rawPlayers.forEach((raw, idx) => {
    const owner = players[idx];
    if (!owner) return;
    const team: MapTeam = owner.isRadiant ? 'RADIANT' : 'DIRE';
    const kinds: Array<[WardType, unknown, unknown]> = [
      ['OBSERVER', raw?.obs_log, raw?.obs_left_log],
      ['SENTRY', raw?.sen_log, raw?.sen_left_log],
    ];
    for (const [type, placedRaw, leftRaw] of kinds) {
      if (!Array.isArray(placedRaw)) continue;
      const leftByHandle = new Map<number, any>();
      if (Array.isArray(leftRaw)) {
        for (const l of leftRaw) if (typeof l?.ehandle === 'number') leftByHandle.set(l.ehandle, l);
      }
      placedRaw.forEach((w: any, i: number) => {
        const x = w?.x;
        const y = w?.y;
        if (typeof w?.time !== 'number' || !isStratzCell(x, y)) {
          dropped += 1;
          return;
        }
        const spawnTime: number = w.time;
        const left = typeof w.ehandle === 'number' ? leftByHandle.get(w.ehandle) : undefined;
        const hasExit = !!left && typeof left.time === 'number';
        const expireRaw = hasExit
          ? left.time
          : Math.min(spawnTime + WARD_DURATION_SEC[type], durationSeconds);
        const expireTime = Math.max(spawnTime, expireRaw);

        let destroyedBySlot: number | null | undefined = null;
        let killer: MatchPlayer | undefined;
        if (hasExit) {
          const attackerHeroId = heroIdFromName(left.attackername);
          const attacker = attackerHeroId !== undefined ? playerByHeroId.get(attackerHeroId) : undefined;
          if (attacker && attacker.isRadiant !== owner.isRadiant) {
            killer = attacker;
            destroyedBySlot = attacker.playerSlot;
          } else if (attackerHeroId !== owner.heroId) {
            destroyedBySlot = undefined;
          }
        }
        const wasDestroyed = !!killer;

        wards.push({
          key: `${owner.playerSlot}-${type}-${typeof w.ehandle === 'number' ? w.ehandle : i}-${spawnTime}`,
          type,
          x,
          y,
          team,
          placedBySlot: owner.playerSlot,
          placedByHeroId: owner.heroId,
          spawnTime,
          expireTime,
          lifetimeSeconds: expireTime - spawnTime,
          expiryInferred: !hasExit,
          wasDestroyed,
          destroyedBySlot,
          destroyedByHeroId: killer?.heroId,
          // Tempo de vida, autor e deward reais: é o mesmo nivel de dado do playback.
          source: 'PLAYBACK',
        });
        if (killer) {
          dewards.push({
            time: expireTime,
            bySlot: killer.playerSlot,
            byHeroId: killer.heroId,
            team: killer.isRadiant ? 'RADIANT' : 'DIRE',
            x,
            y,
            targetType: type,
          });
        }
      });
    }
  });

  if (wards.length === 0) return { ...emptyVisionData(isParsed), droppedEvents: dropped };
  return {
    source: 'PLAYBACK',
    isReplayParsed: isParsed,
    wards,
    dewards,
    // Sem coordenada na OpenDota — ver o cabecalho. Os eventos vivem em `player.deathEvents`.
    deaths: [],
    unattributedWards: 0,
    droppedEvents: dropped,
  };
}

function buildLaningStats(
  p: any,
  series: PlayerTimeSeries | null,
  itemTimings: ItemTimingEvent[] | undefined,
  deaths: MatchDeathEvent[] | null,
  lane: { result: PlayerLaneResult; advantage: PlayerLaneAdvantage | null },
): LaningStats | undefined {
  if (!series) return undefined;
  const lastHits10 = sumDeltas(series.lastHitsPerMinute, 0, 10);
  const denies10 = sumDeltas(series.deniesPerMinute, 0, 10);
  if (lastHits10 === null && denies10 === null) return undefined;
  const firstCore = itemTimings?.find((t) => t.isCoreItem);
  const killsLog = Array.isArray(p?.kills_log) ? p.kills_log : null;
  return {
    lastHits10: lastHits10 ?? 0,
    denies10: denies10 ?? 0,
    gold10: cumulativeAt(series.networthPerMinute, 10) ?? 0,
    exp10: sumDeltas(series.experiencePerMinute, 0, 10) ?? 0,
    // Regra propria (utils/laneVerdict.ts): so patrimonio aos 10 min de quem estava na rota.
    laneResult: lane.result,
    laneAdvantage: lane.advantage,
    firstCoreItemTimingSec: firstCore ? firstCore.time : null,
    firstCoreItemId: firstCore ? firstCore.itemId : null,
    // "Ate o minuto 10", como no caminho STRATZ. `null` = o log nao veio.
    kills10: killsLog
      ? killsLog.filter((k: any) => typeof k?.time === 'number' && k.time <= LANE_PHASE_SECONDS).length
      : null,
    deaths10: deaths ? deaths.filter((d) => d.time <= LANE_PHASE_SECONDS).length : null,
  };
}

/**
 * A OpenDota devolve um ESBOÇO de partida que acabou de terminar e ainda não foi ingerida:
 * 10 jogadores com `hero_id: 0`, `duration: 0`, placar 0 a 0 e um `radiant_win` qualquer
 * (visto em 2026-11-20 na 9097641988, dois minutos depois do fim). Mapeado, virava uma tela
 * com "Dire venceu", "Player 0" e "Hero #0", com cara de medição. Sem duração ou sem herói
 * nenhum não há partida: quem busca devolve `null` e a tela avisa.
 */
export function isOpenDotaMatchUsable(m: any): boolean {
  if (!m || !Array.isArray(m.players) || m.players.length === 0) return false;
  if (!(num(m.duration) > 0)) return false;
  return m.players.some((p: any) => num(p?.hero_id) > 0);
}

/** Partida parseada na OpenDota tem `version` (a versao do parser); sem parse ele é null. */
export function isOpenDotaMatchParsed(m: any): boolean {
  return m?.version !== null && m?.version !== undefined;
}

export function mapOpenDotaMatch(m: any): MatchDetails {
  const rawPlayers: any[] = Array.isArray(m?.players) ? m.players : [];
  const isParsed = isOpenDotaMatchParsed(m);
  const durationSeconds = num(m?.duration);

  const isRadiantOf = (p: any): boolean =>
    typeof p?.isRadiant === 'boolean' ? p.isRadiant : num(p?.player_slot) < 128;
  const slotByHeroId = new Map<number, number>();
  const heroIdsBySide = { radiant: new Set<number>(), dire: new Set<number>() };
  for (const p of rawPlayers) {
    const heroId = num(p?.hero_id);
    slotByHeroId.set(heroId, num(p?.player_slot));
    (isRadiantOf(p) ? heroIdsBySide.radiant : heroIdsBySide.dire).add(heroId);
  }

  // Veredito de rota: so `lane` geografico, lado, patrimonio e xp aos 10 min — nada da
  // partida inteira. Sem parse nao ha `networth_t`/`xp_t`, e as tres rotas ficam sem medida.
  const laneMeasures = measureLanes(
    rawPlayers.map((p) => ({
      lane: p?.lane,
      isRadiant: isRadiantOf(p),
      networth10: p?.networth_t?.[10],
      xp10: p?.xp_t?.[10],
    })),
  );
  const laneOutcomes = laneOutcomesFrom(laneMeasures);

  const players: MatchPlayer[] = rawPlayers.map((p: any) => {
    const isRadiant = isRadiantOf(p);
    const playerSlot = num(p.player_slot);
    const heroId = num(p.hero_id);
    const team: MapTeam = isRadiant ? 'RADIANT' : 'DIRE';
    const position = mapPosition(p.position_est);
    const series = mapTimeSeries(p);
    const itemTimings = mapItemTimings(p);
    const deathEvents = mapDeaths(p, playerSlot, heroId, team, slotByHeroId);
    const damageReport = mapDamageReport(p, isRadiant ? heroIdsBySide.dire : heroIdsBySide.radiant);

    return {
      // Conta anonima vem com `account_id` null: '0', como no caminho STRATZ.
      steamAccountId: p.account_id ? String(p.account_id) : '0',
      name: p.personaname || `Player ${playerSlot}`,
      avatar: '',
      // 0 = sem medalha conhecida (`getRankTierInfo` trata como nao calibrado).
      seasonRank: num(p.rank_tier),
      isRadiant,
      playerSlot,
      heroId,
      kills: num(p.kills),
      deaths: num(p.deaths),
      assists: num(p.assists),
      numLastHits: num(p.last_hits),
      numDenies: num(p.denies),
      goldPerMinute: num(p.gold_per_min),
      experiencePerMinute: num(p.xp_per_min),
      networth: num(p.net_worth),
      heroDamage: num(p.hero_damage),
      towerDamage: num(p.tower_damage),
      heroHealing: num(p.hero_healing),
      // Marcador, nao medicao: ver `availability.imp`.
      imp: 0,
      // Nota propria experimental, dos percentis que a OpenDota manda por jogador. Sem
      // posicao (partida nao parseada) usa os pesos sem papel; sem percentil, `null`.
      glint: computeGlint(glintPercentilesFromMatch(p.benchmarks), glintRoleOf(position), durationSeconds, undefined, heroId),
      role: position,
      lane: mapLane(p),
      items: [p.item_0, p.item_1, p.item_2, p.item_3, p.item_4, p.item_5].map(num),
      backpack: [p.backpack_0, p.backpack_1, p.backpack_2].map(num),
      neutralItem: num(p.item_neutral),
      position: position === 'UNKNOWN' ? undefined : position,
      variant: numOrNull(p.hero_variant),
      level: numOrNull(p.level),
      invisibleSeconds: null,
      behavior: null,
      intentionalFeeding: null,
      series,
      heroAverageCurve: null,
      abilityBuild: null,
      damageReport,
      deathEvents,
      itemUses: mapItemUses(p),
      buybackTimes: mapBuybackTimes(p),
      laneEfficiencyPct: typeof p.lane_efficiency === 'number' && Number.isFinite(p.lane_efficiency) ? p.lane_efficiency * 100 : null,
      laningStats: buildLaningStats(p, series, itemTimings, deathEvents, {
        result: resolvePlayerLaneResult(laneIdFromOpenDota(p.lane), isRadiant, laneOutcomes),
        advantage: playerLaneAdvantage(laneMeasures, p.lane, isRadiant),
      }),
      itemTimings,
    };
  });

  const vision = buildVision(rawPlayers, players, durationSeconds, isParsed);
  const bySlot = wardsBySlot(vision);
  for (const player of players) {
    // undefined = sem dado de visao; [] = tem dado e este jogador nao colocou ward.
    player.wardEvents = vision.source === 'NONE' ? undefined : bySlot.get(player.playerSlot) ?? [];
    player.visionStats = computePlayerVisionStats(vision, player.playerSlot);
  }

  const goldAdv: unknown[] = Array.isArray(m?.radiant_gold_adv) ? m.radiant_gold_adv : [];
  const xpAdv: unknown[] = Array.isArray(m?.radiant_xp_adv) ? m.radiant_xp_adv : [];
  const advantageTimeline = Array.from(
    { length: Math.max(goldAdv.length, xpAdv.length) },
    (_, i) => ({ minute: i, goldAdvantage: num(goldAdv[i]), experienceAdvantage: num(xpAdv[i]) }),
  );

  const sumKills = (radiant: boolean) =>
    players.filter((p) => p.isRadiant === radiant).reduce((s, p) => s + p.kills, 0);
  const sumNetworth = (radiant: boolean) =>
    players.filter((p) => p.isRadiant === radiant).reduce((s, p) => s + p.networth, 0);

  const teamfights = mapTeamfights(m, rawPlayers);
  const { objectives, unresolved: objectivesUnresolved } = mapObjectives(m, rawPlayers);

  const some = (fn: (p: MatchPlayer) => boolean) => players.some(fn);
  const availability: MatchDataAvailability = {
    parsed: isParsed,
    perMinuteStats: some((p) => !!p.series?.lastHitsPerMinute?.length),
    networthSeries: some((p) => !!p.series?.networthPerMinute?.length),
    deathEvents: some((p) => !!p.deathEvents?.length),
    // So com `receivedTotal`, que este caminho nao tem. O relatorio parcial existe em
    // `player.damageReport`, mas regra que pede a flag quer a divisao por tipo.
    damageReport: false,
    wards: vision.source !== 'NONE',
    advantageTimeline: advantageTimeline.length > 0,
    heroAverage: false,
    abilities: false,
    laneOutcomes: !!(laneOutcomes.top || laneOutcomes.mid || laneOutcomes.bottom),
    imp: false,
    glint: some((p) => typeof p.glint === 'number'),
    parsePending: !isParsed,
    teamfights: teamfights !== null,
    objectives: !!objectives?.length,
  };

  return {
    id: String(m?.match_id ?? ''),
    didRadiantWin: !!m?.radiant_win,
    durationSeconds,
    startDateTime: num(m?.start_time),
    gameModeId: numOrNull(m?.game_mode),
    lobbyTypeId: numOrNull(m?.lobby_type),
    radiantScore: typeof m?.radiant_score === 'number' ? m.radiant_score : sumKills(true),
    direScore: typeof m?.dire_score === 'number' ? m.dire_score : sumKills(false),
    radiantNetworth: sumNetworth(true),
    direNetworth: sumNetworth(false),
    players,
    advantageTimeline,
    parsedDateTime: null,
    bracket: null,
    actualRank: null,
    analysisOutcome: null,
    firstBloodTime: numOrNull(m?.first_blood_time),
    laneOutcomes,
    vision,
    teamfights,
    objectives,
    objectivesUnresolved,
    availability,
  };
}

/**
 * Resposta crua de `GET /api/matches/{id}`, pelos dois caminhos de rede. `null` em
 * qualquer falha — quem chama mostra o erro; nao existe dado de demonstracao.
 */
async function fetchOpenDotaMatchRaw(matchId: number): Promise<any | null> {
  if (window.api && typeof window.api.openDotaFetch === 'function') {
    const res = await window.api.openDotaFetch<any>(`matches/${matchId}`);
    return res.success && res.data ? res.data : null;
  }
  const res = await fetch(`https://api.opendota.com/api/matches/${matchId}`);
  return res.ok ? await res.json() : null;
}

/** Busca e mapeia a partida na OpenDota. Nao exige token nenhum. */
export async function fetchOpenDotaMatchDetails(matchId: string): Promise<MatchDetails | null> {
  const numericId = parseInt(matchId, 10);
  if (isNaN(numericId) || numericId <= 0) return null;
  try {
    const raw = await fetchOpenDotaMatchRaw(numericId);
    // Id inexistente volta 200 com `{ error }` em algumas rotas; sem jogadores nao ha partida,
    // e o esboço de partida recém-terminada também não é partida (`isOpenDotaMatchUsable`).
    if (!isOpenDotaMatchUsable(raw)) return null;
    return mapOpenDotaMatch(raw);
  } catch (err) {
    console.warn('OpenDota match fetch failed:', err);
    return null;
  }
}

export interface OpenDotaParseRequest {
  /** `false` = o pedido nao foi aceito (rede, limite de chamadas, id invalido). */
  success: boolean;
  /** Id do job na fila da OpenDota, quando ela devolve. */
  jobId?: number;
  error?: string;
}

/**
 * Pede o parse do replay (`POST /request/{match_id}`). O parse é assincrono e leva de
 * segundos a minutos: quem chama busca a partida de novo depois e olha
 * `availability.parsed` — esta funcao so diz se o pedido entrou na fila.
 *
 * Formato verificado com uma chamada real em 2026-11-19: 200 com `{"job":{"jobId":<numero>}}`.
 * A especificacao publica so declara `type: object` e avisa que cada pedido conta como 10
 * chamadas no limite. `GET /request/{jobId}` devolveu `null` segundos depois, para uma
 * partida que ja estava parseada: `null` ali nao distingue "terminou" de "nunca existiu",
 * entao a espera deve olhar a partida, nao o job.
 */
export async function requestOpenDotaParse(matchId: string): Promise<OpenDotaParseRequest> {
  const numericId = parseInt(matchId, 10);
  if (isNaN(numericId) || numericId <= 0) return { success: false, error: 'invalid match id' };
  try {
    if (window.api && typeof window.api.openDotaRequestParse === 'function') {
      return await window.api.openDotaRequestParse(numericId);
    }
    const res = await fetch(`https://api.opendota.com/api/request/${numericId}`, { method: 'POST' });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    const json = await res.json();
    const jobId = json?.job?.jobId;
    return { success: true, jobId: typeof jobId === 'number' ? jobId : undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
