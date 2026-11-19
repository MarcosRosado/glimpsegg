import React, { useMemo, useState } from 'react';
import { PieChart } from 'lucide-react';
import type { PlayerMatchSummary } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { handleHeroImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';
import { formatGlint } from '../../utils/glint';
import { summarizeHeroShare, winRateTilt, HERO_SHARE_MIN_SAMPLE, type HeroShareSlice } from '../../utils/heroShare';
import { useGlintHint } from '../ui/GlintBadge';

/**
 * Escala divergente do winrate: dois polos e um cinza no meio (nunca um matiz no centro).
 * Polos e neutro são as cores de vitória/derrota que o app já usa em toda lista, e o neutro
 * passa de 3:1 contra a superfície do card. Quem diz QUAL herói é o retrato e a legenda — a cor
 * não identifica, então trocar a janela não "repinta" ninguém por posição no ranking.
 */
const NEUTRAL = '#64748b';
const WIN_POLE = '#10b981';
const LOSS_POLE = '#f43f5e';
/** Superfície do card: o vão entre fatias é ela, não uma borda. */
const SURFACE = '#0b101a';

function mixHex(from: string, to: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(from), p(to)];
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const sliceColor = (s: HeroShareSlice) => {
  const tilt = winRateTilt(s);
  if (tilt === null) return NEUTRAL;
  return mixHex(NEUTRAL, tilt >= 0 ? WIN_POLE : LOSS_POLE, Math.abs(tilt));
};

const SIZE = 220;
const C = SIZE / 2;
const R_OUT = 100;
const R_IN = 70;
/** Retrato só em fatia que comporta um: abaixo disto a fatia é estreita demais. */
const MIN_PORTRAIT_DEG = 24;

const polar = (r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
};

function arcPath(start: number, end: number): string {
  // Fatia única: dois semicírculos, porque um arco de 360° não desenha.
  if (end - start >= 359.999) {
    return [
      `M ${C} ${C - R_OUT}`, `A ${R_OUT} ${R_OUT} 0 1 1 ${C} ${C + R_OUT}`, `A ${R_OUT} ${R_OUT} 0 1 1 ${C} ${C - R_OUT}`,
      `M ${C} ${C - R_IN}`, `A ${R_IN} ${R_IN} 0 1 0 ${C} ${C + R_IN}`, `A ${R_IN} ${R_IN} 0 1 0 ${C} ${C - R_IN}`, 'Z',
    ].join(' ');
  }
  const large = end - start > 180 ? 1 : 0;
  const [x1, y1] = polar(R_OUT, start);
  const [x2, y2] = polar(R_OUT, end);
  const [x3, y3] = polar(R_IN, end);
  const [x4, y4] = polar(R_IN, start);
  return `M ${x1} ${y1} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${R_IN} ${R_IN} 0 ${large} 0 ${x4} ${y4} Z`;
}

type Range = 25 | 100;

/**
 * "Distribuição" do Início: os heróis das últimas 25 (ou 100) partidas num anel, com a cor
 * dizendo o winrate de cada um. Volta o anel lateral da 1.0 com outra leitura: lá ele dividia por
 * POSIÇÃO, que a lista da OpenDota não traz (`role` é `UNKNOWN`) — e agrupar por rota sob rótulo
 * de posição seria inventar. Aqui a fatia é o herói, que a lista traz em toda partida.
 *
 * O centro mostra o total; passar o mouse (ou focar) uma fatia ou uma linha da legenda troca o
 * centro pelos números daquele herói. O clique abre Partidas filtrada pelo herói.
 */
export const HeroShareCard: React.FC<{
  matches: PlayerMatchSummary[];
  canLoadMore: boolean;
  onRequestMore: () => void;
  onOpenHeroMatches: (heroId: number) => void;
}> = ({ matches, canLoadMore, onRequestMore, onOpenHeroMatches }) => {
  const { t, language } = useLanguage();
  const glintHint = useGlintHint();
  const [rangeChoice, setRangeChoice] = useState<Range>(25);
  const [focus, setFocus] = useState<number | null>(null);
  // Janela de 100 pedida e ainda não carregada: fica nas 25 (nunca desenha 40 sob o "100").
  // Conta com menos de 100 partidas: a janela é o que existe, e o subtítulo diz quantas.
  const range: Range = rangeChoice === 100 && canLoadMore ? 25 : rangeChoice;
  const windowMatches = useMemo(() => matches.slice(0, range), [matches, range]);
  const share = useMemo(() => summarizeHeroShare(windowMatches), [windowMatches]);

  if (share.total === 0) return null;

  const pct = (n: number, d: number) => Math.round((n / d) * 100).toLocaleString(language);
  let angle = 0;
  const arcs = share.slices.map((s, i) => {
    const sweep = (s.count / share.total) * 360;
    const a = { slice: s, index: i, start: angle, end: angle + sweep };
    angle += sweep;
    return a;
  });
  const focused = focus !== null ? share.slices[focus] : null;
  const hasAnyGlint = share.slices.some((s) => s.glintCount > 0);
  const showMore = matches.length > 25 || canLoadMore;

  const sliceLabel = (s: HeroShareSlice) =>
    s.heroId === null ? t('heroShareOther', { n: s.heroCount }) : getHero(s.heroId).displayName;
  const sliceHint = (s: HeroShareSlice) =>
    `${sliceLabel(s)} · ${t('heroShareSliceHint', { count: s.count, wins: s.wins, losses: s.count - s.wins })}`;
  const open = (s: HeroShareSlice) => {
    if (s.heroId !== null) onOpenHeroMatches(s.heroId);
  };

  return (
    <section className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-lg bg-[#0b101a]" aria-labelledby="hero-share-title">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 id="hero-share-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-200">
          <PieChart className="w-4 h-4 text-cyan-400" aria-hidden />
          {t('heroShareTitle')}
        </h2>
        {showMore && (
          <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            {([25, 100] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRangeChoice(r);
                  if (r === 100 && matches.length < 100) onRequestMore();
                }}
                className={cn('px-2 py-0.5 rounded transition', range === r ? 'bg-slate-700 text-cyan-200 font-bold' : 'text-slate-400 hover:text-slate-200')}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-500 mb-3 cursor-help" title={t('heroShareColorHint', { n: HERO_SHARE_MIN_SAMPLE })}>
        {t('heroShareSubtitle', { n: share.total })}
      </p>

      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={t('heroShareTitle')}>
          {arcs.map((a) => (
            <path
              key={a.slice.heroId ?? 'other'}
              d={arcPath(a.start, a.end)}
              fill={sliceColor(a.slice)}
              fillRule="evenodd"
              stroke={SURFACE}
              strokeWidth={2}
              opacity={focus === null || focus === a.index ? 1 : 0.35}
              className={cn('transition-opacity', a.slice.heroId !== null && 'cursor-pointer')}
              onMouseEnter={() => setFocus(a.index)}
              onMouseLeave={() => setFocus(null)}
              onClick={() => open(a.slice)}
            >
              <title>{sliceHint(a.slice)}</title>
            </path>
          ))}
          {arcs
            .filter((a) => a.slice.heroId !== null && a.end - a.start >= MIN_PORTRAIT_DEG)
            .map((a) => {
              const [x, y] = polar((R_OUT + R_IN) / 2, (a.start + a.end) / 2);
              const hero = getHero(a.slice.heroId as number);
              return (
                <g key={`p${a.slice.heroId}`} pointerEvents="none" opacity={focus === null || focus === a.index ? 1 : 0.35}>
                  <clipPath id={`hs-clip-${a.slice.heroId}`}>
                    <circle cx={x} cy={y} r={11} />
                  </clipPath>
                  <circle cx={x} cy={y} r={12.5} fill={SURFACE} />
                  <image
                    href={hero.iconUrl ?? hero.avatarUrl}
                    x={x - 11}
                    y={y - 11}
                    width={22}
                    height={22}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#hs-clip-${a.slice.heroId})`}
                  />
                </g>
              );
            })}
        </svg>

        {/* Centro: o total, ou o herói em foco. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-12">
          {focused ? (
            <>
              <div className="text-xs font-bold text-slate-100 leading-tight line-clamp-2">{sliceLabel(focused)}</div>
              <div className="text-2xl font-black text-white mt-0.5 tabular-nums">{focused.count}</div>
              <div className="text-[11px] font-mono">
                <span className="text-emerald-400">{focused.wins}</span>
                <span className="text-slate-600"> - </span>
                <span className="text-rose-400">{focused.count - focused.wins}</span>
                <span className="text-slate-400"> ({pct(focused.wins, focused.count)}%)</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl font-black text-white tabular-nums">{share.total}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('matches')}</div>
              <div className="text-[11px] font-mono mt-0.5">
                <span className="text-emerald-400">{share.wins}</span>
                <span className="text-slate-600"> - </span>
                <span className="text-rose-400">{share.total - share.wins}</span>
                <span className="text-slate-400"> ({pct(share.wins, share.total)}%)</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legenda em lista: o número exato de cada fatia (o anel só dá a proporção). */}
      <div className="mt-4 flex items-center gap-2.5 px-2 pb-1 text-[9px] uppercase tracking-wider text-slate-500" aria-hidden>
        <span className="flex-1">{t('heroesColHero')}</span>
        <span className="w-6 text-right">#</span>
        <span className="w-12 text-right whitespace-nowrap">{t('heroesColWinRate')}</span>
        <span className="w-9 text-right hidden sm:inline">{t('kda')}</span>
        {hasAnyGlint && (
          <span className="w-7 text-right hidden sm:inline cursor-help" title={glintHint}>
            {t('glint')}
            <sup className="ml-0.5 text-[7px]">{t('glintBeta')}</sup>
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {share.slices.map((s, i) => {
          const hero = s.heroId !== null ? getHero(s.heroId) : null;
          const kda = (s.kills + s.assists) / Math.max(1, s.deaths);
          const avgGlint = s.glintCount > 0 ? Math.round(s.glintSum / s.glintCount) : null;
          return (
            <li key={s.heroId ?? 'other'}>
              <button
                type="button"
                disabled={s.heroId === null}
                onMouseEnter={() => setFocus(i)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(i)}
                onBlur={() => setFocus(null)}
                onClick={() => open(s)}
                title={s.heroId !== null ? t('heroesOpenMatches', { hero: sliceLabel(s) }) : undefined}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-lg px-2 py-1 text-left text-xs transition',
                  focus === i ? 'bg-slate-800/70' : 'hover:bg-slate-800/40',
                  s.heroId === null && 'cursor-default',
                )}
              >
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: sliceColor(s) }} aria-hidden />
                {hero ? (
                  <img src={hero.avatarUrl} alt="" className="w-8 h-[18px] rounded object-cover shrink-0" onError={handleHeroImageError} />
                ) : (
                  <span className="w-8 shrink-0" />
                )}
                <span className="flex-1 min-w-0 truncate text-slate-200 font-semibold">{sliceLabel(s)}</span>
                <span className="font-mono text-slate-300 tabular-nums w-6 text-right">{s.count}</span>
                <span
                  className={cn(
                    'font-mono tabular-nums w-12 text-right',
                    s.count < HERO_SHARE_MIN_SAMPLE ? 'text-slate-500' : s.wins * 2 >= s.count ? 'text-emerald-400' : 'text-rose-400',
                  )}
                >
                  {pct(s.wins, s.count)}%
                </span>
                <span className="font-mono text-teal-300/90 tabular-nums w-9 text-right hidden sm:inline" title={t('heroesKdaHint')}>
                  {kda.toLocaleString(language, { maximumFractionDigits: 1 })}
                </span>
                {/* A coluna existe se algum herói tem nota; quem não tem fica com a célula vazia. */}
                {hasAnyGlint && (
                  <span
                    className="font-mono text-amber-300/90 tabular-nums w-7 text-right hidden sm:inline"
                    title={avgGlint !== null ? `${t('glintSampled', { count: s.glintCount })}. ${glintHint}` : undefined}
                  >
                    {avgGlint !== null ? formatGlint(avgGlint) : ''}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
