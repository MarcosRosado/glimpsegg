import React from 'react';
import { MousePointerClick } from 'lucide-react';
import { MatchPlayer } from '../../types/dota';
import { activeItemUsage } from '../../utils/matchMetrics/itemUsage';
import { getItem } from '../../constants/items';
import { handleItemImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';

/** Quantos itens a lista mostra. Os demais costumam ser TP e consumível, que não dizem nada. */
const MAX_ROWS = 6;

/**
 * Uso de item ativo (§4 da proposta da 2.0), dentro do cartão de itens de "Meu jogo".
 *
 * Dois rótulos são obrigatórios e vêm de como a OpenDota conta:
 * - "usos registrados", não "ativações": trocar o atributo do Power Treads conta como uso;
 * - o ritmo é um PISO ("pelo menos N por 10 min"): sem hora de venda, a posse vai da compra
 *   ao fim da partida, então o divisor é um teto. Item recomprado ou sem compra registrada
 *   não tem ritmo (`ratePerTenMin` nulo) e mostra só a contagem.
 *
 * Versão descritiva: nenhum "usou pouco" — não há limiar medido.
 */
export const ItemUsageList: React.FC<{ player: MatchPlayer; durationSeconds: number }> = ({ player, durationSeconds }) => {
  const { t, language } = useLanguage();
  const usage = activeItemUsage(player, durationSeconds);
  if (!usage || usage.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-800">
      <div className="flex items-center gap-2 mb-2 cursor-help" title={t('itemUsageHint')}>
        <MousePointerClick className="w-3.5 h-3.5 text-cyan-400" aria-hidden />
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">{t('itemUsageTitle')}</span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {usage.slice(0, MAX_ROWS).map((u) => {
          const item = getItem(u.itemId);
          return (
            <li key={u.itemId} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
              <img
                src={item.imageUrl}
                alt=""
                className="w-9 h-6 rounded object-cover border border-slate-700 shrink-0"
                onError={handleItemImageError}
              />
              <div className="min-w-0 text-[11px] leading-tight">
                <div className="font-bold text-slate-200 truncate">{item.displayName}</div>
                <div className="text-slate-400 font-mono">
                  {t('itemUsageUses', { count: u.uses })}
                  {u.ratePerTenMin !== null && (
                    <>
                      {' · '}
                      {t('itemUsageRateFloor', {
                        rate: u.ratePerTenMin.toLocaleString(language, { maximumFractionDigits: 1 }),
                      })}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
