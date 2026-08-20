import React from 'react';
import { ExternalLink } from 'lucide-react';
import { PeerTeammate } from '../../types/dota';
import { handleAvatarError } from '../../utils/imageFallback';

interface StratzTeammatesCardProps {
  peers?: PeerTeammate[];
}

export const StratzTeammatesCard: React.FC<StratzTeammatesCardProps> = ({ peers = [] }) => {
  if (peers.length === 0) {
    return null;
  }

  // Display top 6 peers like in the screenshot
  const displayPeers = peers.slice(0, 6);
  const maxMatches = Math.max(1, ...displayPeers.map((p) => p.withGames));

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 shadow-xl bg-[#0e1219] flex flex-col justify-between">
      {/* Header with Title and 1.000 Partidas Arrow */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-black text-slate-100 tracking-wide">
          Companheiros de equipe
        </h3>

        <div className="flex items-center gap-1 text-xs text-slate-400 font-mono hover:text-amber-400 transition cursor-pointer">
          <span className="text-[11px]">1.000 Partidas</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Rows List (Exact Replica of Screenshot 2) */}
      <div className="space-y-3.5">
        {displayPeers.map((peer) => {
          const isWinrateHigh = peer.winRateWith >= 50.0;
          const matchVolumePercent = Math.min(100, Math.round((peer.withGames / maxMatches) * 100));

          return (
            <div
              key={peer.accountId}
              className="flex items-center justify-between gap-3 text-xs font-mono group cursor-pointer hover:bg-slate-900/40 p-1.5 rounded-xl transition"
            >
              {/* Left: Avatar & Name */}
              <div className="flex items-center gap-3 min-w-0 w-36">
                <img
                  src={peer.avatar}
                  alt={peer.name}
                  className="w-10 h-10 rounded-lg border border-slate-700/80 object-cover shrink-0 shadow-sm"
                  onError={handleAvatarError}
                />
                <span className="font-bold text-slate-200 truncate group-hover:text-amber-400 transition font-sans text-xs">
                  {peer.name}
                </span>
              </div>

              {/* Center: Winrate % & Green/Red Mini Progress Bar */}
              <div className="flex items-center gap-2 w-28 justify-end">
                <span className="text-slate-300 font-bold text-xs">
                  {peer.winRateWith.toFixed(1).replace('.', ',')}%
                </span>
                <div className="w-12 h-2 rounded bg-[#1e2530] overflow-hidden">
                  <div
                    className={`h-full rounded ${
                      isWinrateHigh ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
                    }`}
                    style={{ width: `${Math.min(100, peer.winRateWith)}%` }}
                  />
                </div>
              </div>

              {/* Right: Matches Count & Golden Match Volume Progress Bar */}
              <div className="flex items-center gap-2 w-24 justify-end">
                <span className="text-slate-200 font-bold text-xs">
                  {peer.withGames}
                </span>
                <div className="w-14 h-2 rounded bg-[#1e2530] overflow-hidden">
                  <div
                    className="h-full rounded bg-[#eab308]"
                    style={{ width: `${matchVolumePercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
