import React, { useState, useMemo } from 'react';
import { Users, Search, Trophy, Sparkles, Shield, Flame } from 'lucide-react';
import { PeerTeammate } from '../../types/dota';
import { handleAvatarError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';

interface TeammatesMatrixProps {
  peers?: PeerTeammate[];
}

export const TeammatesMatrix: React.FC<TeammatesMatrixProps> = ({ peers = [] }) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPeers = useMemo(() => {
    return peers.filter((p) => {
      if (!searchQuery.trim()) return true;
      return p.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [peers, searchQuery]);

  if (peers.length === 0) {
    return null;
  }

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 shadow-xl bg-[#111723]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {t('teammatesTitle')}
            </h3>
            <p className="text-[10px] text-slate-400">{t('teammatesSubtitle')}</p>
          </div>
        </div>

        {/* Friend search */}
        <div className="relative w-48">
          <input
            type="text"
            placeholder={t('searchFriend')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 text-xs text-slate-200 rounded-lg pl-8 pr-3 py-1.5 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 font-mono"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Grid of Friends / Teammates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredPeers.length === 0 ? (
          <div className="col-span-full text-center py-6 text-slate-500 text-xs font-mono">
            {t('noFriendsFound')}
          </div>
        ) : (
          filteredPeers.map((peer) => {
            const isHighSynergy = peer.winRateWith >= 52.0;

            return (
              <div
                key={peer.accountId}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/50 transition flex items-center justify-between group"
              >
                {/* Left: Avatar & Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={peer.avatar}
                    alt={peer.name}
                    className="w-10 h-10 rounded-xl border border-slate-700 object-cover shrink-0"
                    onError={handleAvatarError}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-200 truncate group-hover:text-amber-400 transition">
                      {peer.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {peer.withGames.toLocaleString()} {t('matches')}
                    </div>
                  </div>
                </div>

                {/* Right: Winrate & Synergy */}
                <div className="text-right shrink-0 font-mono">
                  <div
                    className={`text-xs font-black ${
                      peer.winRateWith >= 50 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {peer.winRateWith}% WR
                  </div>
                  <div className="text-[9px] text-slate-500">
                    {peer.withWin.toLocaleString()}W - {(peer.withGames - peer.withWin).toLocaleString()}L
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
