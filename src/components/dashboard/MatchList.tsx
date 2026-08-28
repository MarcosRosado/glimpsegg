import React, { useState, useMemo } from 'react';
import { ScanEye, Swords, ChevronRight, Zap, Trophy, Shield, Clock, Flame, RotateCcw, Crown, Coins, User, Users, X } from 'lucide-react';
import { PlayerMatchSummary } from '../../types/dota';
import { TranslationKey } from '../../i18n/translations';
import { getHero } from '../../constants/heroes';
import { getItem } from '../../constants/items';
import { formatDuration, formatTimeAgo, getImpBadgeStyle, resolveMatchType, MatchTypeCode } from '../../utils/dotaFormatters';
import { handleHeroImageError, handleItemImageError } from '../../utils/imageFallback';
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

  // 2. RESULTADO DA ROTA (Lane Outcome)
  if ((match.imp >= 15 && kda >= 4) || (match.numLastHits >= 230 && match.deaths <= 3)) {
    tags.push({
      key: 'lane-stomp',
      label: t('badgeLaneStomp'),
      className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold',
      priority: 80,
    });
  } else if (match.imp >= 5 || (kda >= 3.0 && match.isVictory)) {
    tags.push({
      key: 'lane-won',
      label: t('badgeLaneWon'),
      className: 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-medium',
      priority: 60,
    });
  } else if (match.imp <= -10 || (match.deaths >= 7 && !match.isVictory)) {
    tags.push({
      key: 'lane-lost',
      label: t('badgeLaneHard'),
      className: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-medium',
      priority: 55,
    });
  } else {
    tags.push({
      key: 'lane-even',
      label: t('badgeLaneEven'),
      className: 'bg-slate-500/20 text-slate-300 border-slate-500/40 font-medium',
      priority: 25,
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

  if (match.goldPerMinute >= 750) {
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

  // Sort strictly by priority descending and cap at maximum 3 most important tags!
  return tags
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
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
            const impStyle = getImpBadgeStyle(match.imp);
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
                  <div
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl border text-xs font-black shadow-md ${impStyle.bg} ${impStyle.text} ${impStyle.border}`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{match.imp >= 0 ? `+${match.imp}` : match.imp}</span>
                  </div>
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
                    {/* Neutral Item */}
                    {match.neutralItem ? (
                      <div
                        className="w-6 h-5 rounded-full border border-amber-500/60 overflow-hidden shrink-0 ml-1 bg-slate-900"
                        title={getItem(match.neutralItem).displayName}
                      >
                        <img
                          src={getItem(match.neutralItem).imageUrl}
                          alt={t('neutralItemAlt')}
                          className="w-full h-full object-cover"
                          onError={handleItemImageError}
                        />
                      </div>
                    ) : null}
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
