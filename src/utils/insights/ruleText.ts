import { TranslationKey } from '../../i18n/translations';
import { InsightCategory, BenchmarkSource } from '../../types/dota';
import { RuleId } from './types';

export interface RuleTextKeys {
  title: TranslationKey;
  body: TranslationKey;
  stat?: TranslationKey;
  bench?: TranslationKey;
}

/**
 * Regra -> chaves i18n.
 *
 * ESTA É A GARANTIA ESTRUTURAL DO MOTOR. `RuleId` é uma uniao FECHADA e os valores sao
 * tipados como `TranslationKey`, entao `tsc -b` falha se:
 *   - uma regra nova nascer sem texto (Record incompleto),
 *   - uma chave for digitada errado,
 *   - `translations.ts` perder uma chave que uma regra usa.
 * Com `strict: false` no projeto, é praticamente a unica rede de tipos disponivel —
 * e é de graca.
 */
export const RULE_TEXT: Record<RuleId, RuleTextKeys> = {
  laningCsHigh: { title: 'coachLaningCsHighTitle', body: 'coachLaningCsHighBody', stat: 'coachLaningCsHighStat' },
  laningCsLow: { title: 'coachLaningCsLowTitle', body: 'coachLaningCsLowBody', stat: 'coachLaningCsLowStat' },
  laningDeniesHigh: { title: 'coachLaningDeniesHighTitle', body: 'coachLaningDeniesHighBody', stat: 'coachLaningDeniesHighStat' },
  laningLaneStomped: { title: 'coachLaningLaneStompedTitle', body: 'coachLaningLaneStompedBody', stat: 'coachLaningLaneStompedStat' },
  laningLaneLost: { title: 'coachLaningLaneLostTitle', body: 'coachLaningLaneLostBody', stat: 'coachLaningLaneLostStat' },

  farmingNetworthHigh: { title: 'coachFarmingNetworthHighTitle', body: 'coachFarmingNetworthHighBody', stat: 'coachFarmingNetworthHighStat' },
  farmingNetworthLow: { title: 'coachFarmingNetworthLowTitle', body: 'coachFarmingNetworthLowBody', stat: 'coachFarmingNetworthLowStat' },
  farmingStacksHigh: { title: 'coachFarmingStacksHighTitle', body: 'coachFarmingStacksHighBody', stat: 'coachFarmingStacksHighStat' },
  farmingCurveBehind: { title: 'coachFarmingCurveBehindTitle', body: 'coachFarmingCurveBehindBody', stat: 'coachFarmingCurveBehindStat' },

  fightKpHigh: { title: 'coachFightKpHighTitle', body: 'coachFightKpHighBody', stat: 'coachFightKpHighStat' },
  fightKpLow: { title: 'coachFightKpLowTitle', body: 'coachFightKpLowBody', stat: 'coachFightKpLowStat' },
  fightDamageShareHigh: { title: 'coachFightDamageShareHighTitle', body: 'coachFightDamageShareHighBody', stat: 'coachFightDamageShareHighStat' },
  fightDamageLow: { title: 'coachFightDamageLowTitle', body: 'coachFightDamageLowBody', stat: 'coachFightDamageLowStat' },

  disciplineLowDeaths: { title: 'coachDisciplineLowDeathsTitle', body: 'coachDisciplineLowDeathsBody', stat: 'coachDisciplineLowDeathsStat' },
  disciplineHighDeaths: { title: 'coachDisciplineHighDeathsTitle', body: 'coachDisciplineHighDeathsBody', stat: 'coachDisciplineHighDeathsStat' },

  objectiveTowerHigh: { title: 'coachObjectiveTowerHighTitle', body: 'coachObjectiveTowerHighBody', stat: 'coachObjectiveTowerHighStat' },
  objectiveTowerLow: { title: 'coachObjectiveTowerLowTitle', body: 'coachObjectiveTowerLowBody', stat: 'coachObjectiveTowerLowStat' },

  visionCoverageHigh: { title: 'coachVisionCoverageHighTitle', body: 'coachVisionCoverageHighBody', stat: 'coachVisionCoverageHighStat' },
  visionCoverageLow: { title: 'coachVisionCoverageLowTitle', body: 'coachVisionCoverageLowBody', stat: 'coachVisionCoverageLowStat' },
  visionUptimeLow: { title: 'coachVisionUptimeLowTitle', body: 'coachVisionUptimeLowBody', stat: 'coachVisionUptimeLowStat' },
  visionWardsLostEarly: { title: 'coachVisionWardsLostEarlyTitle', body: 'coachVisionWardsLostEarlyBody', stat: 'coachVisionWardsLostEarlyStat' },
  visionDewardsHigh: { title: 'coachVisionDewardsHighTitle', body: 'coachVisionDewardsHighBody', stat: 'coachVisionDewardsHighStat' },

  deathsBurst: { title: 'coachDeathsBurstTitle', body: 'coachDeathsBurstBody', stat: 'coachDeathsBurstStat' },
  deathsWardWalk: { title: 'coachDeathsWardWalkTitle', body: 'coachDeathsWardWalkBody', stat: 'coachDeathsWardWalkStat' },
  deathsDieBack: { title: 'coachDeathsDieBackTitle', body: 'coachDeathsDieBackBody', stat: 'coachDeathsDieBackStat' },
  deathsTpInterrupted: { title: 'coachDeathsTpInterruptedTitle', body: 'coachDeathsTpInterruptedBody', stat: 'coachDeathsTpInterruptedStat' },
  deathsHealUnused: { title: 'coachDeathsHealUnusedTitle', body: 'coachDeathsHealUnusedBody', stat: 'coachDeathsHealUnusedStat' },
  deathsTimeDead: { title: 'coachDeathsTimeDeadTitle', body: 'coachDeathsTimeDeadBody', stat: 'coachDeathsTimeDeadStat' },
  deathsNemesis: { title: 'coachDeathsNemesisTitle', body: 'coachDeathsNemesisBody', stat: 'coachDeathsNemesisStat' },

  buildItemLate: { title: 'coachBuildItemLateTitle', body: 'coachBuildItemLateBody', stat: 'coachBuildItemLateStat', bench: 'coachBuildItemLateBench' },
  buildItemMissing: { title: 'coachBuildItemMissingTitle', body: 'coachBuildItemMissingBody', stat: 'coachBuildItemMissingStat' },
  buildItemOffMeta: { title: 'coachBuildItemOffMetaTitle', body: 'coachBuildItemOffMetaBody', stat: 'coachBuildItemOffMetaStat' },
  buildItemGood: { title: 'coachBuildItemGoodTitle', body: 'coachBuildItemGoodBody', stat: 'coachBuildItemGoodStat' },

  matchupHardCounter: { title: 'coachMatchupHardCounterTitle', body: 'coachMatchupHardCounterBody', stat: 'coachMatchupHardCounterStat' },
  matchupThreatMagical: { title: 'coachMatchupThreatMagicalTitle', body: 'coachMatchupThreatMagicalBody', stat: 'coachMatchupThreatMagicalStat' },
  matchupThreatPhysical: { title: 'coachMatchupThreatPhysicalTitle', body: 'coachMatchupThreatPhysicalBody', stat: 'coachMatchupThreatPhysicalStat' },
  matchupThreatLockdown: { title: 'coachMatchupThreatLockdownTitle', body: 'coachMatchupThreatLockdownBody', stat: 'coachMatchupThreatLockdownStat' },
  matchupCounterItem: { title: 'coachMatchupCounterItemTitle', body: 'coachMatchupCounterItemBody', stat: 'coachMatchupCounterItemStat', bench: 'coachMatchupCounterItemBench' },

  compositeBurstNoDispel: { title: 'coachCompositeBurstNoDispelTitle', body: 'coachCompositeBurstNoDispelBody', stat: 'coachCompositeBurstNoDispelStat', bench: 'coachCompositeBurstNoDispelBench' },
};

/** Categoria -> rotulo. `category` existia no tipo e nunca era renderizado. */
export const CATEGORY_LABEL: Record<InsightCategory, TranslationKey> = {
  LANING: 'coachCatLaning',
  FARMING: 'coachCatFarming',
  FIGHTING: 'coachCatFighting',
  VISION: 'coachCatVision',
  DISCIPLINE: 'coachCatDiscipline',
  OBJECTIVE: 'coachCatObjective',
  BUILD: 'coachCatBuild',
  MATCHUP: 'coachCatMatchup',
  DEATHS: 'coachCatDeaths',
};

/** Procedencia -> rotulo do chip. É o que impede estimativa de passar por fato. */
export const SOURCE_LABEL: Record<BenchmarkSource, TranslationKey> = {
  HERO_AVERAGE: 'coachSrcHeroAverage',
  HERO_STATS: 'coachSrcHeroStats',
  MATCH_ONLY: 'coachSrcMatchOnly',
  ROLE_BASELINE: 'coachSrcRoleBaseline',
};
