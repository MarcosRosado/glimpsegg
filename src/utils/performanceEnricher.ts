import { MatchPlayer, DamageSplit, DetailedCombatStats, DetailedFarmStats, AbilityUpgrade } from '../types/dota';
import { getHero } from '../constants/heroes';
import { getHeroAbilities } from '../constants/abilities';
import { sumAll, sumDeltas } from './insights/timeSeries';

// Standard benchmarks for core items (seconds)
const ITEM_BENCHMARKS: Record<number, number> = {
  145: 840,  // Battle Fury (14:00)
  147: 1200, // Manta Style (20:00)
  116: 1440, // Black King Bar (24:00)
  139: 1800, // Butterfly (30:00)
  208: 2100, // Abyssal Blade (35:00)
  1: 840,    // Blink Dagger (14:00)
  108: 1260, // Aghanim's Scepter (21:00)
  218: 960,  // Glimmer Cape (16:00)
  232: 900,  // Aether Lens (15:00)
  121: 1020, // Orchid (17:00)
  686: 1560, // Bloodthorn (26:00)
  640: 1920, // Kaya and Sange (32:00)
  152: 1200, // Shadow Blade (20:00)
  249: 1680, // Silver Edge (28:00)
  114: 1500, // Heart of Tarrasque (25:00)
  149: 1080, // Crystalys (18:00)
  141: 1620, // Daedalus (27:00)
  158: 1380, // Sange and Yasha (23:00)
  174: 1260, // Diffusal Blade (21:00)
  236: 1320, // Dragon Lance (22:00)
  263: 1680, // Hurricane Pike (28:00)
  166: 780,  // Maelstrom (13:00)
  247: 1560, // Mjollnir (26:00)
  137: 1260, // Radiance (21:00)
  156: 1500, // Satanic (25:00)
  180: 360,  // Arcane Boots (6:00)
  63: 270,   // Power Treads (4:30)
  50: 270,   // Phase Boots (4:30)
};

/**
 * Returns benchmark timing in seconds for a given item, or default estimation based on gold cost
 */
export function getItemBenchmarkSeconds(itemId: number, cost: number): number {
  if (ITEM_BENCHMARKS[itemId]) return ITEM_BENCHMARKS[itemId];
  if (cost >= 5000) return 1800; // ~30 min
  if (cost >= 4000) return 1440; // ~24 min
  if (cost >= 2500) return 1080; // ~18 min
  if (cost >= 1500) return 720;  // ~12 min
  if (cost >= 800) return 360;   // ~6 min
  return 180; // ~3 min
}

/**
 * Combate a partir do que a STRATZ realmente devolve.
 *
 * `heroDamageReport.receivedTotal` traz o split do dano RECEBIDO. Quando o relatorio
 * nao veio, a serie `heroDamageReceivedPerMinute` ainda da o total (sem split).
 * Nada aqui é estimado: o que nao tem fonte volta `null` e a UI mostra "sem dado".
 */
export function getEnrichedCombatStats(player: MatchPlayer): DetailedCombatStats {
  const received = player.damageReport?.receivedTotal ?? null;

  const damageReceivedSplit: DamageSplit | null = received
    ? {
        physicalDamage: received.physicalDamage,
        magicalDamage: received.magicalDamage,
        pureDamage: received.pureDamage,
      }
    : null;

  // Preferencia pelo relatorio; a serie por minuto é a segunda fonte real.
  const damageReceived = damageReceivedSplit
    ? damageReceivedSplit.physicalDamage + damageReceivedSplit.magicalDamage + damageReceivedSplit.pureDamage
    : sumAll(player.series?.heroDamageReceivedPerMinute);

  return {
    damageReceivedSplit,
    damageReceived,
    healingProvided: player.heroHealing,
  };
}

/**
 * Farm a partir das series reais por minuto.
 *
 * `lastHitsPerMinute` é DELTA, entao CS@N é a soma dos N primeiros minutos; um marco
 * que a serie nao alcanca volta `null` em vez de ser interpolado a partir do CS final.
 * `campStack` tambem é delta.
 */
export function getEnrichedFarmStats(player: MatchPlayer): DetailedFarmStats {
  const lh = player.series?.lastHitsPerMinute ?? null;

  return {
    cs5Min: sumDeltas(lh, 0, 5),
    cs10Min: sumDeltas(lh, 0, 10),
    cs15Min: sumDeltas(lh, 0, 15),
    cs20Min: sumDeltas(lh, 0, 20),
    campsStacked: sumAll(player.series?.campStack),
  };
}

/**
 * Ordem de skills REAL, de `player.abilities` (abilityId + time da STRATZ).
 *
 * Nao existe mais fallback. O antigo template fixo Q/W/E/R montava 25 niveis com
 * `timeSec = (lvl / maxLevel) * duracao * 0.9 + 50` — uma build que o jogador nunca
 * escolheu, com horarios que nunca aconteceram, indistinguivel da real na tela.
 * Sem `abilityBuild`, isto volta vazio e a UI diz que nao ha dado.
 */
export function getEnrichedAbilityUpgrades(player: MatchPlayer): AbilityUpgrade[] {
  if (!player.abilityBuild || player.abilityBuild.length === 0) return [];

  const hero = getHero(player.heroId);
  const known = getHeroAbilities(player.heroId, hero.shortName);

  // `AbilityInfo` nao guarda abilityId (e HERO_ABILITIES_MAP so cobre alguns herois),
  // entao casamos por ORDEM DE PRIMEIRA APARICAO: a primeira skill aprendida ocupa o
  // primeiro slot conhecido, e assim por diante. É aproximado no ROTULO, mas a ordem
  // e os TEMPOS sao reais.
  const slotByAbilityId = new Map<number, number>();
  let nextSlot = 0;
  for (const a of player.abilityBuild) {
    if (a.isTalent || a.abilityId <= 0) continue;
    if (!slotByAbilityId.has(a.abilityId)) {
      slotByAbilityId.set(a.abilityId, nextSlot);
      nextSlot += 1;
    }
  }

  return player.abilityBuild
    .filter((a) => a.abilityId > 0)
    .map((a, idx) => {
      const slotIdx = slotByAbilityId.get(a.abilityId);
      const meta = a.isTalent || slotIdx === undefined ? undefined : known[slotIdx];
      return {
        abilityId: a.abilityId,
        name: meta?.name || String(a.abilityId),
        displayName: meta?.displayName || (a.isTalent ? 'Talent' : `#${a.abilityId}`),
        slot: a.isTalent ? 'TALENT' : meta?.slot,
        imageUrl: meta?.imageUrl || '',
        level: idx + 1,
        timeSec: a.timeSec,
        isTalent: a.isTalent,
        isUltimate: meta?.isUltimate,
        type: a.isTalent ? 'TALENT' : 'SKILL',
      } as AbilityUpgrade;
    });
}
