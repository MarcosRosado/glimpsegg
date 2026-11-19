import React, { useMemo, useState } from 'react';
import { Sparkles, User, Users } from 'lucide-react';
import { PlayerMatchSummary } from '../../types/dota';
import { RANK_NAMES, RANK_COLORS, getRankTierInfo, getBracketBadge } from '../../constants/ranks';
import { resolveMatchType } from '../../utils/dotaFormatters';
import { handleRankImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';
import { hasLaneVerdict, isLaneWin, isLaneLoss } from '../../utils/laneResult';

interface QueueRankCardProps {
  matches: PlayerMatchSummary[];
  /** Rank do proprio jogador, para destacar o tier dele na distribuicao. */
  seasonRank?: number;
  leaderboardRank?: number;
  /** Dá para trazer mais partidas: o "100" aparece e o clique pede a carga. */
  canLoadMore?: boolean;
  loadingMore?: boolean;
  loadMoreFailed?: boolean;
  onRequestMore?: () => void;
}

const VALVE_RANK_IMG_BASE = 'https://www.opendota.com/assets/images/dota2/rank_icons';

/**
 * "Fila e ranque", na seção Conta: winrate da janela (com o delta contra a janela anterior),
 * histórico de rota, rank médio das partidas, fila solo/grupo, não classificado e a
 * distribuição de medalhas.
 *
 * Era a metade `part="account"` do `TrendsCard` (antes `StratzTrendsCard`). A outra metade —
 * anel de posições, que a lista da OpenDota nunca alimentou (`role` vem `UNKNOWN`), e as barras
 * de Glint por partida — saiu do Início em 2026-11-19 e foi apagada com ela: o anel de heróis
 * do Início (`home/HeroShareCard`) e a linha de Glint do cartão de forma ocupam o lugar.
 */
export const QueueRankCard: React.FC<QueueRankCardProps> = ({
  matches,
  seasonRank,
  leaderboardRank,
  canLoadMore = false,
  loadingMore = false,
  loadMoreFailed = false,
  onRequestMore,
}) => {
  const { t } = useLanguage();
  const [range, setRange] = useState<25 | 100>(25);
  // A janela nunca passa do que foi carregado (a lista pode encolher ao trocar de conta).
  const effRange = range > 25 && matches.length < range ? 25 : range;
  const displayedMatches = useMemo(() => matches.slice(0, effRange), [matches, effRange]);

  /**
   * Placar de rota, so das partidas que TEM veredito real. `laneMeasured` é o denominador
   * honesto: sem ele o card mostrava 100% das partidas classificadas, incluindo as nao
   * parseadas. Hoje a lista nao traz veredito (Fase 6 do plano) e o KPI fica escondido.
   */
  const stats = useMemo(() => {
    const total = displayedMatches.length;
    const wins = displayedMatches.filter((m) => m.isVictory).length;
    let laneWon = 0;
    let laneEven = 0;
    let laneLost = 0;
    let laneMeasured = 0;
    displayedMatches.forEach((m) => {
      if (!hasLaneVerdict(m.laneResult)) return;
      laneMeasured++;
      if (isLaneWin(m.laneResult)) laneWon++;
      else if (isLaneLoss(m.laneResult)) laneLost++;
      else laneEven++;
    });
    return { total, winRate: total ? Math.round((wins / total) * 100) : 0, laneWon, laneEven, laneLost, laneMeasured };
  }, [displayedMatches]);

  const ranksList = [1, 2, 3, 4, 5, 6, 7, 8];

  /**
   * KPIs do rodape, calculados da janela real. Cada metrica carrega a propria
   * base: se nenhuma partida tem o dado, o valor e `null` e a UI escreve
   * "sem dado" em vez de exibir 0%.
   */
  const context = useMemo(() => {
    const withParty = displayedMatches.filter((m) => m.partySize !== null && m.partySize !== undefined);
    const withLobby = displayedMatches.filter((m) => resolveMatchType(m.gameMode, m.lobbyType) !== null);
    const withBracket = displayedMatches.filter((m) => typeof m.bracket === 'number');

    const soloShare = withParty.length
      ? Math.round((withParty.filter((m) => (m.partySize as number) === 1).length / withParty.length) * 100)
      : null;

    const unrankedShare = withLobby.length
      ? Math.round(
          (withLobby.filter((m) => resolveMatchType(m.gameMode, m.lobbyType) !== 'RANKED').length / withLobby.length) * 100,
        )
      : null;

    const avgBracket = withBracket.length
      ? Math.round(withBracket.reduce((sum, m) => sum + (m.bracket as number), 0) / withBracket.length)
      : null;

    const bracketCounts: Record<number, number> = {};
    withBracket.forEach((m) => {
      const tier = m.bracket as number;
      bracketCounts[tier] = (bracketCounts[tier] || 0) + 1;
    });

    // Delta de win rate contra a janela anterior de mesmo tamanho. Sem historico
    // suficiente nao ha delta — exibir "0%" afirmaria uma estabilidade que nao
    // foi medida.
    const size = displayedMatches.length;
    const previous = matches.slice(size, size * 2);
    const winRateDelta =
      size > 0 && previous.length === size
        ? Math.round((displayedMatches.filter((m) => m.isVictory).length / size) * 100) -
          Math.round((previous.filter((m) => m.isVictory).length / previous.length) * 100)
        : null;

    return {
      soloShare,
      groupShare: soloShare === null ? null : 100 - soloShare,
      unrankedShare,
      avgBracket,
      bracketCounts,
      maxBracketCount: Math.max(1, ...Object.values(bracketCounts)),
      hasBracketData: withBracket.length > 0,
      winRateDelta,
    };
  }, [displayedMatches, matches]);

  const playerTier = useMemo(
    () => (seasonRank ? getRankTierInfo(seasonRank, leaderboardRank).tier : null),
    [seasonRank, leaderboardRank],
  );
  const avgBracketBadge = useMemo(() => getBracketBadge(context.avgBracket), [context.avgBracket]);

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-xl bg-[#0b101a]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-black text-slate-100 tracking-wide flex items-center gap-2">
          <span>{t('queueRankTitle')}</span>
          <Sparkles className="w-4 h-4 text-cyan-400" />
        </h3>
        <div className="flex bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
          {/* "100" só quando há 100 partidas carregadas: senão o botão desenharia as mesmas. */}
          {([25, 100] as const).filter((r) => r === 25 || matches.length >= r || canLoadMore).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRange(r);
                if (matches.length < r) onRequestMore?.();
              }}
              aria-busy={r === 100 && loadingMore}
              className={`px-3 py-1 rounded transition ${
                effRange === r
                  ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              } ${r === 100 && loadingMore ? 'animate-pulse text-cyan-300' : ''}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {loadMoreFailed && <p role="alert" className="text-[11px] text-rose-300 mt-1">{t('trendLoadMoreError')}</p>}

      <div className="grid grid-cols-3 gap-x-3 gap-y-3 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
        <div>
          <div className="text-slate-500">{t('winRate')}</div>
          <div className="text-sm font-black text-white font-mono mt-0.5 flex items-baseline gap-1">
            {stats.winRate}%
            {context.winRateDelta !== null && context.winRateDelta !== 0 && (
              <span
                className={`text-[10px] font-bold ${
                  context.winRateDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {context.winRateDelta > 0 ? '↗' : '↘'}
                {Math.abs(context.winRateDelta)}
              </span>
            )}
          </div>
        </div>

        {/* Historico de rota: so com veredito real em alguma partida. O texto "nenhuma
            partida parseada" que ficava aqui passou a ser FALSO — na lista da OpenDota o
            veredito vem 'UNKNOWN' mesmo em partida parseada (a regra propria é a Fase 3
            do plano). Sem veredito, o KPI some. */}
        {stats.laneMeasured > 0 && (
          <div>
            <div className="text-slate-500">{t('laneHistory')}</div>
            <div className="text-sm font-black font-mono mt-0.5">
              <span className="text-emerald-400">{stats.laneWon}</span>
              <span className="text-slate-600">-</span>
              <span className="text-yellow-400">{stats.laneEven}</span>
              <span className="text-slate-600">-</span>
              <span className="text-rose-400">{stats.laneLost}</span>
            </div>
            <div className="text-[9px] text-slate-600 font-sans mt-0.5">
              {t('laneSampleOf', { measured: stats.laneMeasured, total: stats.total })}
            </div>
          </div>
        )}

        <div>
          <div className="text-slate-500">{t('matchAvgRank')}</div>
          <div className="text-xs font-bold font-mono mt-1 flex items-center gap-1.5">
            {avgBracketBadge ? (
              <>
                <img
                  src={avgBracketBadge.badgeUrl}
                  alt=""
                  className="w-4 h-4 object-contain"
                  onError={handleRankImageError}
                />
                <span className="text-slate-200">{avgBracketBadge.name}</span>
              </>
            ) : (
              <span className="text-slate-600 font-sans font-normal">{t('noData')}</span>
            )}
          </div>
        </div>

        {/* Sem dado, o KPI some (nao diz "sem dado"). */}
        {context.soloShare !== null && (
        <div>
          <div className="text-slate-500">{t('soloQueueShare')}</div>
          <div className="text-sm font-black text-white font-mono mt-0.5 flex items-center gap-1">
            <User className="w-3 h-3 text-slate-500" />
            {`${context.soloShare}%`}
          </div>
        </div>
        )}

        {/* Sem dado, o KPI some (nao diz "sem dado"). */}
        {context.groupShare !== null && (
        <div>
          <div className="text-slate-500">{t('groupQueueShare')}</div>
          <div className="text-sm font-black text-white font-mono mt-0.5 flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-500" />
            {`${context.groupShare}%`}
          </div>
        </div>
        )}

        {/* Sem dado, o KPI some (nao diz "sem dado"). */}
        {context.unrankedShare !== null && (
        <div>
          <div className="text-slate-500">{t('unrankedShare')}</div>
          <div className="text-sm font-black text-white font-mono mt-0.5">
            {`${context.unrankedShare}%`}
          </div>
        </div>
        )}
      </div>

      {/* ------------------------------------------- distribuicao de rank */}
      <div className="mt-3 pt-3 border-t border-slate-800/80">
        <div className="text-[11px] text-slate-500 mb-1.5">{t('rankDistribution')}</div>

        {!context.hasBracketData ? (
          <div className="text-[11px] text-slate-600 font-mono py-1.5">{t('rankDistributionEmpty')}</div>
        ) : (
          <div className="flex items-end justify-between gap-1 px-1">
            {ranksList.map((tier) => {
              const count = context.bracketCounts[tier] || 0;
              const isPlayerTier = playerTier === tier;
              const heightPercent = count > 0 ? Math.max(12, Math.round((count / context.maxBracketCount) * 100)) : 0;

              return (
                <div
                  key={tier}
                  className={`relative flex flex-col items-center gap-1 transition ${count > 0 ? '' : 'opacity-30'}`}
                  title={`${RANK_NAMES[tier]} — ${count} ${t('matches')}`}
                >
                  <div className="h-6 w-full flex items-end justify-center">
                    {count > 0 && (
                      <div
                        className="w-1.5 rounded-t-[2px]"
                        style={{ height: `${heightPercent}%`, backgroundColor: RANK_COLORS[tier] }}
                      />
                    )}
                  </div>

                  <img
                    src={`${VALVE_RANK_IMG_BASE}/rank_icon_${tier}.png`}
                    alt={RANK_NAMES[tier]}
                    className={`w-6 h-6 object-contain ${
                      isPlayerTier ? 'scale-110 rounded-full ring-2 ring-offset-1 ring-offset-[#0b101a]' : ''
                    }`}
                    style={isPlayerTier ? { ['--tw-ring-color' as string]: RANK_COLORS[tier] } : undefined}
                    onError={handleRankImageError}
                  />

                  <span
                    className="text-[9px] font-mono leading-none"
                    style={{ color: count > 0 ? RANK_COLORS[tier] : 'transparent' }}
                  >
                    {count > 0 ? count : '0'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
