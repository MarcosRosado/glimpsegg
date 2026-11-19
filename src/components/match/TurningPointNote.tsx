import React from 'react';
import { TrendingUp } from 'lucide-react';
import { MatchDetails } from '../../types/dota';
import { turningPoint, TURNING_POINT_MODEL } from '../../utils/matchMetrics/turningPoint';
import { formatGold } from '../../utils/dotaFormatters';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Momento de virada, acima da linha de vantagem do Resumo (docs/PROPOSTA-V2.md §3.4).
 *
 * O nome "virada" só aparece com `isComeback`: o vencedor esteve atrás por pelo menos o piso
 * medido (`TURNING_POINT_MODEL.minDeficit`, que dispara em ~10% das partidas). Abaixo do piso
 * a tela mostra o maior déficit do vencedor, sem chamar de virada. Vencedor que nunca esteve
 * atrás: `null`, e a nota some.
 */
export const TurningPointNote: React.FC<{ match: MatchDetails }> = ({ match }) => {
  const { t, language } = useLanguage();
  const tp = turningPoint(match.advantageTimeline, match.didRadiantWin);
  if (!tp) return null;

  const winner = match.didRadiantWin ? t('radiant') : t('dire');
  const hint = t('turningPointHint', {
    floor: formatGold(TURNING_POINT_MODEL.minDeficit, language),
    rate: (TURNING_POINT_MODEL.measuredRate * 100).toLocaleString(language, { maximumFractionDigits: 0 }),
    matches: TURNING_POINT_MODEL.matches,
  });

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-help ${
        tp.isComeback ? 'border-purple-500/40 bg-purple-500/10' : 'border-slate-800 bg-[#0f1624]'
      }`}
      title={hint}
    >
      <TrendingUp className={`w-4 h-4 mt-0.5 shrink-0 ${tp.isComeback ? 'text-purple-300' : 'text-slate-400'}`} aria-hidden />
      <div className="text-xs leading-relaxed">
        {tp.isComeback && (
          <div className="text-sm font-bold text-purple-200">{t('turningPointTitle')}</div>
        )}
        <div className="text-slate-300">
          {t('turningPointDeficit', {
            team: winner,
            gold: formatGold(tp.maxDeficit, language),
            minute: tp.maxDeficitMinute,
          })}
          {tp.leadForGoodFromMinute !== null && (
            <> {t('turningPointLeadFrom', { minute: tp.leadForGoodFromMinute })}</>
          )}
        </div>
      </div>
    </div>
  );
};
