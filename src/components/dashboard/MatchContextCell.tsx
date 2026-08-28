import React from 'react';
import { User, Users } from 'lucide-react';
import { getBracketBadge } from '../../constants/ranks';
import { resolveMatchType, MatchTypeCode } from '../../utils/dotaFormatters';
import { handleRankImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';
import { TranslationKey } from '../../i18n/translations';

interface MatchContextCellProps {
  bracket?: number | null;
  partySize?: number | null;
  gameMode?: string;
  lobbyType?: string;
}

/**
 * Chaves explicitas em vez de `matchTypeShort${code}` montado em runtime: o
 * portao de paridade do i18n so pega chave faltando se ela existir no tipo.
 */
const SHORT_LABEL: Record<MatchTypeCode, TranslationKey> = {
  RANKED: 'matchTypeShortRANKED',
  UNRANKED: 'matchTypeShortUNRANKED',
  TURBO: 'matchTypeShortTURBO',
  TOURNAMENT: 'matchTypeShortTOURNAMENT',
  BATTLE_CUP: 'matchTypeShortBATTLE_CUP',
  BOTS: 'matchTypeShortBOTS',
  EVENT: 'matchTypeShortEVENT',
};

const FULL_LABEL: Record<MatchTypeCode, TranslationKey> = {
  RANKED: 'matchTypeRANKED',
  UNRANKED: 'matchTypeUNRANKED',
  TURBO: 'matchTypeTURBO',
  TOURNAMENT: 'matchTypeTOURNAMENT',
  BATTLE_CUP: 'matchTypeBATTLE_CUP',
  BOTS: 'matchTypeBOTS',
  EVENT: 'matchTypeEVENT',
};

const CHIP_STYLE: Record<MatchTypeCode, string> = {
  RANKED: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  UNRANKED: 'bg-slate-500/15 text-slate-400 border-slate-600/40',
  TURBO: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  TOURNAMENT: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  BATTLE_CUP: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  BOTS: 'bg-slate-500/15 text-slate-500 border-slate-700/40',
  EVENT: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

/**
 * Coluna compacta com o contexto da partida: rank medio, tamanho do grupo e
 * tipo de fila. Cada pedaco some quando o dado nao existe — e se nenhum dos
 * tres existir, sobra um traco, para a coluna nao colapsar e desalinhar a
 * grade das outras linhas.
 */
export const MatchContextCell: React.FC<MatchContextCellProps> = ({
  bracket,
  partySize,
  gameMode,
  lobbyType,
}) => {
  const { t } = useLanguage();

  const badge = getBracketBadge(bracket);
  const matchType = resolveMatchType(gameMode, lobbyType);
  const hasParty = partySize !== null && partySize !== undefined;

  if (!badge && !matchType && !hasParty) {
    return (
      <div className="text-left 2xl:text-center text-slate-600 font-mono text-xs" title={t('noData')}>
        —
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start 2xl:items-center gap-1">
      <div className="flex items-center gap-1.5">
        {badge && (
          <img
            src={badge.badgeUrl}
            alt={badge.name}
            title={`${t('matchAvgRank')}: ${badge.name}`}
            className="w-5 h-5 object-contain shrink-0"
            onError={handleRankImageError}
          />
        )}

        {hasParty && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold ${
              (partySize as number) > 1 ? 'text-cyan-300' : 'text-slate-500'
            }`}
            title={(partySize as number) > 1 ? t('partyOf', { count: partySize as number }) : t('partySolo')}
          >
            {(partySize as number) > 1 ? (
              <>
                <Users className="w-3 h-3" />
                {partySize}
              </>
            ) : (
              <User className="w-3 h-3" />
            )}
          </span>
        )}
      </div>

      {matchType && (
        <span
          className={`text-[9px] font-bold tracking-wide px-1.5 py-px rounded border whitespace-nowrap ${CHIP_STYLE[matchType]}`}
          title={t(FULL_LABEL[matchType])}
        >
          {t(SHORT_LABEL[matchType])}
        </span>
      )}

      {badge && (
        <span className="text-[9px] text-slate-500 font-sans leading-none">{badge.name}</span>
      )}
    </div>
  );
};
