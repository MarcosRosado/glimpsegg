import React, { useState, useMemo } from 'react';
import {
  ScanEye, Swords, ChevronRight, Zap, Trophy, Shield, Clock, Flame, RotateCcw, Crown, Coins,
  User, Users, X, Crosshair, Hammer, HeartPulse, Ban, ChevronsUp, Hourglass, PiggyBank, ShieldCheck,
} from 'lucide-react';
import { PlayerMatchSummary } from '../../types/dota';
import { TranslationKey } from '../../i18n/translations';
import { getHero } from '../../constants/heroes';
import { getItem } from '../../constants/items';
import { formatDuration, formatGold, formatTimeAgo, resolveMatchType, MatchTypeCode } from '../../utils/dotaFormatters';
import { ImpBadge } from '../ui/ImpBadge';
import { handleHeroImageError, handleItemImageError } from '../../utils/imageFallback';
import { LANE_RESULT_KEY, hasLaneVerdict, isLaneWin, isLaneLoss } from '../../utils/laneResult';
import { useLanguage } from '../../context/LanguageContext';
import { MatchContextCell } from './MatchContextCell';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface MatchTag {
  key: string;
  label: string;
  icon?: React.ReactNode;
  className: string;
  priority: number;
}

/**
 * Limiares das tags.
 *
 * CALIBRACAO — 100 partidas reais de um perfil de bracket 6 (Divine/Immortal),
 * consultadas na STRATZ em 2026-08-30. A taxa de disparo medida esta ao lado de cada
 * constante; o alvo foi a faixa de 5% a 15%, que é onde a tag ainda significa
 * "destaque". Numero fora dessa faixa vira decoracao: `goldPerMinute >= 750`, o valor
 * anterior de `FARM_GPM`, disparava em **59%** das partidas — a mediana da amostra é
 * 835 de GPM.
 *
 * A amostra é de UM jogador, entao ela calibra bem a ordem de grandeza e mal a cauda
 * por posicao (só 10-11 partidas de cada suporte). Refazer a medicao antes de mexer
 * nestes numeros, e nao ajusta-los "no olho" — foi assim que o 750 envelheceu sem
 * ninguem notar.
 *
 * Limiares RELATIVOS (participacao em abates, fatia de dano) sao preferidos aos
 * absolutos onde possivel: sao razoes sobre o time, entao nao envelhecem quando um
 * patch infla a economia do jogo.
 */
const FARM_GPM = 1500;               // 10% — p90 da amostra é 1498
const KILL_PARTICIPATION_PCT = 80;   //  9%
const DAMAGE_SHARE_PCT = 33;         // 10%
const CS_PER_MIN = 8;                //  9%
const TOWER_DAMAGE = 12000;          // 11%
const HERO_HEALING = 5000;           //  6%
const DENIES = 15;                   //  6%
const MAX_LEVEL = 30;                // 13% — nivel maximo do Dota
const MARATHON_MIN = 60;             //  6%
const UNSPENT_GOLD = 5000;           // 15%
const MAX_TAGS = 4;

function getAccumulatedMatchTags(match: PlayerMatchSummary, t: Translate): MatchTag[] {
  const tags: MatchTag[] = [];
  // `|| 2100` assumia 35 minutos quando a duracao nao vinha, e essa suposicao decidia
  // sozinha qual badge aparecia (stomp <=32min, comeback >=42min). Sem duracao real, os
  // criterios que dependem dela simplesmente nao se aplicam.
  const durMin = match.durationSeconds > 0 ? match.durationSeconds / 60 : null;
  const kda = match.kda || ((match.kills + match.assists) / Math.max(1, match.deaths));

  // 1. RESULTADO DA PARTIDA (Match Dynamic Outcome)
  if (match.isVictory) {
    if (durMin !== null && durMin <= 32 && (kda >= 5.0 || match.goldPerMinute >= 720 || match.imp >= 25)) {
      tags.push({
        key: 'dyn-stomp',
        label: t('badgeStomp'),
        icon: <Flame className="w-2.5 h-2.5" />,
        className: 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-bold',
        priority: 75,
      });
    } else if ((durMin !== null && durMin >= 42) || match.deaths >= 7) {
      tags.push({
        key: 'dyn-comeback',
        label: t('badgeComeback'),
        icon: <RotateCcw className="w-2.5 h-2.5" />,
        className: 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold',
        priority: 70,
      });
    } else {
      tags.push({
        key: 'dyn-win',
        label: t('badgeSolidWin'),
        icon: <Swords className="w-2.5 h-2.5" />,
        className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium',
        priority: 30,
      });
    }
  } else {
    if (durMin !== null && durMin >= 40) {
      tags.push({
        key: 'dyn-contested',
        label: t('badgeContested'),
        icon: <Swords className="w-2.5 h-2.5" />,
        className: 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-medium',
        priority: 40,
      });
    } else if (durMin !== null && durMin <= 28) {
      tags.push({
        key: 'dyn-fast-loss',
        label: t('badgeFastLoss'),
        icon: <Flame className="w-2.5 h-2.5" />,
        className: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-medium',
        priority: 35,
      });
    } else {
      tags.push({
        key: 'dyn-loss',
        label: t('badgeLoss'),
        icon: <Shield className="w-2.5 h-2.5" />,
        className: 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-medium',
        priority: 20,
      });
    }
  }

  // 2. RESULTADO DA ROTA — do dado real da STRATZ, e so dele.
  //
  // Este bloco decidia a rota por `imp`, `kda`, `numLastHits`, `deaths` e `isVictory`,
  // todos da PARTIDA INTEIRA. `deaths >= 7 && !isVictory` marcava "Rota Dificil" numa
  // safelane atropelada que perdeu o jogo depois. Sem `laneResult`, a partida nao foi
  // parseada e nenhum badge de rota aparece — omitir é a saida honesta, estimar nao é.
  if (hasLaneVerdict(match.laneResult)) {
    const won = isLaneWin(match.laneResult);
    const lost = isLaneLoss(match.laneResult);
    const stomp = match.laneResult === 'STOMP_WON' || match.laneResult === 'STOMP_LOST';
    tags.push({
      key: 'lane-result',
      label: t(LANE_RESULT_KEY[match.laneResult]),
      className: won
        ? stomp
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
          : 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-medium'
        : lost
          ? stomp
            ? 'bg-rose-500/25 text-rose-200 border-rose-500/50 font-bold'
            : 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-medium'
          : 'bg-slate-500/20 text-slate-300 border-slate-500/40 font-medium',
      // Alta de proposito, atras so do MVP. Com o teto de 4 tags, a rota é o unico
      // eixo aqui que a linha nao mostra de outro jeito — vitoria/derrota ja aparece
      // em texto ao lado do placar, entao o badge de resultado pode ser cortado.
      priority: stomp ? 95 : won || lost ? 82 : 64,
    });
  }

  // 2b. IMPACTO INDIVIDUAL. Mede a partida inteira, e o rotulo agora diz isso — era
  // este numero que se passava por veredito de rota.
  if (match.imp >= 15 && kda >= 4) {
    tags.push({
      key: 'impact-high',
      label: t('badgeHighImpact'),
      className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold',
      priority: 58,
    });
  } else if (match.imp <= -10) {
    tags.push({
      key: 'impact-low',
      label: t('badgeLowImpact'),
      className: 'bg-slate-600/25 text-slate-300 border-slate-600/40 font-medium',
      priority: 22,
    });
  }

  // 3. DESTAQUES INDIVIDUAIS (Awards & Accolades)
  if (match.award === 'MVP' || match.imp >= 35) {
    tags.push({
      key: 'award-mvp',
      label: t('badgeMvp'),
      icon: <Trophy className="w-3 h-3 text-amber-400" />,
      className: 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-black shadow-sm shadow-amber-950',
      priority: 100,
    });
  }

  if (match.award === 'TOP_SUPPORT' || (['POSITION_4', 'POSITION_5'].includes(match.role) && match.imp >= 15 && match.award !== 'MVP')) {
    tags.push({
      key: 'award-top-sup',
      label: t('badgeTopSupport'),
      icon: <Shield className="w-3 h-3 text-purple-400" />,
      className: 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-bold',
      priority: 90,
    });
  }

  // `TOP_CORE` vinha da STRATZ e era simplesmente ignorado, embora `TOP_SUPPORT`
  // fosse honrado logo acima. Na amostra de calibracao apareceu em 8% das partidas.
  if (match.award === 'TOP_CORE') {
    tags.push({
      key: 'award-top-core',
      label: t('badgeTopCore'),
      icon: <Swords className="w-3 h-3 text-orange-400" />,
      className: 'bg-orange-500/20 text-orange-300 border-orange-500/50 font-bold',
      priority: 89,
    });
  }

  // Raro (3% da amostra) e coletivo, mas é o tipo de partida que se lembra.
  if (match.keptAllTowers) {
    tags.push({
      key: 'ctx-flawless',
      label: t('badgeNoTowersLost'),
      icon: <ShieldCheck className="w-2.5 h-2.5 text-teal-300" />,
      className: 'bg-teal-500/20 text-teal-200 border-teal-500/50 font-bold',
      priority: 88,
    });
  }

  if (match.deaths === 0) {
    tags.push({
      key: 'acc-immortal',
      label: t('badgeNoDeaths'),
      icon: <Crown className="w-2.5 h-2.5 text-cyan-400" />,
      className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold',
      priority: 85,
    });
  }

  if (match.imp >= 25 && match.award !== 'MVP' && match.imp < 35) {
    tags.push({
      key: 'acc-high-imp',
      label: t('badgeImpact', { value: match.imp }),
      icon: <Zap className="w-2.5 h-2.5 text-amber-400" />,
      className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 font-bold',
      priority: 65,
    });
  }

  // 750 GPM disparava em 59% das partidas da amostra de calibracao — nao era
  // destaque, era ruido. A mediana ali é 835 e o p90 é 1498. Ver o bloco de
  // calibracao acima.
  if (match.goldPerMinute >= FARM_GPM) {
    tags.push({
      key: 'acc-heavy-farm',
      label: t('badgeFarm', { value: match.goldPerMinute }),
      icon: <Coins className="w-2.5 h-2.5 text-amber-400" />,
      className: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-medium',
      priority: 50,
    });
  }

  if (match.deaths > 0 && kda >= 10) {
    tags.push({
      key: 'acc-kda-10',
      label: t('badgeKda', { value: kda.toFixed(1) }),
      className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium',
      priority: 45,
    });
  }

  // 4. MEDIDAS DE JOGO, cada uma com um eixo que nenhuma outra tag cobre.
  //    Todas guardadas por `!= null`: campo ausente = sem tag, nunca zero.

  // Presenca nas lutas. Razao sobre os abates do time, entao imune a inflacao de
  // patch — diferente de GPM/dano absolutos.
  if (match.killParticipationPct != null && match.killParticipationPct >= KILL_PARTICIPATION_PCT) {
    tags.push({
      key: 'acc-kill-participation',
      label: t('badgeKillParticipation', { value: Math.round(match.killParticipationPct) }),
      icon: <Users className="w-2.5 h-2.5 text-sky-400" />,
      className: 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold',
      priority: 62,
    });
  }

  if (match.damageSharePct != null && match.damageSharePct >= DAMAGE_SHARE_PCT) {
    tags.push({
      key: 'acc-damage-share',
      label: t('badgeDamageShare', { value: Math.round(match.damageSharePct) }),
      icon: <Swords className="w-2.5 h-2.5 text-red-400" />,
      className: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold',
      priority: 57,
    });
  }

  // CS por minuto e GPM medem coisas diferentes: ouro vem tambem de abates e de
  // bounty. Na amostra, as duas tags coincidiram em so 4 das 100 partidas.
  if (durMin !== null && match.numLastHits / durMin >= CS_PER_MIN) {
    tags.push({
      key: 'acc-cs-per-min',
      label: t('badgeCsPerMin', { value: (match.numLastHits / durMin).toFixed(1) }),
      icon: <Crosshair className="w-2.5 h-2.5 text-lime-400" />,
      className: 'bg-lime-500/20 text-lime-300 border-lime-500/40 font-medium',
      priority: 52,
    });
  }

  if (match.towerDamage != null && match.towerDamage >= TOWER_DAMAGE) {
    tags.push({
      key: 'acc-tower-damage',
      label: t('badgeTowerDamage', { value: formatGold(match.towerDamage) }),
      icon: <Hammer className="w-2.5 h-2.5 text-orange-400" />,
      className: 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-medium',
      priority: 48,
    });
  }

  if (match.heroHealing != null && match.heroHealing >= HERO_HEALING) {
    tags.push({
      key: 'acc-healing',
      label: t('badgeHealing', { value: formatGold(match.heroHealing) }),
      icon: <HeartPulse className="w-2.5 h-2.5 text-emerald-400" />,
      className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium',
      priority: 47,
    });
  }

  // `numDenies` ja vinha no historico e nao era usado por nenhuma tag.
  if (match.numDenies >= DENIES) {
    tags.push({
      key: 'acc-denies',
      label: t('badgeDenies', { value: match.numDenies }),
      icon: <Ban className="w-2.5 h-2.5 text-violet-400" />,
      className: 'bg-violet-500/20 text-violet-300 border-violet-500/40 font-medium',
      priority: 44,
    });
  }

  if (match.level != null && match.level >= MAX_LEVEL) {
    tags.push({
      key: 'acc-max-level',
      label: t('badgeMaxLevel'),
      icon: <ChevronsUp className="w-2.5 h-2.5 text-indigo-400" />,
      className: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-medium',
      priority: 33,
    });
  }

  if (durMin !== null && durMin >= MARATHON_MIN) {
    tags.push({
      key: 'ctx-marathon',
      label: t('badgeMarathon'),
      icon: <Hourglass className="w-2.5 h-2.5 text-slate-300" />,
      className: 'bg-slate-500/20 text-slate-300 border-slate-500/40 font-medium',
      priority: 28,
    });
  }

  // Fato, nao repreensao: ouro que terminou a partida em maos em vez de virar item.
  if (match.unspentGold != null && match.unspentGold >= UNSPENT_GOLD) {
    tags.push({
      key: 'acc-unspent-gold',
      label: t('badgeUnspentGold', { value: formatGold(match.unspentGold) }),
      icon: <PiggyBank className="w-2.5 h-2.5 text-yellow-500" />,
      className: 'bg-yellow-600/15 text-yellow-200/90 border-yellow-600/40 font-medium',
      priority: 18,
    });
  }

  // O teto era 3, e com o conjunto novo isso escondia tag em 16% das partidas.
  // Com 4, cai para 11% — e a media medida é 2.29 tags por partida.
  return tags
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_TAGS);
}

interface MatchListProps {
  matches: PlayerMatchSummary[];
  selectedMatchId: string | null;
  onSelectMatch: (matchId: string) => void;
  /** Heroi selecionado em "Mais Jogados"; `null` = sem filtro. */
  heroFilterId?: number | null;
  onClearHeroFilter?: () => void;
}

export const MatchList: React.FC<MatchListProps> = ({
  matches,
  selectedMatchId,
  onSelectMatch,
  heroFilterId = null,
  onClearHeroFilter,
}) => {
  const { t } = useLanguage();
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WON' | 'LOST'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | MatchTypeCode>('ALL');
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'SOLO' | 'PARTY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // Outcome filter
      if (outcomeFilter === 'WON' && !m.isVictory) return false;
      if (outcomeFilter === 'LOST' && m.isVictory) return false;

      // Role filter
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;

      // Heroi vindo do card "Mais Jogados"
      if (heroFilterId !== null && m.heroId !== heroFilterId) return false;

      // Tipo de partida e fila solo/grupo. Partida sem o dado passa pelo
      // filtro: escondê-la sugeriria que ela nao e daquele tipo, quando na
      // verdade a API so nao respondeu.
      if (typeFilter !== 'ALL') {
        const code = resolveMatchType(m.gameMode, m.lobbyType);
        if (code !== null && code !== typeFilter) return false;
      }

      if (queueFilter !== 'ALL' && m.partySize !== null && m.partySize !== undefined) {
        if (queueFilter === 'SOLO' && m.partySize > 1) return false;
        if (queueFilter === 'PARTY' && m.partySize <= 1) return false;
      }

      // Hero search
      if (searchQuery.trim()) {
        const hero = getHero(m.heroId);
        if (!hero.displayName.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [matches, outcomeFilter, roleFilter, typeFilter, queueFilter, heroFilterId, searchQuery]);

  // So oferece os modos que realmente aparecem no historico carregado — um
  // select com 'Battle Cup' para quem nunca jogou Battle Cup e ruido.
  const availableTypes = useMemo(() => {
    const seen = new Set<MatchTypeCode>();
    matches.forEach((m) => {
      const code = resolveMatchType(m.gameMode, m.lobbyType);
      if (code) seen.add(code);
    });
    return Array.from(seen);
  }, [matches]);

  const hasPartyData = useMemo(
    () => matches.some((m) => m.partySize !== null && m.partySize !== undefined),
    [matches],
  );

  const TYPE_LABEL: Record<MatchTypeCode, TranslationKey> = {
    RANKED: 'matchTypeRANKED',
    UNRANKED: 'matchTypeUNRANKED',
    TURBO: 'matchTypeTURBO',
    TOURNAMENT: 'matchTypeTOURNAMENT',
    BATTLE_CUP: 'matchTypeBATTLE_CUP',
    BOTS: 'matchTypeBOTS',
    EVENT: 'matchTypeEVENT',
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-xl bg-[#0b101a]">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <ScanEye className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-100 tracking-wide">
              {t('recentMatchesTitle')}
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              {t('showingMatches', { count: filteredMatches.length, total: matches.length })}
            </span>
            {heroFilterId !== null && (
              <button
                onClick={onClearHeroFilter}
                className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 transition"
                title={t('clearFilter')}
              >
                {getHero(heroFilterId).displayName}
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Outcome Filter */}
          <div className="flex bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setOutcomeFilter('ALL')}
              className={`px-3 py-1 rounded-md transition ${
                outcomeFilter === 'ALL' ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('allMatches')}
            </button>
            <button
              onClick={() => setOutcomeFilter('WON')}
              className={`px-3 py-1 rounded-md transition ${
                outcomeFilter === 'WON' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('wonMatches')}
            </button>
            <button
              onClick={() => setOutcomeFilter('LOST')}
              className={`px-3 py-1 rounded-md transition ${
                outcomeFilter === 'LOST' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('lostMatches')}
            </button>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-900/90 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500/60 font-mono transition"
          >
            <option value="ALL">{t('allRoles')}</option>
            <option value="POSITION_1">{t('pos1')}</option>
            <option value="POSITION_2">{t('pos2')}</option>
            <option value="POSITION_3">{t('pos3')}</option>
            <option value="POSITION_4">{t('pos4')}</option>
            <option value="POSITION_5">{t('pos5')}</option>
          </select>

          {/* Tipo de Partida — so aparece quando ha mais de um no historico */}
          {availableTypes.length > 1 && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | MatchTypeCode)}
              className="bg-slate-900/90 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500/60 font-mono transition"
            >
              <option value="ALL">{t('allMatchTypes')}</option>
              {availableTypes.map((code) => (
                <option key={code} value={code}>
                  {t(TYPE_LABEL[code])}
                </option>
              ))}
            </select>
          )}

          {/* Solo / Grupo — so aparece se a API devolveu tamanho de grupo */}
          {hasPartyData && (
            <div className="flex bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setQueueFilter('ALL')}
                className={`px-3 py-1 rounded-md transition ${
                  queueFilter === 'ALL' ? 'bg-slate-700 text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('allQueues')}
              </button>
              <button
                onClick={() => setQueueFilter('SOLO')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                  queueFilter === 'SOLO' ? 'bg-slate-700 text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3 h-3" />
                {t('partySolo')}
              </button>
              <button
                onClick={() => setQueueFilter('PARTY')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                  queueFilter === 'PARTY' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3 h-3" />
                {t('partyGroup')}
              </button>
            </div>
          )}

          {/* Search Hero */}
          <input
            type="text"
            placeholder={t('filterByHeroOrId')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-900/90 border border-slate-800 text-xs text-slate-300 rounded-lg px-3 py-1.5 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 w-40 font-mono transition"
          />
        </div>
      </div>

      {/* Match Table / Rows */}
      <div className="space-y-2">
        {filteredMatches.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            {t('noMatchesFound')}
          </div>
        ) : (
          filteredMatches.map((match) => {
            const hero = getHero(match.heroId);
            const isSelected = selectedMatchId === match.matchId;

            return (
              <div
                key={match.matchId}
                onClick={() => onSelectMatch(match.matchId)}
                /* Layout em DUAS formas, sem largura fixa que possa estourar.
                 *
                 * Ate `2xl` a linha é uma coluna: o bloco do heroi em cima e, embaixo, uma
                 * faixa que QUEBRA (`flex-wrap`) com numeros, contexto e itens. A partir de
                 * `2xl` o wrapper vira `display: contents` e os mesmos filhos passam a ser
                 * celulas da tabela de 7 colunas — mesmo DOM, duas apresentacoes.
                 *
                 * A primeira trilha é `minmax(0,1fr)`, e nao `minmax(260px,1fr)`: com um
                 * minimo em px o grid nao consegue encolher abaixo da soma das trilhas e
                 * transborda o card, que é como os itens iam parar por baixo da coluna da
                 * direita. Com `0` o nome do heroi trunca e nada vaza.
                 *
                 * `2xl` e nao `xl`: nesta pagina a lista ocupa 8 de 12 colunas, entao em
                 * 1280px de viewport ela tem ~800px uteis — a tabela so respira a partir de
                 * ~1536px. O breakpoint anterior ligava a tabela 300px cedo demais. */
                className={`flex flex-col gap-3 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_92px_96px_84px_108px_auto_20px] 2xl:items-center 2xl:gap-3 p-3.5 rounded-xl border transition-all cursor-pointer group ${
                  isSelected
                    ? 'border-cyan-500/80 bg-cyan-500/10 shadow-lg shadow-cyan-950/30'
                    : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                {/* 1. Left: Hero, Role, Outcome & Match Dynamics */}
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Hero Portrait with Victory/Defeat Indicator Bar */}
                  <div className="relative shrink-0">
                    <img
                      src={hero.avatarUrl}
                      alt={hero.displayName}
                      className="w-14 h-8 object-cover rounded-lg border border-slate-700 shadow-md"
                      onError={handleHeroImageError}
                    />
                    <div
                      className={`absolute top-0 bottom-0 left-0 w-1.5 rounded-l-lg ${
                        match.isVictory ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-100 group-hover:text-amber-400 transition mr-0.5 whitespace-nowrap">
                        {hero.displayName}
                      </span>

                      {/* Accumulating Tags: Top 3 by priority */}
                      {getAccumulatedMatchTags(match, t).map((tag) => (
                        <span
                          key={tag.key}
                          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-all whitespace-nowrap ${tag.className}`}
                        >
                          {tag.icon}
                          <span>{tag.label}</span>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                      <span className={`font-bold ${match.isVictory ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {match.isVictory ? t('win') : t('loss')}
                      </span>
                      <span>•</span>
                      <span className="text-purple-300">{match.role.replace('POSITION_', 'Pos ')}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {formatDuration(match.durationSeconds)}
                      </span>
                      <span>•</span>
                      <span>{formatTimeAgo(match.startDateTime)}</span>
                    </div>
                  </div>
                </div>

                {/* Faixa que quebra ate `2xl`; `contents` a dissolve na tabela depois.
                    A borda de cima separa os numeros do bloco do heroi no modo cartao e
                    desaparece sozinha em `2xl` — caixa com `display: contents` nao pinta
                    borda nem padding. */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-slate-800/60 pt-2.5 2xl:contents">
                {/* 2. KDA */}
                <div className="text-left 2xl:text-center font-mono">
                  <div className="font-bold text-slate-200 text-xs">
                    <span className="text-emerald-400">{match.kills}</span> /{' '}
                    <span className="text-rose-400">{match.deaths}</span> /{' '}
                    <span className="text-amber-400">{match.assists}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans">{match.kda.toFixed(1)} {t('kda')}</div>
                </div>

                {/* 3. CS & GPM */}
                <div className="text-left 2xl:text-center font-mono">
                  <div className="font-bold text-slate-300 text-xs">
                    {match.goldPerMinute} <span className="text-[10px] text-slate-500">{t('gpmShort')}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans">
                    {match.numLastHits} / {match.numDenies} CS
                  </div>
                </div>

                {/* 4. Prominent IMP Rating */}
                <div className="text-left 2xl:text-center font-mono">
                  <ImpBadge imp={match.imp} />
                  <div className="text-[9px] text-slate-400 font-sans mt-0.5">{t('impImpact')}</div>
                </div>

                {/* 5. Contexto: rank medio, grupo e tipo de partida */}
                <MatchContextCell
                  bracket={match.bracket}
                  partySize={match.partySize}
                  gameMode={match.gameMode}
                  lobbyType={match.lobbyType}
                />

                {/* 6. Item Inventory */}
                <div className="flex items-center 2xl:justify-center min-w-0">
                  {/* `flex-wrap` porque sao sempre 6 itens + neutro (~226px): numa trilha
                      fixa de 210px isso transbordava em QUALQUER largura, e era esse
                      excedente que aparecia por baixo do card ao lado. */}
                  <div className="flex flex-wrap items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
                    {match.items.map((itemId, idx) => {
                      const item = getItem(itemId);
                      return (
                        <div
                          key={idx}
                          className="w-7 h-5 rounded bg-slate-900 border border-slate-800/80 overflow-hidden shrink-0"
                          title={item.displayName}
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.displayName}
                              className="w-full h-full object-cover"
                              onError={handleItemImageError}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                    {/* Item neutro. A vaga é SEMPRE renderizada, vazia quando nao houve
                        neutro — igual as seis vagas de item acima, que ja desenham a
                        caixa vazia para slot sem item.
                        Nao e detalhe estetico: a trilha de itens no grid e `auto`, entao
                        um bloco 32px mais estreito faz o `minmax(0,1fr)` do heroi crescer
                        32px e TODAS as colunas do meio deslizarem. Aparecia em partida
                        curta demais para o neutro dropar (a 8873711711 durou 7min50). */}
                    <div
                      className={`w-6 h-5 rounded-full border overflow-hidden shrink-0 ml-1 bg-slate-900 ${
                        match.neutralItem ? 'border-amber-500/60' : 'border-slate-800/80'
                      }`}
                      title={match.neutralItem ? getItem(match.neutralItem).displayName : undefined}
                    >
                      {match.neutralItem ? (
                        <img
                          src={getItem(match.neutralItem).imageUrl}
                          alt={t('neutralItemAlt')}
                          className="w-full h-full object-cover"
                          onError={handleItemImageError}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                </div>

                {/* 7. Open Arrow */}
                <div className="hidden 2xl:flex items-center justify-center text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
