import React from 'react';
import { Swords, Skull, Flag } from 'lucide-react';
import { MatchDetails } from '../../types/dota';
import { summarizeFights, type FightSummary } from '../../utils/matchMetrics/fights';
import { formatMatchClock, formatGold } from '../../utils/dotaFormatters';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';
import { OBJECTIVE_LABEL } from './objectiveLabels';

/**
 * Aba "Lutas" (docs/PROPOSTA-V2.md §3.4): o que cada luta rendeu, lado a lado.
 *
 * DESCRITIVA de propósito. Não há "luta vencida" nem "luta convertida": nenhum limiar para
 * isso foi medido por taxa de disparo, e rótulo sem medida é o que a doutrina proíbe. A tela
 * mostra os números de cada lado (mortes, ouro, xp) e os objetivos que caíram até a luta
 * seguinte, com quantos segundos depois — quem lê tira a conclusão.
 *
 * Sem `availability.teamfights` a função devolve `null` e o App nem mostra a aba.
 */

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatGold(Math.abs(n))}`;

/** Quantos objetivos aparecem abertos; o resto fica num "+N", recolhido mas alcançável. */
const OPEN_OBJECTIVES = 3;

/**
 * Os objetivos até a luta seguinte. A janela vai até a PRÓXIMA luta, que pode vir 20 minutos
 * depois, e a lista então fica longa. O corte é por QUANTIDADE, não por distância: cortar por
 * distância diria "estes não têm a ver com a luta", e esse limiar nunca foi medido. Nada some —
 * o resto abre no clique, e cada linha diz a distância em mm:ss.
 */
const ObjectiveList: React.FC<{ items: FightSummary['objectivesAfter'] }> = ({ items }) => {
  const { t } = useLanguage();
  const row = (o: FightSummary['objectivesAfter'][number], i: number) => (
    <li key={i} className="flex items-center gap-1.5 text-[11px]">
      <Flag className={cn('w-3 h-3', o.objective.takenBy === 'RADIANT' ? 'text-emerald-400' : 'text-rose-400')} aria-hidden />
      <span className="text-slate-200">{t(OBJECTIVE_LABEL[o.objective.kind])}</span>
      <span className="text-slate-500">
        {t('fightsTakenBy', { team: o.objective.takenBy === 'RADIANT' ? t('radiant') : t('dire') })}
        {' · '}
        {o.secondsAfterEnd < 0
          ? t('fightsDuringFight')
          : t('fightsTimeAfter', { time: formatMatchClock(Math.round(o.secondsAfterEnd)) })}
      </span>
    </li>
  );
  const open = items.slice(0, OPEN_OBJECTIVES);
  const rest = items.slice(OPEN_OBJECTIVES);
  return (
    <div>
      <ul className="space-y-0.5">{open.map(row)}</ul>
      {rest.length > 0 && (
        <details className="mt-0.5">
          <summary className="cursor-pointer text-[11px] text-cyan-300/80 hover:text-cyan-200 select-none">
            {t('fightsMoreObjectives', { count: rest.length })}
          </summary>
          <ul className="space-y-0.5 mt-0.5">{rest.map((o, i) => row(o, i + OPEN_OBJECTIVES))}</ul>
        </details>
      )}
    </div>
  );
};

export const FightsTab: React.FC<{ match: MatchDetails; playerSlot: number }> = ({ match, playerSlot }) => {
  const { t, language } = useLanguage();
  const fights = summarizeFights(match, playerSlot);
  if (!fights) return null;

  return (
    <section className="glass-card rounded-2xl border border-slate-800 bg-[#0f1624] p-5 space-y-4" aria-labelledby="fights-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-cyan-400" aria-hidden />
          <h2 id="fights-title" className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {t('fightsTitle')}
          </h2>
        </div>
        <span className="text-[11px] text-slate-500" title={t('fightsSourceHint')}>
          {t('fightsCount', { count: fights.length })}
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{t('fightsExplain')}</p>

      {fights.length === 0 ? (
        <p className="text-xs text-slate-500">{t('fightsNone')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left">
                <th className="py-2 pr-3 font-semibold">#</th>
                <th className="py-2 pr-3 font-semibold">{t('fightsWhen')}</th>
                <th className="py-2 pr-3 font-semibold text-emerald-400">{t('radiant')}</th>
                <th className="py-2 pr-3 font-semibold text-rose-400">{t('dire')}</th>
                <th className="py-2 pr-3 font-semibold">{t('fightsYou')}</th>
                <th className="py-2 font-semibold">{t('fightsObjectivesAfter')}</th>
              </tr>
            </thead>
            <tbody>
              {fights.map((f) => (
                <tr key={f.index} className="border-t border-slate-800/80 align-top">
                  <td className="py-2.5 pr-3 text-slate-500">{f.index}</td>
                  <td className="py-2.5 pr-3 text-slate-300 whitespace-nowrap">
                    {formatMatchClock(f.start)}–{formatMatchClock(f.end)}
                  </td>
                  {[f.radiant, f.dire].map((side, i) => (
                    <td key={i} className="py-2.5 pr-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <Skull className="w-3 h-3 text-slate-500" aria-hidden />
                        <span title={t('fightsDeathsHint')}>{side.deaths}</span>
                        {side.buybacks > 0 && (
                          <span className="text-amber-300" title={t('fightsBuybacksHint')}>
                            · {t('fightsBuybacks', { count: side.buybacks })}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400" title={t('fightsGoldXpHint')}>
                        <span className={side.goldDelta >= 0 ? 'text-yellow-300' : 'text-rose-300'}>
                          {signed(side.goldDelta)}
                        </span>{' '}
                        {t('fightsGoldShort')} · {signed(side.xpDelta)} {t('fightsXpShort')}
                      </div>
                    </td>
                  ))}
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    {f.player ? (
                      <div className={cn('text-[11px]', f.player.deaths > 0 ? 'text-rose-300' : 'text-slate-300')}>
                        {f.player.deaths > 0 ? t('fightsYouDied') : t('fightsYouSurvived')}
                        <div className="text-[10px] text-slate-400">
                          {signed(f.player.goldDelta)} {t('fightsGoldShort')} · {f.player.damage.toLocaleString(language)} {t('fightsDamageShort')}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-600">{t('fightsYouAbsent')}</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {f.objectivesAfter.length === 0 ? (
                      <span className="text-[11px] text-slate-600">—</span>
                    ) : (
                      <ObjectiveList items={f.objectivesAfter} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
