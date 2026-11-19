import { MatchDetails, MatchObjective } from '../../types/dota';

/**
 * CONVERSAO DE LUTA (§4 de docs/PROPOSTA-V2.md) — o que cada luta de time rendeu.
 *
 * Versao DESCRITIVA, de proposito: devolve contagens e somas cruas por luta e os objetivos que
 * vieram depois dela, e NAO rotula luta como "vencida" nem "convertida". Rotulo é limiar, e
 * limiar so entra com taxa de disparo medida nos pares (regra do projeto) — "ganhou a luta"
 * por mortes, por ouro ou pelos dois daria respostas diferentes, e escolher no olho é
 * exatamente o que a doutrina proibe.
 *
 * JANELA DO "DEPOIS": do inicio desta luta ao inicio da proxima (a ultima luta vai ate o fim
 * da partida). Nenhum numero magico de segundos: o que caiu entre uma luta e outra é o que a
 * luta abriu, e o `secondsAfterEnd` de cada objetivo deixa a tela dizer "torre 40 s depois"
 * sem esconder que pode ter sido 6 minutos depois. Objetivo DURANTE a luta conta (negativo).
 *
 * UNIDADES: ouro e xp sao a soma do `gold_delta`/`xp_delta` dos cinco jogadores do lado,
 * durante a luta (ouro ganho menos ouro perdido). Mortes sao a soma das mortes dos jogadores
 * do lado — nao o `deaths` da luta, que na fixture diverge da soma em 1 de 15 lutas.
 *
 * Sem `availability.teamfights` devolve `null`; a secao some.
 */

export interface FightSide {
  deaths: number;
  buybacks: number;
  goldDelta: number;
  xpDelta: number;
  damage: number;
  healing: number;
}

export interface FightObjectiveAfter {
  objective: MatchObjective;
  /** Segundos desde o FIM da luta. Negativo = caiu durante a luta. */
  secondsAfterEnd: number;
}

export interface FightSummary {
  /** Posicao da luta na partida, a partir de 1. */
  index: number;
  start: number;
  end: number;
  radiant: FightSide;
  dire: FightSide;
  /** Objetivos entre o inicio desta luta e o inicio da proxima (ou o fim da partida). */
  objectivesAfter: FightObjectiveAfter[];
  /** O que o jogador pedido fez nesta luta; `null` se nao foi pedido ou nao esta na luta. */
  player: { deaths: number; buybacks: number; goldDelta: number; xpDelta: number; damage: number; healing: number } | null;
}

const emptySide = (): FightSide => ({ deaths: 0, buybacks: 0, goldDelta: 0, xpDelta: 0, damage: 0, healing: 0 });

export function summarizeFights(match: MatchDetails, playerSlot?: number): FightSummary[] | null {
  if (!match.availability.teamfights || !match.teamfights) return null;
  const radiantSlots = new Set(match.players.filter((p) => p.isRadiant).map((p) => p.playerSlot));
  const fights = [...match.teamfights].sort((a, b) => a.start - b.start);
  const objectives = match.availability.objectives && match.objectives ? match.objectives : [];

  return fights.map((f, i) => {
    const radiant = emptySide();
    const dire = emptySide();
    let player: FightSummary['player'] = null;
    for (const fp of f.players) {
      const side = radiantSlots.has(fp.playerSlot) ? radiant : dire;
      side.deaths += fp.deaths;
      side.buybacks += fp.buybacks;
      side.goldDelta += fp.goldDelta;
      side.xpDelta += fp.xpDelta;
      side.damage += fp.damage;
      side.healing += fp.healing;
      if (playerSlot !== undefined && fp.playerSlot === playerSlot) {
        player = {
          deaths: fp.deaths,
          buybacks: fp.buybacks,
          goldDelta: fp.goldDelta,
          xpDelta: fp.xpDelta,
          damage: fp.damage,
          healing: fp.healing,
        };
      }
    }
    const windowEnd = i + 1 < fights.length ? fights[i + 1].start : Number.POSITIVE_INFINITY;
    const objectivesAfter = objectives
      .filter((o) => o.time >= f.start && o.time < windowEnd)
      .map((objective) => ({ objective, secondsAfterEnd: objective.time - f.end }));
    return { index: i + 1, start: f.start, end: f.end, radiant, dire, objectivesAfter, player };
  });
}
