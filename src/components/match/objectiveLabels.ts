import type { MatchObjective } from '../../types/dota';
import type { TranslationKey } from '../../i18n/translations';

/**
 * Rótulo de cada tipo de objetivo. Literais num `Record` de união fechada: tipo novo quebra o
 * build, e o teste de chave órfã enxerga as chaves. Compartilhado pela aba Lutas e pelo
 * cartão de tempo morto.
 */
export const OBJECTIVE_LABEL: Record<MatchObjective['kind'], TranslationKey> = {
  TOWER: 'objTower',
  BARRACKS: 'objBarracks',
  ANCIENT: 'objAncient',
  OTHER_BUILDING: 'objOtherBuilding',
  ROSHAN: 'objRoshan',
  TORMENTOR: 'objTormentor',
};
