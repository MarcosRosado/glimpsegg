import React from 'react';
import { Users } from 'lucide-react';
import { PeerTeammate } from '../../types/dota';
import { handleAvatarError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';

interface TeammatesCardProps {
  peers?: PeerTeammate[];
  /**
   * Abre a conta do companheiro. Na 1.0 a linha tinha cara de clicável (cursor, hover) e o
   * clique não fazia nada — o inventário da proposta da 2.0 achou isso.
   */
  onOpenPeer?: (accountId: string) => void;
}

export const TeammatesCard: React.FC<TeammatesCardProps> = ({ peers = [], onOpenPeer }) => {
  const { t, language } = useLanguage();

  if (peers.length === 0) {
    return null;
  }

  // Display top 6 peers like in the screenshot
  const displayPeers = peers.slice(0, 6);
  // O card exibia "1.000 Partidas" fixo, independente dos dados. Agora conta as
  // partidas realmente somadas nas duplas mostradas.
  const sampledMatches = displayPeers.reduce((sum, p) => sum + p.withGames, 0);

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 shadow-xl bg-[#0e1219] flex flex-col justify-between">
      {/* Header: titulo + volume real da amostra */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
          {t('teammatesCardTitle')}
        </h3>

        <div className="flex items-center gap-1 text-xs text-slate-400 font-mono shrink-0">
          <Users className="w-3.5 h-3.5" />
          <span className="text-[11px]">
            {sampledMatches.toLocaleString(language)} {t('matches')}
          </span>
        </div>
      </div>

      {/* Rows List (Exact Replica of Screenshot 2) */}
      <div className="space-y-3.5">
        {displayPeers.map((peer) => {
          const isWinrateHigh = peer.winRateWith >= 50.0;

          return (
            <button
              type="button"
              key={peer.accountId}
              onClick={() => onOpenPeer?.(String(peer.accountId))}
              disabled={!onOpenPeer}
              title={t('openPeerAccount', { name: peer.name })}
              className="w-full text-left flex items-center gap-3 text-xs font-mono group hover:bg-slate-900/40 p-1.5 rounded-xl transition disabled:cursor-default"
            >
              {/* Duas linhas ao lado do avatar: o card mora na coluna lateral do Início (~370px), e
                  as três colunas de largura fixa da 1.0 cortavam o nome em "Co…". */}
              <img
                src={peer.avatar}
                alt=""
                className="w-9 h-9 rounded-lg border border-slate-700/80 object-cover shrink-0 shadow-sm"
                onError={handleAvatarError}
              />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-slate-200 truncate group-hover:text-amber-400 transition font-sans text-xs">
                    {peer.name}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0" title={t('matches')}>
                    {peer.withGames.toLocaleString(language)} {t('matches').toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded bg-[#1e2530] overflow-hidden">
                    <div
                      className={`h-full rounded ${isWinrateHigh ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
                      style={{ width: `${Math.min(100, peer.winRateWith)}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-bold w-12 text-right ${isWinrateHigh ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {peer.winRateWith.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
