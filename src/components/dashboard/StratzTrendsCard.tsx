import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Crosshair, FlaskConical, Flame, Shield, Sparkles, Swords, User, Users } from 'lucide-react';
import { PlayerMatchSummary, Role } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { RANK_NAMES, RANK_COLORS, getRankTierInfo, getBracketBadge } from '../../constants/ranks';
import { resolveMatchType } from '../../utils/dotaFormatters';
import { handleHeroImageError, handleRankImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';
import { TranslationKey } from '../../i18n/translations';
import { hasLaneVerdict, isLaneWin, isLaneLoss } from '../../utils/laneResult';
import { formatImpMarked } from '../../utils/dotaFormatters';

interface StratzTrendsCardProps {
  matches: PlayerMatchSummary[];
  onSelectMatch?: (matchId: string) => void;
  /** Rank do proprio jogador, para destacar o tier dele na distribuicao. */
  seasonRank?: number;
  leaderboardRank?: number;
}

const VALVE_RANK_IMG_BASE = 'https://www.opendota.com/assets/images/dota2/rank_icons';

/** Cor da superficie do card. O "espaco" entre fatias e ela, nao uma borda. */
const SURFACE = '#0b101a';

const ROLE_ORDER: Role[] = ['POSITION_1', 'POSITION_2', 'POSITION_3', 'POSITION_4', 'POSITION_5'];

/**
 * Uma cor por posicao, nesta ordem.
 *
 * Nao sao escolhidas a olho: sao os cinco primeiros slots da paleta categorica
 * de referencia, nesta ordem, validados contra a superficie #0b101a com
 * `validate_palette.js --mode dark`. Passam banda de luminosidade, piso de
 * croma, separacao sob daltonismo (pior par adjacente ΔE 8.4) e contraste — e
 * passam tambem com a lista fechada em anel, porque num donut a Pos 5 volta a
 * encostar na Pos 1. Reordenar sem revalidar quebra a garantia.
 */
const ROLE_COLORS: Record<string, string> = {
  POSITION_1: '#3987e5',
  POSITION_2: '#d95926',
  POSITION_3: '#199e70',
  POSITION_4: '#c98500',
  POSITION_5: '#d55181',
};

const ROLE_LABEL: Record<string, TranslationKey> = {
  POSITION_1: 'pos1',
  POSITION_2: 'pos2',
  POSITION_3: 'pos3',
  POSITION_4: 'pos4',
  POSITION_5: 'pos5',
};

const ROLE_ICON: Record<string, React.ReactNode> = {
  POSITION_1: <Swords className="w-3.5 h-3.5" />,
  POSITION_2: <Crosshair className="w-3.5 h-3.5" />,
  POSITION_3: <Shield className="w-3.5 h-3.5" />,
  POSITION_4: <Flame className="w-3.5 h-3.5" />,
  POSITION_5: <FlaskConical className="w-3.5 h-3.5" />,
};

/** Mistura duas cores hex. Usado para derivar os degraus do anel de herois. */
function mixHex(from: string, to: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const ch = (a: number, b: number) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

/** O que o painel central esta mostrando no momento. */
type Focus =
  | { kind: 'hero'; role: string; heroId: number; name: string; avatarUrl: string; count: number; wins: number; avgImp: number }
  | { kind: 'role'; role: string; count: number; wins: number; avgImp: number }
  | null;

export const StratzTrendsCard: React.FC<StratzTrendsCardProps> = ({
  matches,
  onSelectMatch,
  seasonRank,
  leaderboardRank,
}) => {
  const { t } = useLanguage();
  const [range, setRange] = useState<25 | 100>(25);
  const [focus, setFocus] = useState<Focus>(null);
  const [barFocus, setBarFocus] = useState<PlayerMatchSummary | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 320, height: 300 });

  useLayoutEffect(() => {
    if (!chartContainerRef.current) return;
    const el = chartContainerRef.current;
    const updateDims = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setChartDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const displayedMatches = useMemo(() => matches.slice(0, range), [matches, range]);

  /** Agregados da janela, por posicao e por heroi dentro da posicao. */
  const stats = useMemo(() => {
    const total = displayedMatches.length;
    const wins = displayedMatches.filter((m) => m.isVictory).length;

    const roleMap: Record<string, { count: number; wins: number; impSum: number; heroes: Record<number, { count: number; wins: number; impSum: number }> }> = {};
    ROLE_ORDER.forEach((r) => {
      roleMap[r] = { count: 0, wins: 0, impSum: 0, heroes: {} };
    });

    // Placar de rota, so das partidas que TEM veredito real. Antes contava
    // `!m.isVictory && m.imp <= -8` como rota perdida — ou seja, o resultado do jogo
    // inteiro. `laneMeasured` é o denominador honesto: sem ele o card mostrava 100%
    // das partidas classificadas, incluindo as nao parseadas.
    let laneWon = 0;
    let laneEven = 0;
    let laneLost = 0;
    let laneMeasured = 0;

    displayedMatches.forEach((m) => {
      const role = roleMap[m.role] ? m.role : 'POSITION_1';
      const bucket = roleMap[role];
      bucket.count++;
      bucket.impSum += m.imp || 0;
      if (m.isVictory) bucket.wins++;

      if (!bucket.heroes[m.heroId]) bucket.heroes[m.heroId] = { count: 0, wins: 0, impSum: 0 };
      const hero = bucket.heroes[m.heroId];
      hero.count++;
      hero.impSum += m.imp || 0;
      if (m.isVictory) hero.wins++;

      if (hasLaneVerdict(m.laneResult)) {
        laneMeasured++;
        if (isLaneWin(m.laneResult)) laneWon++;
        else if (isLaneLoss(m.laneResult)) laneLost++;
        else laneEven++;
      }
    });

    return {
      total,
      wins,
      losses: total - wins,
      winRate: total ? Math.round((wins / total) * 100) : 0,
      roleMap,
      playedRoles: ROLE_ORDER.filter((r) => roleMap[r].count > 0),
      laneWon,
      laneEven,
      laneLost,
      laneMeasured,
    };
  }, [displayedMatches]);

  /**
   * Raios do donut. O buraco central e grande de proposito: e ele que abriga o
   * painel de detalhe que substituiu os tooltips flutuantes.
   */
  const geometry = useMemo(() => {
    const maxR = Math.min(chartDimensions.width, chartDimensions.height) / 2;
    const roleR0 = maxR * 0.44;
    const roleR1 = maxR * 0.6;
    const heroR0 = maxR * 0.66;
    const heroR1 = maxR * 0.92;
    return {
      maxR,
      roleR0,
      roleR1,
      heroR0,
      heroR1,
      roleMid: (roleR0 + roleR1) / 2,
      heroMid: (heroR0 + heroR1) / 2,
      holeDiameter: roleR0 * 2,
    };
  }, [chartDimensions]);

  /**
   * Posicao polar dos icones sobrepostos ao SVG. Precisa espelhar exatamente a
   * config do ECharts (startAngle 90, clockwise, sort null) ou os icones
   * descolam das fatias.
   *
   * `fits` e a correcao do bug visivel: a corda do arco no raio do icone tem de
   * comprimir o icone inteiro. Numa janela de 100 partidas um heroi de 1 jogo
   * ocupa 3,6° — antes o avatar era desenhado assim mesmo e invadia os
   * vizinhos.
   */
  const overlay = useMemo(() => {
    const roleNodes: Array<{ role: string; x: number; y: number; fits: boolean }> = [];
    const heroNodes: Array<{
      role: string;
      heroId: number;
      name: string;
      avatarUrl: string;
      count: number;
      wins: number;
      avgImp: number;
      x: number;
      y: number;
      size: number;
      fits: boolean;
    }> = [];

    const total = Math.max(1, stats.total);
    const maxAvatar = Math.max(18, Math.min(28, Math.round(geometry.heroR1 - geometry.heroR0 - 10)));
    let angle = 0;

    const chordAt = (radius: number, sweepDeg: number) =>
      2 * radius * Math.sin(((sweepDeg / 2) * Math.PI) / 180);

    stats.playedRoles.forEach((role) => {
      const bucket = stats.roleMap[role];
      const roleSweep = (bucket.count / total) * 360;
      const roleMidAngle = angle + roleSweep / 2;
      const roleRad = ((roleMidAngle - 90) * Math.PI) / 180;

      roleNodes.push({
        role,
        x: geometry.roleMid * Math.cos(roleRad),
        y: geometry.roleMid * Math.sin(roleRad),
        fits: chordAt(geometry.roleMid, roleSweep) >= 20,
      });

      Object.entries(bucket.heroes)
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([heroIdStr, h]) => {
          const heroId = parseInt(heroIdStr, 10);
          const hero = getHero(heroId);
          const heroSweep = (h.count / total) * 360;
          const heroMidAngle = angle + heroSweep / 2;
          angle += heroSweep;

          const rad = ((heroMidAngle - 90) * Math.PI) / 180;
          // Encolhe ate a corda do proprio arco, com folga de 3px de cada lado.
          const avatarSize = Math.min(maxAvatar, Math.floor(chordAt(geometry.heroMid, heroSweep) - 3));
          heroNodes.push({
            role,
            heroId,
            name: hero.displayName,
            avatarUrl: hero.avatarUrl,
            count: h.count,
            wins: h.wins,
            avgImp: Math.round(h.impSum / h.count),
            x: geometry.heroMid * Math.cos(rad),
            y: geometry.heroMid * Math.sin(rad),
            size: avatarSize,
            fits: avatarSize >= 14,
          });
        });
    });

    return { roleNodes, heroNodes };
  }, [stats, geometry]);

  /**
   * Config do sunburst.
   *
   * Duas decisoes deliberadas:
   * 1. `tooltip.show: false`. O ECharts tinha um tooltip proprio E os avatares
   *    tinham outro em HTML; os dois disparavam juntos e se sobrepunham. Agora
   *    existe um unico lugar onde o detalhe aparece: o centro do donut.
   * 2. O anel externo nao ganha cores novas. Cada heroi e um degrau da cor da
   *    propria posicao, entao o grafico nunca passa de cinco classes de cor.
   */
  const sunburstOption = useMemo(() => {
    // O vao entre fatias e a propria superficie. Com 100 partidas ha fatias de
    // 3,6°, e 2px de vao passam a competir com o dado — entao afina.
    const gap = stats.total > 40 ? 1 : 2;

    const data = stats.playedRoles.map((role) => {
      const bucket = stats.roleMap[role];
      const base = ROLE_COLORS[role];
      const heroesList = Object.entries(bucket.heroes).sort((a, b) => b[1].count - a[1].count);

      return {
        name: role,
        value: bucket.count,
        itemStyle: { color: base, borderColor: SURFACE, borderWidth: 2 },
        children: heroesList.map(([heroIdStr, h], i) => ({
          name: heroIdStr,
          value: h.count,
          itemStyle: {
            // Degraus da mesma matiz, do mais claro ao mais escuro.
            color: mixHex(base, SURFACE, 0.08 + (heroesList.length > 1 ? (i / (heroesList.length - 1)) * 0.3 : 0)),
            borderColor: SURFACE,
            borderWidth: gap,
          },
        })),
      };
    });

    return {
      tooltip: { show: false },
      series: {
        type: 'sunburst',
        nodeClick: false,
        selectedMode: false,
        data,
        sort: null,
        radius: [geometry.roleR0, geometry.heroR1],
        center: ['50%', '50%'],
        startAngle: 90,
        clockwise: true,
        label: { show: false },
        emphasis: { focus: 'none', itemStyle: { opacity: 1 } },
        blur: { itemStyle: { opacity: 0.35 } },
        levels: [
          {},
          { r0: geometry.roleR0, r: geometry.roleR1, label: { show: false } },
          { r0: geometry.heroR0, r: geometry.heroR1, label: { show: false } },
        ],
      },
    };
  }, [stats, geometry]);

  // A janela toda no equalizador, do mais antigo (esquerda) ao mais recente
  // (direita) — leitura temporal padrao.
  const equalizer = useMemo(() => [...displayedMatches].reverse(), [displayedMatches]);
  const dense = equalizer.length > 40;

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
      {/* ---------------------------------------------------------- cabecalho */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-black text-slate-100 tracking-wide flex items-center gap-2">
          <span>{t('trendsCardTitle')}</span>
          <Sparkles className="w-4 h-4 text-cyan-400" />
        </h3>

        <div className="flex bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
          {([25, 100] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded transition ${
                range === r
                  ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 mb-1">{t('positionShareHint')}</p>

      {/* ------------------------------------------------- donut + detalhe */}
      <div
        ref={chartContainerRef}
        className="relative w-full h-[300px] flex items-center justify-center select-none"
        onMouseLeave={() => setFocus(null)}
      >
        <ReactECharts
          option={sunburstOption}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}
          onEvents={{
            mouseover: (params: any) => {
              // Nivel 1 = posicao, nivel 2 = heroi. O `name` guarda a chave crua.
              if (params.treePathInfo && params.treePathInfo.length === 3) {
                const role = params.treePathInfo[1].name;
                const heroId = parseInt(params.name, 10);
                const h = stats.roleMap[role]?.heroes[heroId];
                if (!h) return;
                const hero = getHero(heroId);
                setFocus({
                  kind: 'hero',
                  role,
                  heroId,
                  name: hero.displayName,
                  avatarUrl: hero.avatarUrl,
                  count: h.count,
                  wins: h.wins,
                  avgImp: Math.round(h.impSum / h.count),
                });
              } else {
                const bucket = stats.roleMap[params.name];
                if (!bucket) return;
                setFocus({
                  kind: 'role',
                  role: params.name,
                  count: bucket.count,
                  wins: bucket.wins,
                  avgImp: Math.round(bucket.impSum / bucket.count),
                });
              }
            },
            globalout: () => setFocus(null),
          }}
        />

        {/* Icones de posicao no anel interno — omitidos onde o arco nao comporta */}
        {overlay.roleNodes
          .filter((n) => n.fits)
          .map((n) => (
            <div
              key={`role-${n.role}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 text-white/90 drop-shadow"
              style={{ left: `calc(50% + ${n.x}px)`, top: `calc(50% + ${n.y}px)` }}
            >
              {ROLE_ICON[n.role]}
            </div>
          ))}

        {/* Avatares no anel externo — idem. Sem tooltip proprio: alimentam o centro. */}
        {overlay.heroNodes
          .filter((n) => n.fits)
          .map((n) => (
            <div
              key={`hero-${n.role}-${n.heroId}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer"
              style={{ left: `calc(50% + ${n.x}px)`, top: `calc(50% + ${n.y}px)` }}
              onMouseEnter={() =>
                setFocus({
                  kind: 'hero',
                  role: n.role,
                  heroId: n.heroId,
                  name: n.name,
                  avatarUrl: n.avatarUrl,
                  count: n.count,
                  wins: n.wins,
                  avgImp: n.avgImp,
                })
              }
            >
              <img
                src={n.avatarUrl}
                alt={n.name}
                style={{ width: `${n.size}px`, height: `${n.size}px` }}
                className={`rounded-full object-cover transition-transform duration-150 ${
                  focus?.kind === 'hero' && focus.heroId === n.heroId ? 'scale-115' : ''
                }`}
                onError={handleHeroImageError}
              />
            </div>
          ))}

        {/* Painel central: um unico lugar para o detalhe, no vazio que ja existia */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center text-center z-30"
          style={{ width: geometry.holeDiameter * 0.86, height: geometry.holeDiameter * 0.86 }}
        >
          {focus === null ? (
            <>
              <div className="text-3xl font-black text-white leading-none">{stats.total}</div>
              <div className="text-[11px] text-slate-400 mt-1">{t('matches')}</div>
              <div className="mt-2 text-xs font-mono">
                <span className="text-emerald-400 font-bold">{stats.wins}</span>
                <span className="text-slate-600"> - </span>
                <span className="text-rose-400 font-bold">{stats.losses}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">{stats.winRate}%</div>
            </>
          ) : (
            <>
              {focus.kind === 'hero' ? (
                <img
                  src={focus.avatarUrl}
                  alt={focus.name}
                  className="w-9 h-9 rounded-full object-cover mb-1.5"
                  onError={handleHeroImageError}
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full mb-1.5 flex items-center justify-center text-white"
                  style={{ backgroundColor: ROLE_COLORS[focus.role] }}
                >
                  {ROLE_ICON[focus.role]}
                </div>
              )}

              <div className="text-[13px] font-bold text-white leading-tight px-1 truncate max-w-full">
                {focus.kind === 'hero' ? focus.name : t(ROLE_LABEL[focus.role])}
              </div>

              {focus.kind === 'hero' && (
                <div className="text-[10px] mt-0.5" style={{ color: ROLE_COLORS[focus.role] }}>
                  {t(ROLE_LABEL[focus.role])}
                </div>
              )}

              <div className="mt-1.5 text-xs font-mono">
                <span className="text-emerald-400 font-bold">{focus.wins}</span>
                <span className="text-slate-600"> - </span>
                <span className="text-rose-400 font-bold">{focus.count - focus.wins}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {Math.round((focus.wins / focus.count) * 100)}% · {formatImpMarked(focus.avgImp)} IMP
              </div>
            </>
          )}
        </div>
      </div>

      {/* ------------------- legenda das posicoes, com os valores impressos ---
          Nao e enfeite: e o que permite ler os numeros sem depender do hover. */}
      <div className="space-y-1 mb-1">
        {stats.playedRoles.map((role) => {
          const bucket = stats.roleMap[role];
          const isFocused = focus?.role === role;
          const avgImp = Math.round(bucket.impSum / bucket.count);

          return (
            <div
              key={role}
              onMouseEnter={() =>
                setFocus({ kind: 'role', role, count: bucket.count, wins: bucket.wins, avgImp })
              }
              onMouseLeave={() => setFocus(null)}
              className={`flex items-center gap-2 px-1.5 py-1 rounded-md text-[11px] cursor-default transition ${
                isFocused ? 'bg-slate-800/60' : ''
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: ROLE_COLORS[role] }}
              />
              <span className="text-slate-300 font-medium truncate flex-1">{t(ROLE_LABEL[role])}</span>
              <span className="text-slate-500 font-mono">{bucket.count}</span>
              <span className="font-mono w-12 text-right">
                <span className="text-emerald-400">{bucket.wins}</span>
                <span className="text-slate-600">-</span>
                <span className="text-rose-400">{bucket.count - bucket.wins}</span>
              </span>
              <span
                className={`font-mono w-9 text-right ${avgImp >= 0 ? 'text-slate-300' : 'text-slate-500'}`}
              >
                {formatImpMarked(avgImp)}
              </span>
            </div>
          );
        })}
      </div>

      {/* --------------------------------------------------- equalizador IMP */}
      <div className="mt-3 pt-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
          <span>{t('impPerMatch')}</span>
          <span className="font-mono text-slate-600">{t('oldestToNewest')}</span>
        </div>

        <div className="relative h-16 px-1">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-800 z-0" />

          <div
            className="grid h-full items-center relative z-10"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, equalizer.length)}, minmax(0, 1fr))`,
              gap: dense ? '1px' : '3px',
            }}
          >
            {equalizer.map((m, idx) => {
              const imp = m.imp || 0;
              const isPositive = imp >= 0;
              const magnitude = Math.min(50, Math.abs(imp)) / 50;
              const heightPercent = Math.max(6, Math.round(magnitude * 100)) * 0.46;
              const isFocused = barFocus?.matchId === m.matchId;

              return (
                <div
                  key={m.matchId || idx}
                  onClick={() => onSelectMatch && onSelectMatch(m.matchId)}
                  onMouseEnter={() => setBarFocus(m)}
                  onMouseLeave={() => setBarFocus(null)}
                  className="relative h-full flex items-center justify-center cursor-pointer"
                >
                  {/* Alvo de hover maior que a barra — a barra tem 1-6px */}
                  <span className="absolute inset-y-0 -inset-x-0.5" />
                  <div
                    className={`absolute rounded-[1px] transition-colors ${
                      dense ? 'w-1' : 'w-1.5'
                    } ${isPositive ? 'bottom-1/2' : 'top-1/2'} ${
                      isFocused
                        ? 'bg-cyan-300'
                        : isPositive
                        ? 'bg-slate-300'
                        : 'bg-slate-600'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Vitoria / derrota, alinhado coluna a coluna com as barras */}
        <div
          className="grid px-1 mt-1"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, equalizer.length)}, minmax(0, 1fr))`,
            gap: dense ? '1px' : '3px',
          }}
        >
          {equalizer.map((m, idx) => (
            <div
              key={m.matchId || idx}
              onClick={() => onSelectMatch && onSelectMatch(m.matchId)}
              onMouseEnter={() => setBarFocus(m)}
              onMouseLeave={() => setBarFocus(null)}
              className="h-2 flex items-center justify-center cursor-pointer"
            >
              <span
                className={`rounded-full ${dense ? 'h-1 w-1' : 'h-1.5 w-1.5'} ${
                  m.isVictory ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Linha de inspecao de altura fixa: substitui o tooltip flutuante e
            nao empurra o layout ao aparecer. */}
        <div className="h-8 mt-1.5 flex items-center text-[11px] font-mono">
          {barFocus ? (
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={getHero(barFocus.heroId).avatarUrl}
                alt=""
                className="w-8 h-5 rounded object-cover shrink-0"
                onError={handleHeroImageError}
              />
              <span className="text-slate-200 font-sans font-bold truncate">
                {getHero(barFocus.heroId).displayName}
              </span>
              <span className={barFocus.isVictory ? 'text-emerald-400' : 'text-rose-400'}>
                {barFocus.isVictory ? t('win') : t('loss')}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300">{formatImpMarked(barFocus.imp || 0)} IMP</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">
                {barFocus.kills}/{barFocus.deaths}/{barFocus.assists}
              </span>
            </div>
          ) : (
            <span className="text-slate-600">{t('hoverBarHint')}</span>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------------- KPIs */}
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

        <div>
          <div className="text-slate-500">{t('laneHistory')}</div>
          {stats.laneMeasured > 0 ? (
            <>
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
            </>
          ) : (
            <div className="text-xs text-slate-600 font-sans mt-1">{t('laneNoParsedMatches')}</div>
          )}
        </div>

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

        <div>
          <div className="text-slate-500">{t('soloQueueShare')}</div>
          <div className="text-sm font-black text-white font-mono mt-0.5 flex items-center gap-1">
            <User className="w-3 h-3 text-slate-500" />
            {context.soloShare === null ? (
              <span className="text-slate-600 text-[11px] font-sans font-normal">{t('noData')}</span>
            ) : (
              `${context.soloShare}%`
            )}
          </div>
        </div>

        <div>
          <div className="text-slate-500">{t('groupQueueShare')}</div>
          <div className="text-sm font-black text-white font-mono mt-0.5 flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-500" />
            {context.groupShare === null ? (
              <span className="text-slate-600 text-[11px] font-sans font-normal">{t('noData')}</span>
            ) : (
              `${context.groupShare}%`
            )}
          </div>
        </div>

        <div>
          <div className="text-slate-500">{t('unrankedShare')}</div>
          <div className="text-sm font-black text-white font-mono mt-0.5">
            {context.unrankedShare === null ? (
              <span className="text-slate-600 text-[11px] font-sans font-normal">{t('noData')}</span>
            ) : (
              `${context.unrankedShare}%`
            )}
          </div>
        </div>
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
