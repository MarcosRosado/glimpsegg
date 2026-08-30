import { MatchDetails, MatchPlayer, Role } from '../types/dota';

/**
 * Destaques da partida.
 *
 * Duas regras de projeto, ambas vindas de erro anterior deste arquivo:
 *
 * 1. **O motor nao produz texto nem CSS.** Titulo, subtitulo e classe Tailwind eram
 *    literais aqui dentro — e em portugues, entao a versao en-US mostrava
 *    "Desempenho lendario com impacto decisivo" para quem escolheu ingles. O motor
 *    devolve `AwardId` + numero cru; a traducao e a cor moram na UI, como ja acontece
 *    com `RuleId`/`RULE_TEXT` no motor de coaching.
 *
 * 2. **Superlativo exige margem.** `sortedByImp[0]` coroava alguem em TODA partida,
 *    inclusive quando os dez jogaram igual — "o primeiro de uma lista" nao e um
 *    destaque. Agora cada premio exige que o lider bata o segundo colocado por uma
 *    margem propria daquela metrica, e que passe de um piso absoluto.
 */

export type AwardId =
  // Destaques de papel. `IMP` assinado, entao a margem e absoluta, nao percentual.
  | 'MVP'
  | 'TOP_CORE'
  | 'TOP_SUPPORT'
  | 'ROUGH_GAME'
  // Superlativos por metrica medida.
  | 'MOST_HERO_DAMAGE'
  | 'MOST_TOWER_DAMAGE'
  | 'MOST_HEALING'
  | 'MOST_ASSISTS'
  | 'MOST_KILLS'
  | 'MOST_NETWORTH'
  | 'MOST_DENIES'
  | 'MOST_WARDS';

/** Como a UI deve formatar `value`. */
export type AwardUnit = 'IMP' | 'GOLD' | 'DAMAGE' | 'COUNT';

export interface MatchAward {
  id: AwardId;
  playerSlot: number;
  heroId: number;
  playerName: string;
  isRadiant: boolean;
  /** Numero CRU que ganhou o premio. Quem renderiza decide o formato e o idioma. */
  value: number;
  unit: AwardUnit;
  /** Vantagem sobre o segundo colocado, em %. `null` nos premios de IMP. */
  marginPct: number | null;
  /**
   * Em que este jogador liderou. So nos premios de papel, e so quando foi isso que o
   * elegeu. Existe porque "MVP · 1 superlativo" nao informa nada: o leitor precisa saber
   * QUAL categoria ele liderou — "MVP · Carrasco" diz que ele fez mais abates.
   */
  basis?: AwardId[];
}

export interface PositionHighlight {
  position: Role;
  playerSlot: number;
  heroId: number;
  playerName: string;
  isRadiant: boolean;
  imp: number;
  /** Estatistica caracteristica da posicao. `null` quando a partida nao trouxe. */
  stat: { unit: AwardUnit; value: number; id: AwardId } | null;
}

export interface MatchAwards {
  /** Destaques de papel: MVP, melhor core, melhor suporte, dia dificil. */
  awards: MatchAward[];
  /** Superlativos por metrica, ja ordenados pela margem — o mais dominante primeiro. */
  superlatives: MatchAward[];
  /** Melhor de cada posicao, de POSITION_1 a POSITION_5. */
  positions: PositionHighlight[];
  aggregates: TeamAggregates;
}

/**
 * CALIBRACAO — 60 partidas reais de um perfil bracket 6 (Divine/Immortal), medidas na
 * STRATZ em 2026-08-30.
 *
 * A margem NAO pode ser uma constante unica: as metricas tem dispersao muito diferente.
 * A mediana da vantagem do 1o sobre o 2o e de 11% em assistencias e de 202% em cura —
 * um limiar unico ou premiaria cura em toda partida ou nunca premiaria assistencia.
 * Cada `margin` abaixo e a mediana daquela metrica, o que faz o premio aparecer em
 * ~45-50% das partidas. `floor` e o p10 do valor do 1o colocado, arredondado: sem ele,
 * "maior cura" premiaria 300 de cura contra 100.
 *
 * Refazer a medicao antes de mexer nestes numeros. Foi ajuste "no olho" que deixou o
 * limiar de farm da lista de partidas disparando em 59% dos jogos.
 */
interface SuperlativeSpec {
  id: AwardId;
  unit: AwardUnit;
  /** Vantagem minima sobre o 2o colocado, em %. */
  margin: number;
  /** Valor minimo do 1o colocado. */
  floor: number;
  value: (p: MatchPlayer) => number | null;
}

const SUPERLATIVES: SuperlativeSpec[] = [
  { id: 'MOST_HERO_DAMAGE',  unit: 'DAMAGE', margin: 20,  floor: 24000, value: (p) => p.heroDamage },
  { id: 'MOST_NETWORTH',     unit: 'GOLD',   margin: 13,  floor: 27000, value: (p) => p.networth },
  { id: 'MOST_TOWER_DAMAGE', unit: 'DAMAGE', margin: 80,  floor: 8000,  value: (p) => p.towerDamage },
  { id: 'MOST_HEALING',      unit: 'DAMAGE', margin: 200, floor: 1600,  value: (p) => p.heroHealing },
  { id: 'MOST_ASSISTS',      unit: 'COUNT',  margin: 12,  floor: 17,    value: (p) => p.assists },
  { id: 'MOST_KILLS',        unit: 'COUNT',  margin: 30,  floor: 10,    value: (p) => p.kills },
  { id: 'MOST_DENIES',       unit: 'COUNT',  margin: 50,  floor: 7,     value: (p) => p.numDenies },
  // `wardEvents` undefined = partida sem dado de visao. `[]` = colocou zero ward.
  // Confundir os dois foi o bug das quatro wards falsas; aqui `undefined` sai fora.
  { id: 'MOST_WARDS',        unit: 'COUNT',  margin: 50,  floor: 8,
    value: (p) => (p.wardEvents ? p.wardEvents.length : null) },
];

/**
 * MVP NAO pode ser so "o maior IMP".
 *
 * IMP mede desempenho contra a EXPECTATIVA daquele heroi/posicao/ranque, nao impacto na
 * partida. Medido nas 60 partidas de calibracao: o maior IMP esta no time **perdedor**
 * em 19% dos casos. Um exemplo real (8973449942): o Lifestealer fechou 21/5/13 com o
 * maior patrimonio, o maior dano e o maior dano em torres do jogo, no time que venceu —
 * e a STRATZ deu a ele IMP -10; o titulo de MVP ia para uma Crystal Maiden 2/6/20 do
 * time derrotado, com +24.
 *
 * Entao o MVP sai de FATO MEDIDO: e o jogador do time vencedor que leva mais
 * superlativos, com o IMP so como desempate. Sem nenhum superlativo no time vencedor
 * (5% das partidas), o criterio passa a ser o IMP.
 */
/** Dia dificil: 32% das partidas. So quando o ultimo destoa mesmo do penultimo. */
const ROUGH_GAME_MAX_IMP = -10;
const ROUGH_GAME_MIN_LEAD = 5;

const CORE_POSITIONS: Role[] = ['POSITION_1', 'POSITION_2', 'POSITION_3'];
const SUPPORT_POSITIONS: Role[] = ['POSITION_4', 'POSITION_5'];
export const POSITION_ORDER: Role[] = [
  'POSITION_1',
  'POSITION_2',
  'POSITION_3',
  'POSITION_4',
  'POSITION_5',
];

/**
 * Estatistica caracteristica de cada posicao. Fixa e documentada de proposito: escolher
 * "a metrica em que ele mais se destacou" faria a mesma posicao mostrar coisas
 * diferentes a cada partida, e o leitor nao teria como comparar.
 */
const POSITION_STAT: Record<Role, { id: AwardId; unit: AwardUnit; value: (p: MatchPlayer) => number | null }> = {
  POSITION_1: { id: 'MOST_NETWORTH',     unit: 'GOLD',   value: (p) => p.networth },
  POSITION_2: { id: 'MOST_HERO_DAMAGE',  unit: 'DAMAGE', value: (p) => p.heroDamage },
  POSITION_3: { id: 'MOST_HERO_DAMAGE',  unit: 'DAMAGE', value: (p) => p.heroDamage },
  POSITION_4: { id: 'MOST_ASSISTS',      unit: 'COUNT',  value: (p) => p.assists },
  POSITION_5: { id: 'MOST_WARDS',        unit: 'COUNT',  value: (p) => (p.wardEvents ? p.wardEvents.length : null) },
  UNKNOWN:    { id: 'MOST_NETWORTH',     unit: 'GOLD',   value: (p) => p.networth },
};

/** `position` cru da STRATZ quando veio; senao o `role` derivado. */
function positionOf(p: MatchPlayer): Role {
  return p.position || p.role || 'UNKNOWN';
}

function toAward(
  p: MatchPlayer,
  id: AwardId,
  unit: AwardUnit,
  value: number,
  marginPct: number | null,
  basis?: AwardId[],
): MatchAward {
  return {
    id,
    playerSlot: p.playerSlot,
    heroId: p.heroId,
    playerName: p.name,
    isRadiant: p.isRadiant,
    value,
    unit,
    marginPct,
    ...(basis && basis.length > 0 ? { basis } : {}),
  };
}

/**
 * O lider da metrica, mas so quando ele de fato lidera: passa do piso E bate o segundo
 * colocado pela margem daquela metrica. Empate no topo devolve `null` — nao ha
 * superlativo, e isso e um resultado valido.
 */
function pickSuperlative(players: MatchPlayer[], spec: SuperlativeSpec): MatchAward | null {
  const ranked = players
    .map((p) => ({ p, v: spec.value(p) }))
    .filter((x): x is { p: MatchPlayer; v: number } => x.v !== null && !isNaN(x.v))
    .sort((a, b) => b.v - a.v);

  if (ranked.length < 2) return null;
  const [first, second] = ranked;
  if (first.v < spec.floor) return null;

  // Segundo colocado zerado: o lider e sozinho na metrica. Trata como margem cheia em
  // vez de dividir por zero.
  const marginPct = second.v > 0 ? ((first.v - second.v) / second.v) * 100 : Infinity;
  if (marginPct < spec.margin) return null;

  return toAward(first.p, spec.id, spec.unit, first.v, marginPct === Infinity ? 100 : marginPct);
}

/**
 * Melhor por IMP dentro de um grupo.
 *
 * MVP, melhor core e melhor suporte sao slots FIXOS do card: toda partida tem cores e
 * suportes, e "o core de maior IMP desta partida" e um fato, com ou sem folga sobre o
 * segundo. Nao ha exigencia de margem aqui de proposito — o IMP aparece ao lado, entao
 * o leitor ve sozinho quando foi apertado. So devolve `null` quando o grupo esta vazio
 * (partida sem `position` nem `role` utilizavel naquela faixa).
 *
 * Os SUPERLATIVOS e o `ROUGH_GAME` seguem exigindo margem: aqueles sao afirmacoes sobre
 * destaque, e "o primeiro de uma lista empatada" nao e destaque.
 */
function pickByImp(group: MatchPlayer[], id: AwardId): MatchAward | null {
  const ranked = [...group].sort((a, b) => (b.imp || 0) - (a.imp || 0));
  if (ranked.length === 0) return null;
  return toAward(ranked[0], id, 'IMP', ranked[0].imp || 0, null);
}

/**
 * MVP: quem levou mais superlativos no time vencedor, IMP so como desempate.
 *
 * Vale so para o MVP. `TOP_CORE` e `TOP_SUPPORT` continuam saindo do IMP, e de
 * proposito: eles perguntam "quem jogou melhor NA FUNCAO", que e exatamente o que o IMP
 * mede. Contar superlativo ali daria "melhor suporte" a um Earth Spirit 3/10/26 com IMP
 * -17, so por liderar assistencias, na frente de uma Crystal Maiden com +24.
 */
function pickStandout(
  group: MatchPlayer[],
  superlatives: MatchAward[],
  id: AwardId,
): MatchAward | null {
  if (group.length === 0) return null;
  const count = (slot: number) => superlatives.filter((a) => a.playerSlot === slot).length;
  const ranked = [...group].sort(
    (a, b) => count(b.playerSlot) - count(a.playerSlot) || (b.imp || 0) - (a.imp || 0),
  );
  const top = ranked[0];

  const held = superlatives.filter((a) => a.playerSlot === top.playerSlot);
  if (held.length > 0) {
    return toAward(top, id, 'IMP', top.imp || 0, null, held.map((a) => a.id));
  }

  // Ninguem no time vencedor liderou categoria alguma: o criterio passa a ser o IMP, e
  // o cartao mostra o IMP. Slot fixo, entao sempre ha MVP.
  return pickByImp(group, id);
}

export interface TeamAggregates {
  radiantKills: number;
  direKills: number;
  radiantNetworth: number;
  direNetworth: number;
  radiantHeroDamage: number;
  direHeroDamage: number;
  radiantTowerDamage: number;
  direTowerDamage: number;
  radiantHealing: number;
  direHealing: number;
  radiantWards: number;
  direWards: number;
  radiantObservers: number;
  direObservers: number;
  radiantSentries: number;
  direSentries: number;
  /** false => a partida nao tem dado de visao. A UI deve mostrar "—", nao "0 vs 0". */
  wardsMeasured: boolean;
}

export function computeMatchAwards(match: MatchDetails): MatchAwards {
  const players = match.players || [];
  if (players.length === 0) {
    return {
      awards: [],
      superlatives: [],
      positions: [],
      aggregates: {
        radiantKills: match.radiantScore,
        direKills: match.direScore,
        radiantNetworth: match.radiantNetworth,
        direNetworth: match.direNetworth,
        radiantHeroDamage: 0,
        direHeroDamage: 0,
        radiantTowerDamage: 0,
        direTowerDamage: 0,
        radiantHealing: 0,
        direHealing: 0,
        radiantWards: 0,
        direWards: 0,
        radiantObservers: 0,
        direObservers: 0,
        radiantSentries: 0,
        direSentries: 0,
        wardsMeasured: false,
      },
    };
  }

  // Calculate Aggregates
  let radiantHeroDamage = 0;
  let direHeroDamage = 0;
  let radiantTowerDamage = 0;
  let direTowerDamage = 0;
  let radiantHealing = 0;
  let direHealing = 0;
  // Antes daqui saia um fallback inventado — `: 4` para Radiant e `: 3` para Dire.
  // Nao era so numero falso: era numero falso COM VIES DE LADO, entao toda partida
  // sem dado mostrava o Radiant sistematicamente a frente em visao.
  // Ausencia de dado agora é ausencia, sinalizada por `wardsMeasured`.
  let radiantWards = 0;
  let direWards = 0;
  let radiantObservers = 0;
  let direObservers = 0;
  let radiantSentries = 0;
  let direSentries = 0;

  players.forEach((p) => {
    if (p.isRadiant) {
      radiantHeroDamage += p.heroDamage || 0;
      radiantTowerDamage += p.towerDamage || 0;
      radiantHealing += p.heroHealing || 0;
      radiantObservers += p.wardEvents?.filter((w) => w.type === 'OBSERVER').length ?? 0;
      radiantSentries += p.wardEvents?.filter((w) => w.type === 'SENTRY').length ?? 0;
      radiantWards += p.wardEvents?.length ?? 0;
    } else {
      direHeroDamage += p.heroDamage || 0;
      direTowerDamage += p.towerDamage || 0;
      direHealing += p.heroHealing || 0;
      direObservers += p.wardEvents?.filter((w) => w.type === 'OBSERVER').length ?? 0;
      direSentries += p.wardEvents?.filter((w) => w.type === 'SENTRY').length ?? 0;
      direWards += p.wardEvents?.length ?? 0;
    }
  });

  const aggregates: TeamAggregates = {
    radiantKills: match.radiantScore || players.filter((p) => p.isRadiant).reduce((s, p) => s + p.kills, 0),
    direKills: match.direScore || players.filter((p) => !p.isRadiant).reduce((s, p) => s + p.kills, 0),
    radiantNetworth: match.radiantNetworth || players.filter((p) => p.isRadiant).reduce((s, p) => s + p.networth, 0),
    direNetworth: match.direNetworth || players.filter((p) => !p.isRadiant).reduce((s, p) => s + p.networth, 0),
    radiantHeroDamage,
    direHeroDamage,
    radiantTowerDamage,
    direTowerDamage,
    radiantHealing,
    direHealing,
    radiantWards,
    direWards,
    radiantObservers,
    direObservers,
    radiantSentries,
    direSentries,
    wardsMeasured: match.availability ? match.availability.wards : players.some((p) => !!p.wardEvents),
  };


  const sortedByImp = [...players].sort((a, b) => (b.imp || 0) - (a.imp || 0));

  // 1. Superlativos primeiro: os destaques de papel se apoiam neles.
  const superlatives = SUPERLATIVES.map((spec) => pickSuperlative(players, spec))
    .filter((a): a is MatchAward => a !== null)
    .sort((a, b) => (b.marginPct || 0) - (a.marginPct || 0));

  // 2. Destaques de papel.
  const awards: MatchAward[] = [];
  const winners = players.filter(
    (p) => (p.isRadiant && match.didRadiantWin) || (!p.isRadiant && !match.didRadiantWin),
  );
  const mvp = pickStandout(winners, superlatives, 'MVP');
  if (mvp) awards.push(mvp);

  const cores = players.filter(
    (p) => CORE_POSITIONS.includes(positionOf(p)) && p.playerSlot !== mvp?.playerSlot,
  );
  const topCore = pickByImp(cores, 'TOP_CORE');
  if (topCore) awards.push(topCore);

  const supports = players.filter(
    (p) => SUPPORT_POSITIONS.includes(positionOf(p)) && p.playerSlot !== mvp?.playerSlot,
  );
  const topSupport = pickByImp(supports, 'TOP_SUPPORT');
  if (topSupport) awards.push(topSupport);

  // "Dia dificil" substituiu o EXTREME LVP. So aparece quando o ultimo destoa do
  // penultimo — ser o ultimo de uma lista apertada nao e diagnostico.
  const worst = sortedByImp[sortedByImp.length - 1];
  const secondWorst = sortedByImp[sortedByImp.length - 2];
  const worstLevouSuperlativo =
    !!worst && superlatives.some((a) => a.playerSlot === worst.playerSlot);
  if (
    worst &&
    // Quem liderou uma metrica da partida nao teve um dia dificil, seja qual for o IMP.
    !worstLevouSuperlativo &&
    (worst.imp || 0) <= ROUGH_GAME_MAX_IMP &&
    (!secondWorst || (secondWorst.imp || 0) - (worst.imp || 0) >= ROUGH_GAME_MIN_LEAD)
  ) {
    awards.push(toAward(worst, 'ROUGH_GAME', 'IMP', worst.imp || 0, null));
  }

  // 3. Melhor de cada posicao. Posicao sem jogador (partida sem `position` nem `role`
  // utilizavel) simplesmente nao entra na lista.
  const positions: PositionHighlight[] = [];
  for (const position of POSITION_ORDER) {
    const inPosition = players.filter((p) => positionOf(p) === position);
    if (inPosition.length === 0) continue;
    const best = [...inPosition].sort((a, b) => (b.imp || 0) - (a.imp || 0))[0];
    const spec = POSITION_STAT[position];
    const value = spec.value(best);
    positions.push({
      position,
      playerSlot: best.playerSlot,
      heroId: best.heroId,
      playerName: best.name,
      isRadiant: best.isRadiant,
      imp: best.imp || 0,
      stat: value === null ? null : { unit: spec.unit, value, id: spec.id },
    });
  }

  return { awards, superlatives, positions, aggregates };
}
