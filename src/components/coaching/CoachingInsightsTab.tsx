import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Info, Lightbulb, Loader2, Package } from 'lucide-react';
import { CoachingInsight, MatchDetails, MatchPlayer } from '../../types/dota';
import { generateMatchInsights } from '../../utils/insights';
import { CATEGORY_LABEL, RULE_TEXT, SOURCE_LABEL } from '../../utils/insights/ruleText';
import { formatParams } from '../../utils/insights/formatParams';
import { RuleId } from '../../utils/insights/types';
import { getHero } from '../../constants/heroes';
import { getItem } from '../../constants/items';
import { useLanguage } from '../../context/LanguageContext';
import { useBuildAdvice } from '../../hooks/useBuildAdvice';
import { formatDuration } from '../../utils/dotaFormatters';
import { handleHeroImageError, handleItemImageError } from '../../utils/imageFallback';

interface CoachingInsightsTabProps {
  player: MatchPlayer;
  match: MatchDetails;
  apiKey?: string;
}

/** Chip de procedencia: diz de onde veio o numero, e com que amostra. */
const SourceChip: React.FC<{ insight: CoachingInsight }> = ({ insight }) => {
  const { t } = useLanguage();
  const isEstimate = insight.source === 'ROLE_BASELINE';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
        isEstimate
          ? 'text-slate-400 border-slate-700 bg-slate-900/60'
          : 'text-cyan-300/90 border-cyan-500/30 bg-cyan-950/40'
      }`}
      title={t(SOURCE_LABEL[insight.source])}
    >
      {t(SOURCE_LABEL[insight.source])}
      {insight.sampleSize ? ` · ${t('coachSampleSize', { n: insight.sampleSize })}` : ''}
    </span>
  );
};

const RefIcons: React.FC<{ insight: CoachingInsight }> = ({ insight }) => {
  if (!insight.heroRefs?.length && !insight.itemRefs?.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      {insight.itemRefs?.map((id) => {
        const item = getItem(id);
        return (
          <img
            key={`i-${id}`}
            src={item.imageUrl}
            alt={item.displayName}
            title={item.displayName}
            onError={handleItemImageError}
            className="w-8 h-6 rounded border border-slate-700 object-cover"
          />
        );
      })}
      {insight.heroRefs?.map((id) => {
        const hero = getHero(id);
        return (
          <img
            key={`h-${id}`}
            src={hero.iconUrl}
            alt={hero.displayName}
            title={hero.displayName}
            onError={handleHeroImageError}
            className="w-6 h-6 rounded-full border border-slate-700 object-cover"
          />
        );
      })}
    </div>
  );
};

const InsightCard: React.FC<{
  insight: CoachingInsight;
  kind: 'STRENGTH' | 'IMPROVEMENT';
  /** Frase de ranque ja traduzida, para o marcador {bracket} dos textos de build. */
  bracketLabel: string;
}> = ({ insight, kind, bracketLabel }) => {
  const { t, language } = useLanguage();
  const text = RULE_TEXT[insight.ruleId as RuleId];
  if (!text) return null;

  // Params CRUS -> formatados no locale certo, so aqui na borda de render.
  // `bracket` entra aqui e nao no motor de proposito: é texto traduzido, e o motor
  // emite so valores crus para poder ser testado sem locale.
  const params = { ...formatParams(insight.params, language), bracket: bracketLabel };
  const isStrength = kind === 'STRENGTH';

  const accent = isStrength
    ? { border: 'border-emerald-500/25', bg: 'bg-emerald-950/20', title: 'text-emerald-300', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
    : { border: 'border-amber-500/25', bg: 'bg-amber-950/20', title: 'text-amber-300', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };

  return (
    <div className={`glass-card rounded-xl p-4 border ${accent.border} ${accent.bg}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700">
              {t(CATEGORY_LABEL[insight.category])}
            </span>
            {insight.timestampSec !== undefined && insight.timestampSec > 0 && (
              <span className="text-[10px] font-mono text-slate-400">
                {formatDuration(insight.timestampSec)}
              </span>
            )}
            {insight.impact === 'HIGH' && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${accent.badge}`}>
                {insight.score}
              </span>
            )}
          </div>
          <h5 className={`text-sm font-bold ${accent.title}`}>{t(text.title, params)}</h5>
        </div>
        <RefIcons insight={insight} />
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">{t(text.body, params)}</p>

      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/80 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {text.stat && (
            <span className="text-[11px] font-mono font-bold text-slate-200">
              {t(text.stat, params)}
            </span>
          )}
          {text.bench && (
            <span className="text-[11px] font-mono text-slate-400">
              {t('coachBenchmarkLabel')}: {t(text.bench, params)}
            </span>
          )}
        </div>
        <SourceChip insight={insight} />
      </div>
    </div>
  );
};

export const CoachingInsightsTab: React.FC<CoachingInsightsTabProps> = ({
  player,
  match,
  apiKey,
}) => {
  const { t } = useLanguage();
  const hero = getHero(player.heroId);
  const build = useBuildAdvice(player, match, apiKey);
  const bracketLabel = build.bracketIsPlayerSpecific
    ? t('coachBracketYours')
    : t('coachBracketGeneric');

  // Antes o motor rodava solto no corpo do render, a cada re-render.
  const insights = useMemo(
    () => generateMatchInsights(player, match, { threat: build.threat, build: build.advice }),
    [player, match, build.threat, build.advice],
  );

  const isUnparsed = !match.availability?.parsed;

  return (
    <div className="space-y-6">
      {/* Cabecalho */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0c121e]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-wide">{t('coachingTitle')}</h3>
            <p className="text-xs text-slate-400">
              {t('coachingSubtitle')} • {hero.displayName} (
              {player.role.replace('POSITION_', 'Pos ')})
              {build.status === 'ready' && (
                <>
                  {' • '}
                  {build.bracketIsPlayerSpecific
                    ? t('coachBracketYours')
                    : t('coachBracketGeneric')}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Banner de partida nao parseada — diz o que NAO pode ser avaliado, em vez de
          preencher a lacuna com estimativa. */}
      {isUnparsed && (
        <div className="glass-card rounded-xl p-4 border border-slate-700/70 bg-slate-900/50 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-slate-200 mb-1">{t('coachUnparsedTitle')}</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">{t('coachUnparsedBody')}</p>
          </div>
        </div>
      )}

      {/* Estado dos dados de build */}
      {build.status !== 'ready' && !isUnparsed && (
        <div className="glass-card rounded-xl p-3 border border-slate-800 bg-slate-900/40 flex items-center gap-2">
          {build.status === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
          ) : (
            <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          <span className="text-[11px] text-slate-400">
            {build.status === 'loading' && t('coachBuildLoading')}
            {build.status === 'unavailable' && t('coachBuildUnavailable')}
            {build.status === 'error' && t('coachBuildError')}
            {build.status === 'idle' && t('coachBuildEmpty')}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pontos fortes */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {t('strengthsTitle')}
            </h4>
          </div>
          {insights.strengths.length === 0 ? (
            <div className="glass-card rounded-xl p-4 border border-slate-800 bg-slate-900/40">
              <p className="text-xs text-slate-400">{t('coachNoStrengths')}</p>
            </div>
          ) : (
            insights.strengths.map((insight) => (
              <InsightCard
                key={insight.ruleId}
                insight={insight}
                kind="STRENGTH"
                bracketLabel={bracketLabel}
              />
            ))
          )}
        </div>

        {/* Melhorias */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              {t('weaknessesTitle')}
            </h4>
          </div>
          {insights.improvements.length === 0 ? (
            <div className="glass-card rounded-xl p-4 border border-emerald-500/20 bg-emerald-950/20">
              <p className="text-xs text-emerald-300">{t('noMajorWeaknesses')}</p>
            </div>
          ) : (
            insights.improvements.map((insight) => (
              <InsightCard
                key={insight.ruleId}
                insight={insight}
                kind="IMPROVEMENT"
                bracketLabel={bracketLabel}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
