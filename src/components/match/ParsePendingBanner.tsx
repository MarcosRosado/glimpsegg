import React from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';

export type ParseState = 'idle' | 'requesting' | 'waiting' | 'timeout' | 'error';

/**
 * Espera entre uma consulta e outra depois de pedir o parse: recuo crescente, ~5 min no
 * total. Consulta-se a PARTIDA (uma chamada cada), nao o job. Teto de proposito: replay
 * antigo pode nunca ser parseado, e consultar para sempre gastaria a cota do jogador.
 */
export const PARSE_POLL_DELAYS_MS = [8000, 12000, 15000, 20000, 25000, 30000, 30000, 40000, 50000, 60000];

const STATE_TEXT: Record<Exclude<ParseState, 'idle'>, TranslationKey> = {
  requesting: 'parseRequesting',
  waiting: 'parseWaiting',
  timeout: 'parseTimeout',
  error: 'parseError',
};

/**
 * Aviso de partida nao parseada, com a acao que traz o dado. Sem a STRATZ, que parseava
 * sozinha, este é o estado em que a maioria das partidas publicas abre.
 *
 * O pedido so sai no clique: cada um conta como 10 chamadas no limite da OpenDota.
 */
export const ParsePendingBanner: React.FC<{
  state: ParseState;
  onRequest: () => void;
}> = ({ state, onRequest }) => {
  const { t } = useLanguage();
  const busy = state === 'requesting' || state === 'waiting';
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <FileSearch className="w-5 h-5 text-amber-300 shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-amber-200">{t('parsePendingTitle')}</div>
        <div className="text-xs text-amber-100/80 mt-0.5">
          {state === 'idle' ? t('parsePendingBody') : t(STATE_TEXT[state])}
        </div>
      </div>
      <button
        type="button"
        onClick={onRequest}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 shrink-0 rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-400/25 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
        <span>{t('parseRequestButton')}</span>
      </button>
    </div>
  );
};
