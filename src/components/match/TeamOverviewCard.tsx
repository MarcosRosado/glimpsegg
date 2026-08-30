import React from 'react';
import { Trophy, Swords, Coins, Flame, Eye, Landmark, HeartPulse } from 'lucide-react';
import { MatchDetails, Role } from '../../types/dota';
import { AwardId, AwardUnit, MatchAward, computeMatchAwards } from '../../utils/awardEngine';
import { TranslationKey } from '../../i18n/translations';
import { getHero } from '../../constants/heroes';
import { formatGold, formatImpMarked } from '../../utils/dotaFormatters';
import { handleHeroImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';


/**
 * `AwardId` -> chave i18n. Uniao fechada num `Record`, com literais explicitos: premio
 * novo sem texto quebra o `tsc -b`, e o teste de chave orfa so enxerga literais.
 * Substituiu os titulos em portugues que viviam dentro do awardEngine.
 */
const AWARD_LABEL: Record<AwardId, TranslationKey> = {
  MVP: 'awardMvp',
  TOP_CORE: 'awardTopCore',
  TOP_SUPPORT: 'awardTopSupport',
  ROUGH_GAME: 'awardRoughGame',
  MOST_HERO_DAMAGE: 'awardMostHeroDamage',
  MOST_TOWER_DAMAGE: 'awardMostTowerDamage',
  MOST_HEALING: 'awardMostHealing',
  MOST_ASSISTS: 'awardMostAssists',
  MOST_KILLS: 'awardMostKills',
  MOST_NETWORTH: 'awardMostNetworth',
  MOST_DENIES: 'awardMostDenies',
  MOST_WARDS: 'awardMostWards',
};

/** Nome da funcao, nao "P1". "HC" e "Mid" e o que se fala; "POSITION_1" e o enum. */
const POSITION_LABEL: Record<Role, TranslationKey> = {
  POSITION_1: 'posRoleHardCarry',
  POSITION_2: 'posRoleMid',
  POSITION_3: 'posRoleOfflane',
  POSITION_4: 'posRoleSoftSupport',
  POSITION_5: 'posRoleHardSupport',
  UNKNOWN: 'posRoleUnknown',
};

/**
 * Tooltip de cada selo. Sem isso, "Sufocador" e um apelido sem criterio: o leitor nao
 * tem como saber que significa "mais denies da partida, com folga sobre o segundo".
 */
const AWARD_HINT: Record<AwardId, TranslationKey> = {
  MVP: 'awardHintMvp',
  TOP_CORE: 'awardHintTopCore',
  TOP_SUPPORT: 'awardHintTopSupport',
  ROUGH_GAME: 'awardHintRoughGame',
  MOST_HERO_DAMAGE: 'awardHintMostHeroDamage',
  MOST_TOWER_DAMAGE: 'awardHintMostTowerDamage',
  MOST_HEALING: 'awardHintMostHealing',
  MOST_ASSISTS: 'awardHintMostAssists',
  MOST_KILLS: 'awardHintMostKills',
  MOST_NETWORTH: 'awardHintMostNetworth',
  MOST_DENIES: 'awardHintMostDenies',
  MOST_WARDS: 'awardHintMostWards',
};

/**
 * A frase do numero. `27` sozinho nao diz nada — a metrica precisa vir junto, e o
 * template deixa cada idioma escolher a ordem e o substantivo ("27 denies",
 * "3,8 mil de cura").
 */
const AWARD_VALUE: Record<AwardId, TranslationKey> = {
  MVP: 'awardValueImp',
  TOP_CORE: 'awardValueImp',
  TOP_SUPPORT: 'awardValueImp',
  ROUGH_GAME: 'awardValueImp',
  MOST_HERO_DAMAGE: 'awardValueHeroDamage',
  MOST_TOWER_DAMAGE: 'awardValueTowerDamage',
  MOST_HEALING: 'awardValueHealing',
  MOST_ASSISTS: 'awardValueAssists',
  MOST_KILLS: 'awardValueKills',
  MOST_NETWORTH: 'awardValueNetworth',
  MOST_DENIES: 'awardValueDenies',
  MOST_WARDS: 'awardValueWards',
};

const AWARD_STYLE: Record<AwardId, string> = {
  MVP: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  TOP_CORE: 'bg-purple-500/20 text-purple-200 border-purple-500/50',
  TOP_SUPPORT: 'bg-teal-500/20 text-teal-200 border-teal-500/50',
  ROUGH_GAME: 'bg-slate-600/25 text-slate-300 border-slate-600/50',
  MOST_HERO_DAMAGE: 'bg-red-500/15 text-red-300 border-red-500/40',
  MOST_TOWER_DAMAGE: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  MOST_HEALING: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  MOST_ASSISTS: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  MOST_KILLS: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  MOST_NETWORTH: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',
  MOST_DENIES: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  MOST_WARDS: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
};

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** So o numero, ja abreviado. Quem chama decide se ele vira frase. */
function formatAwardNumber(value: number, unit: AwardUnit): string {
  if (unit === 'IMP') return formatImpMarked(value);
  if (unit === 'GOLD' || unit === 'DAMAGE') return formatGold(value);
  return String(value);
}

/**
 * A frase completa: "27 denies", "19,6k em torres", "+24 IMP". O motor devolve numero
 * cru justamente para que idioma e unidade sejam decididos aqui.
 */
function formatAwardValue(award: { value: number; unit: AwardUnit; id: AwardId }, t: Translate): string {
  return t(AWARD_VALUE[award.id], { value: formatAwardNumber(award.value, award.unit) });
}

const AwardBadge: React.FC<{ id: AwardId; t: Translate; small?: boolean }> = ({ id, t, small }) => (
  <span
    title={t(AWARD_HINT[id])}
    className={`font-black uppercase tracking-wide rounded border cursor-help ${AWARD_STYLE[id]} ${
      small ? 'text-[8px] px-1 py-px' : 'text-[9px] px-1.5 py-0.5'
    }`}
  >
    {t(AWARD_LABEL[id])}
  </span>
);

const AwardRow: React.FC<{
  award: MatchAward;
  t: Translate;
  onSelect: (playerSlot: number) => void;
  selected: number;
}> = ({ award, t, onSelect, selected }) => {
  const hero = getHero(award.heroId);
  const isSelected = selected === award.playerSlot;
  return (
    <button
      onClick={() => onSelect(award.playerSlot)}
      className={`text-left rounded-lg px-2.5 py-2 border transition flex items-center gap-2.5 w-full ${
        isSelected
          ? 'border-amber-500/70 bg-amber-500/10'
          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60'
      }`}
    >
      <img
        src={hero.avatarUrl}
        alt={hero.displayName}
        className="w-10 h-7 object-cover rounded border border-slate-700 shrink-0"
        onError={handleHeroImageError}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-bold text-slate-100 truncate">{hero.displayName}</span>
          <AwardBadge id={award.id} t={t} />
        </span>
        {/* Por que ele levou o premio. `basis` = as categorias que ele liderou; sem
            elas, o criterio foi o IMP e e o IMP que aparece. "1 superlativo" nao
            informava nada — "Carrasco" diz que ele fez mais abates.
            Corta em duas: a lista inteira ja esta logo abaixo, com os numeros. */}
        <span className="block text-[10px] font-mono text-slate-400 truncate mt-0.5">
          {award.basis && award.basis.length > 0 ? (
            <>
              {award.basis.slice(0, 2).map((id) => t(AWARD_LABEL[id])).join(' • ')}
              {award.basis.length > 2 && (
                <span className="text-slate-600">
                  {' '}
                  {t('awardsMoreLeads', { count: award.basis.length - 2 })}
                </span>
              )}
            </>
          ) : (
            formatAwardValue(award, t)
          )}
        </span>
      </span>
    </button>
  );
};

interface SuperlativeGroup {
  playerSlot: number;
  heroId: number;
  awards: MatchAward[];
}

/** Preserva a ordem por margem: o dono do superlativo mais dominante vem primeiro. */
function groupByPlayer(superlatives: MatchAward[]): SuperlativeGroup[] {
  const groups: SuperlativeGroup[] = [];
  for (const a of superlatives) {
    const found = groups.find((g) => g.playerSlot === a.playerSlot);
    if (found) found.awards.push(a);
    else groups.push({ playerSlot: a.playerSlot, heroId: a.heroId, awards: [a] });
  }
  return groups;
}

const SuperlativeRow: React.FC<{
  group: SuperlativeGroup;
  t: Translate;
  onSelect: (playerSlot: number) => void;
  selected: number;
}> = ({ group, t, onSelect, selected }) => {
  const hero = getHero(group.heroId);
  const isSelected = selected === group.playerSlot;
  return (
    <button
      onClick={() => onSelect(group.playerSlot)}
      className={`text-left rounded-lg px-2.5 py-2 border transition flex items-start gap-2.5 w-full ${
        isSelected
          ? 'border-amber-500/70 bg-amber-500/10'
          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60'
      }`}
    >
      <img
        src={hero.avatarUrl}
        alt={hero.displayName}
        className="w-10 h-7 object-cover rounded border border-slate-700 shrink-0 mt-0.5"
        onError={handleHeroImageError}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-slate-100 truncate">{hero.displayName}</span>
        {/* Uma linha por categoria: selo + o numero JA COM a metrica. O formato antigo
            era "Sufocador · Lifestealer · 27" — tres informacoes soltas, e o 27 sem
            dizer 27 de que. */}
        <span className="block space-y-0.5 mt-1">
          {group.awards.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5 min-w-0">
              <AwardBadge id={a.id} t={t} small />
              <span className="text-[10px] font-mono text-slate-300 truncate">
                {formatAwardValue(a, t)}
              </span>
              <span
                className="text-[9px] font-mono text-slate-600 shrink-0"
                title={t('awardMarginHint')}
              >
                +{Math.round(a.marginPct || 0)}%
              </span>
            </span>
          ))}
        </span>
      </span>
    </button>
  );
};

interface TeamOverviewCardProps {
  match: MatchDetails;
  selectedPlayerSlot: number;
  onSelectPlayer: (playerSlot: number) => void;
}

export const TeamOverviewCard: React.FC<TeamOverviewCardProps> = ({
  match,
  selectedPlayerSlot,
  onSelectPlayer,
}) => {
  const { t } = useLanguage();
  const { awards, superlatives, positions, aggregates } = computeMatchAwards(match);

  const totalGoldCombined = (aggregates.radiantNetworth + aggregates.direNetworth) || 1;
  const radGoldPct = Math.round((aggregates.radiantNetworth / totalGoldCombined) * 100);
  const direGoldPct = 100 - radGoldPct;

  const totalKillsCombined = (aggregates.radiantKills + aggregates.direKills) || 1;
  const radKillsPct = Math.round((aggregates.radiantKills / totalKillsCombined) * 100);
  const direKillsPct = 100 - radKillsPct;

  const totalDmgCombined = (aggregates.radiantHeroDamage + aggregates.direHeroDamage) || 1;
  const radDmgPct = Math.round((aggregates.radiantHeroDamage / totalDmgCombined) * 100);
  const direDmgPct = 100 - radDmgPct;

  return (
    <div className="space-y-6">
      {/* Destaques da partida: papeis, superlativos por metrica e melhor de cada
          posicao. Substituiu quatro cartoes grandes cujo texto e cor vinham cravados
          no awardEngine — e cravados em portugues. */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 bg-[#0f1624] shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {t('awardsTitle')}
          </h2>
        </div>

        {/* Destaques de papel. Lista vazia é resultado valido: ninguem se destacou. */}
        {awards.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {t('awardsRoles')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {awards.map((a) => (
                <AwardRow key={a.id} award={a} t={t} onSelect={onSelectPlayer} selected={selectedPlayerSlot} />
              ))}
            </div>
          </div>
        )}

        {superlatives.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {t('awardsLeaders')}
            </div>
            {/* Agrupado por jogador: quando um carry leva cinco superlativos — acontece,
                e é a historia da partida — o card mostra um heroi com cinco selos em vez
                de cinco cartoes do mesmo heroi. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {groupByPlayer(superlatives).map((group) => (
                <SuperlativeRow
                  key={group.playerSlot}
                  group={group}
                  t={t}
                  onSelect={onSelectPlayer}
                  selected={selectedPlayerSlot}
                />
              ))}
            </div>
          </div>
        )}

        {positions.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {t('awardsByPosition')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {positions.map((ph) => {
                const hero = getHero(ph.heroId);
                const isSelected = selectedPlayerSlot === ph.playerSlot;
                return (
                  <button
                    key={ph.position}
                    onClick={() => onSelectPlayer(ph.playerSlot)}
                    className={`text-left rounded-lg px-2 py-1.5 border transition flex items-center gap-2 ${
                      isSelected
                        ? 'border-amber-500/70 bg-amber-500/10'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`text-[10px] font-black font-mono shrink-0 w-7 text-center rounded px-1 py-0.5 ${
                      ph.isRadiant ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {t(POSITION_LABEL[ph.position])}
                    </span>
                    <img
                      src={hero.avatarUrl}
                      alt={hero.displayName}
                      className="w-8 h-5 object-cover rounded border border-slate-700 shrink-0"
                      onError={handleHeroImageError}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-slate-200 truncate">
                        {hero.displayName}
                      </span>
                      <span className="block text-[10px] font-mono text-slate-400 truncate">
                        {t('awardValueImp', { value: formatImpMarked(ph.imp) })}
                        {ph.stat && ` \u2022 ${formatAwardValue({ ...ph.stat }, t)}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Comparative Team Statistics Dashboard */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 bg-[#0f1624] shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {t('teamComparison')}
            </h2>
          </div>
          <div className="flex items-center gap-6 text-xs font-bold">
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              {t('radiant')} ({match.didRadiantWin ? t('win') : t('loss')})
            </span>
            <span className="text-rose-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              {t('dire')} ({!match.didRadiantWin ? t('win') : t('loss')})
            </span>
          </div>
        </div>

        <div className="space-y-4 font-mono text-xs">
          {/* Networth Bar */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1.5 font-sans">
              <span className="font-bold text-emerald-400">{formatGold(aggregates.radiantNetworth)}</span>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" /> {t('totalGold')}
              </span>
              <span className="font-bold text-rose-400">{formatGold(aggregates.direNetworth)}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 flex overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                style={{ width: `${radGoldPct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                style={{ width: `${direGoldPct}%` }}
              />
            </div>
          </div>

          {/* Kills Bar */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1.5 font-sans">
              <span className="font-bold text-emerald-400">{t('killsCount', { count: aggregates.radiantKills })}</span>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Swords className="w-3.5 h-3.5 text-indigo-400" /> {t('totalKills')}
              </span>
              <span className="font-bold text-rose-400">{t('killsCount', { count: aggregates.direKills })}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 flex overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                style={{ width: `${radKillsPct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                style={{ width: `${direKillsPct}%` }}
              />
            </div>
          </div>

          {/* Hero Damage Bar */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1.5 font-sans">
              <span className="font-bold text-emerald-400">{aggregates.radiantHeroDamage.toLocaleString()}</span>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" /> {t('totalDamage')}
              </span>
              <span className="font-bold text-rose-400">{aggregates.direHeroDamage.toLocaleString()}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 flex overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                style={{ width: `${radDmgPct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                style={{ width: `${direDmgPct}%` }}
              />
            </div>
          </div>

          {/* Tower Damage, Ally Healing & Vision Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300 font-sans font-medium">{t('towerDamage')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">{aggregates.radiantTowerDamage.toLocaleString()}</span>
                <span className="text-slate-600">vs</span>
                <span className="text-rose-400 font-bold">{aggregates.direTowerDamage.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-teal-400" />
                <span className="text-slate-300 font-sans font-medium">{t('healingDone')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">{aggregates.radiantHealing.toLocaleString()}</span>
                <span className="text-slate-600">vs</span>
                <span className="text-rose-400 font-bold">{aggregates.direHealing.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300 font-sans font-medium">{t('wardsPlaced')}</span>
              </div>
              {/* Sem dado de visao é "—", nao "0 vs 0". Antes havia um fallback
                  inventado (`: 4` Radiant / `: 3` Dire) que mostrava o Radiant
                  sistematicamente a frente em toda partida sem dado. */}
              {aggregates.wardsMeasured ? (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">{aggregates.radiantWards}</span>
                  <span className="text-slate-600">vs</span>
                  <span className="text-rose-400 font-bold">{aggregates.direWards}</span>
                </div>
              ) : (
                <span className="text-slate-500 text-xs font-sans">{t('noVisionDataShort')}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
