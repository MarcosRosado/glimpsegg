import React from 'react';
import { FileSearch, Loader2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';

export type ParseState = 'idle' | 'requesting' | 'waiting' | 'timeout' | 'error';

/**
 * Espera entre uma consulta e outra depois de pedir o parse: recuo crescente, ~5 min no
 * total. Consulta-se a PARTIDA (uma chamada cada), nao o job. Teto de proposito: replay
 * antigo pode nunca ser parseado, e consultar para sempre gastaria a cota do jogador.
 * (Morava no `ParsePendingBanner`, que a 2.0 trocou por este cartao.)
 */
export const PARSE_POLL_DELAYS_MS = [8000, 12000, 15000, 20000, 25000, 30000, 30000, 40000, 50000, 60000];

/**
 * O cartão grande do "modo placar" (docs/PROPOSTA-V2.md §3.4; decisão 2 do dono): a partida
 * sem análise é estado de primeira classe, não um aviso por cima da tela analisada.
 *
 * A lista diz o que o pedido LIBERA — só o que de fato aparece depois. Item que ainda não
 * existe na tela analisada não entra aqui, ou o cartão prometeria seção que não vem.
 */
const UNLOCKS: TranslationKey[] = ['parseUnlockMyGame', 'parseUnlockVision', 'parseUnlockCoaching', 'parseUnlockAdvantage'];

const STATE_TEXT: Record<Exclude<ParseState, 'idle'>, TranslationKey> = {
  requesting: 'parseRequesting',
  waiting: 'parseWaiting',
  timeout: 'parseTimeout',
  error: 'parseError',
};

export const ParseRequestCard: React.FC<{
  state: ParseState;
  onRequest: () => void;
  /** Lista do que a análise libera; Lutas e momento de virada entram quando existirem. */
  extraUnlocks?: TranslationKey[];
}> = ({ state, onRequest, extraUnlocks = [] }) => {
  const { t } = useLanguage();
  const busy = state === 'requesting' || state === 'waiting';
  const failed = state === 'timeout' || state === 'error';

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-[#0f1624] p-5 space-y-3" aria-labelledby="parse-card-title">
      <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
        <FileSearch className="w-3.5 h-3.5" aria-hidden />
        {t('parsePendingTitle')}
      </span>
      <h2 id="parse-card-title" className="text-lg font-bold text-slate-100">
        {t('parseCardTitle')}
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-300">
        {[...UNLOCKS, ...extraUnlocks].map((k) => (
          <li key={k} className="flex items-baseline gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 -translate-y-0.5" aria-hidden />
            {t(k)}
          </li>
        ))}
      </ul>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onRequest}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 shrink-0 rounded-lg bg-cyan-400 hover:bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
          {failed ? t('parseRetryButton') : t('parseRequestButton')}
        </button>
        {/* O estado da espera, numa linha ao lado do botão. Só depois do clique. Fala do que
            acontece com a partida, não de como: cota, recuo e fila são problema do app. */}
        {state !== 'idle' && (
          <span
            role="status"
            className={`inline-flex items-center gap-2 text-xs ${failed ? 'text-rose-300' : 'text-slate-400'}`}
          >
            {failed && <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />}
            {t(STATE_TEXT[state])}
          </span>
        )}
      </div>
    </section>
  );
};
