import { MatchDetails, MatchObjective } from '../../types/dota';

/**
 * TEMPO MORTO NO PIOR MOMENTO (§4 de docs/PROPOSTA-V2.md) — o que o time do jogador perdeu
 * enquanto ele estava morto.
 *
 * JANELA: do instante da morte ate a volta, que é o primeiro de dois: o fim do tempo morto
 * (`timeDead` do evento) ou um buyback dentro dele. Sem o corte no buyback, a metrica acusaria
 * de ausente quem ja tinha voltado comprando. Morte sem `timeDead` (o parser nao viu o respawn:
 * na fixture, a de 2377 s numa partida de 2382 s) fica fora ate o fim e sai marcada com
 * `untilMatchEnd`; a janela fica ABERTA, porque o ultimo objetivo pode ter carimbo depois da
 * duracao (o ancient da fixture cai aos 2383 s). Descartar a morte esconderia justamente a
 * do ancient.
 *
 * "PERDIDO": objetivo cujo `takenBy` é o time ADVERSARIO — torre, barraca, ancient, Roshan ou
 * Tormentor. Torre negada pelo proprio time conta (é torre perdida; ver `MatchObjective`).
 *
 * Os eventos de morte sao os do dominio (`player.deathEvents`), que o mapper ja deduplicou —
 * o `deaths_log` cru tem uma linha por autor no mesmo instante — e ja limpou da morte com
 * Aegis, que o placar nao conta.
 *
 * Versao descritiva: devolve todas as mortes com o que se perdeu em cada uma, e `worst` é a de
 * mais objetivos perdidos (empate: a de mais tempo morto, depois a primeira). Nenhum limiar:
 * morte sem objetivo perdido aparece com lista vazia, e `worst` é `null` quando nenhuma morte
 * custou objetivo — a tela nao tem "pior momento" para mostrar.
 *
 * `null` sem eventos de morte com tempo morto ou sem objetivos (a secao some).
 */

export interface DeathCost {
  time: number;
  /** Segundos efetivamente fora: `timeDead`, ou ate o buyback se ele veio antes. */
  secondsOut: number;
  /** O jogador voltou por buyback dentro do tempo morto. */
  boughtBack: boolean;
  /** Sem `timeDead`: a janela foi ate o fim da partida. */
  untilMatchEnd: boolean;
  objectivesLost: MatchObjective[];
}

export interface PlayerDeathCosts {
  deaths: DeathCost[];
  /** Indice em `deaths` da morte que mais custou; `null` se nenhuma custou objetivo. */
  worst: number | null;
}

export function playerDeathCosts(match: MatchDetails, playerSlot: number): PlayerDeathCosts | null {
  const player = match.players.find((p) => p.playerSlot === playerSlot);
  if (!player || !match.availability.deathEvents || !match.availability.objectives || !match.objectives) return null;
  const events = player.deathEvents ?? [];
  if (events.length === 0) return null;

  const enemy = player.isRadiant ? 'DIRE' : 'RADIANT';
  const buybacks = player.buybackTimes ?? [];

  const deaths: DeathCost[] = events
    .slice()
    .sort((a, b) => a.time - b.time)
    .map((d) => {
      const known = typeof d.timeDead === 'number' && Number.isFinite(d.timeDead) && d.timeDead >= 0;
      const naturalEnd = known ? d.time + (d.timeDead as number) : Number.POSITIVE_INFINITY;
      const buyback = buybacks.find((t) => t >= d.time && t < naturalEnd);
      const back = buyback ?? naturalEnd;
      const objectivesLost = match.objectives!.filter((o) => o.takenBy === enemy && o.time >= d.time && o.time <= back);
      return {
        time: d.time,
        secondsOut: Number.isFinite(back) ? back - d.time : Math.max(0, match.durationSeconds - d.time),
        boughtBack: buyback !== undefined,
        untilMatchEnd: !known && buyback === undefined,
        objectivesLost,
      };
    });

  let worst: number | null = null;
  deaths.forEach((d, i) => {
    if (d.objectivesLost.length === 0) return;
    if (worst === null) return void (worst = i);
    const w = deaths[worst];
    if (d.objectivesLost.length > w.objectivesLost.length || (d.objectivesLost.length === w.objectivesLost.length && d.secondsOut > w.secondsOut)) {
      worst = i;
    }
  });
  return { deaths, worst };
}
