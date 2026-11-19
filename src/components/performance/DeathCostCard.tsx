import React from 'react';
import { Skull } from 'lucide-react';
import { MatchDetails } from '../../types/dota';
import { playerDeathCosts } from '../../utils/matchMetrics/deathCost';
import { formatMatchClock } from '../../utils/dotaFormatters';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';
import { OBJECTIVE_LABEL } from '../match/objectiveLabels';

/**
 * "Tempo morto no pior momento" (§4 da proposta da 2.0): as mortes do jogador em que o time
 * PERDEU objetivo enquanto ele estava fora, com a pior em destaque.
 *
 * Só as mortes que custaram objetivo entram. Sem nenhuma (`worst === null`) não existe "pior
 * momento", e o cartão some em vez de dizer "nenhuma morte custou nada" — isso a partida não
 * mediu: ela só não tem objetivo perdido nessas janelas. A janela vai até o respawn, cortada
 * no buyback; `untilMatchEnd` marca a morte cujo respawn o parser não viu.
 */
export const DeathCostCard: React.FC<{ match: MatchDetails; playerSlot: number }> = ({ match, playerSlot }) => {
  const { t } = useLanguage();
  const costs = playerDeathCosts(match, playerSlot);
  if (!costs || costs.worst === null) return null;

  const costly = costs.deaths
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.objectivesLost.length > 0);

  return (
    <section className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0b101a] shadow-xl space-y-3">
      <div className="flex items-center gap-2" title={t('deathCostHint')}>
        <Skull className="w-4 h-4 text-rose-400" aria-hidden />
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 cursor-help">{t('deathCostTitle')}</h4>
      </div>
      <ul className="space-y-2">
        {costly.map(({ d, i }) => (
          <li
            key={i}
            className={cn(
              'rounded-xl border px-3 py-2 text-xs',
              i === costs.worst ? 'border-rose-500/40 bg-rose-500/10' : 'border-slate-800 bg-slate-900/60',
            )}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono">
              <span className="font-bold text-slate-100">{formatMatchClock(d.time)}</span>
              <span className="text-slate-400">
                {d.untilMatchEnd ? t('deathCostUntilEnd') : t('deathCostSecondsOut', { s: Math.round(d.secondsOut) })}
              </span>
              {d.boughtBack && <span className="text-amber-300">{t('deathCostBoughtBack')}</span>}
              {i === costs.worst && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-rose-300">
                  {t('deathCostWorst')}
                </span>
              )}
            </div>
            <div className="mt-1 text-slate-300">
              {t('deathCostLost')}{' '}
              {d.objectivesLost.map((o) => t(OBJECTIVE_LABEL[o.kind])).join(', ')}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
