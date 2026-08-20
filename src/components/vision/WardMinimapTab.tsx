import React, { useState } from 'react';
import { Eye, Shield, Clock, MapPin, Sparkles } from 'lucide-react';
import { MatchDetails, MatchPlayer, WardPlacement } from '../../types/dota';
import { normalizeMinimapCoords } from '../../utils/minimapCoords';
import { formatDuration } from '../../utils/dotaFormatters';
import { useLanguage } from '../../context/LanguageContext';

interface WardMinimapTabProps {
  player: MatchPlayer;
  match: MatchDetails;
}

export const WardMinimapTab: React.FC<WardMinimapTabProps> = ({ player, match }) => {
  const { t } = useLanguage();
  const [selectedMinute, setSelectedMinute] = useState<number>(Math.floor(match.durationSeconds / 60));
  const [showRadius, setShowRadius] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'ALL' | 'OBSERVER' | 'SENTRY'>('ALL');

  // Collect all wards from team players
  const allTeamWards: WardPlacement[] = [];
  match.players
    .filter((p) => p.isRadiant === player.isRadiant)
    .forEach((p) => {
      if (p.wardEvents) {
        allTeamWards.push(...p.wardEvents);
      }
    });

  // Filter wards placed before or at selectedMinute
  const activeWards = allTeamWards.filter((w) => {
    const wardMin = Math.floor(w.time / 60);
    if (wardMin > selectedMinute) return false;
    if (filterType !== 'ALL' && w.type !== filterType) return false;
    return true;
  });

  const obsCount = allTeamWards.filter((w) => w.type === 'OBSERVER').length;
  const sentryCount = allTeamWards.filter((w) => w.type === 'SENTRY').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Cols: Interactive Minimap */}
      <div className="lg:col-span-2 glass-card rounded-2xl p-5 border border-slate-800 bg-[#111724]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {t('visionTitle')}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showRadius}
                onChange={(e) => setShowRadius(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
              />
              <span>Vision Range</span>
            </label>

            {/* Ward Filter */}
            <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  filterType === 'ALL' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400'
                }`}
              >
                {t('allMatches')}
              </button>
              <button
                onClick={() => setFilterType('OBSERVER')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  filterType === 'OBSERVER' ? 'bg-yellow-400 text-slate-950 shadow-sm' : 'text-slate-400'
                }`}
              >
                {t('observerWards')}
              </button>
              <button
                onClick={() => setFilterType('SENTRY')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  filterType === 'SENTRY' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400'
                }`}
              >
                {t('sentryWards')}
              </button>
            </div>
          </div>
        </div>

        {/* 2D Dota 2 Minimap Container */}
        <div className="relative w-full aspect-square max-w-[500px] mx-auto rounded-xl overflow-hidden border-2 border-slate-700/80 shadow-2xl bg-[#090d14]">
          {/* Stylized Minimap Grid Background */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-85"
            style={{
              backgroundImage: `url('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/minimap/minimap_733.png')`,
              backgroundColor: '#0c131d',
            }}
          />

          {/* Radiant Base (Bottom Left) & Dire Base (Top Right) indicators */}
          <div className="absolute bottom-2 left-2 text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
            {t('radiant').toUpperCase()}
          </div>
          <div className="absolute top-2 right-2 text-[10px] font-black text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/40">
            {t('dire').toUpperCase()}
          </div>

          {/* Placed Wards Markers */}
          {activeWards.map((w, idx) => {
            const { leftPercent, topPercent } = normalizeMinimapCoords(w.x, w.y);
            const isObserver = w.type === 'OBSERVER';

            return (
              <div
                key={idx}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto group cursor-pointer"
                style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
              >
                {/* Vision Radius Ring */}
                {showRadius && (
                  <div
                    className={`absolute -inset-6 rounded-full opacity-20 animate-pulse pointer-events-none ${
                      isObserver ? 'bg-yellow-400' : 'bg-cyan-400'
                    }`}
                  />
                )}

                {/* Pin Icon */}
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 ${
                    isObserver
                      ? 'bg-yellow-400 border-yellow-200 text-black'
                      : 'bg-cyan-500 border-cyan-200 text-black'
                  }`}
                >
                  <MapPin className="w-3 h-3 fill-current" />
                </div>

                {/* Hover Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-30 bg-[#0f172a] border border-slate-700 text-[10px] font-mono py-1 px-2 rounded-md shadow-2xl whitespace-nowrap text-slate-200">
                  <div className="font-bold text-amber-400">{w.type} Ward</div>
                  <div>Placed at {formatDuration(w.time)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline Scrubber */}
        <div className="mt-5 space-y-2 font-mono">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('visionScrubber')}: {formatDuration(selectedMinute * 60)}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {activeWards.length} {t('activeVision')}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max={Math.floor(match.durationSeconds / 60)}
            value={selectedMinute}
            onChange={(e) => setSelectedMinute(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      </div>

      {/* Right Column: Vision KPIs & Log */}
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-4 border border-yellow-500/30 bg-[#161510] text-center">
            <div className="text-[11px] text-yellow-300/80 font-bold mb-1">{t('observerWards')}</div>
            <div className="text-2xl font-black text-yellow-400 font-mono">{obsCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">Placed across game</div>
          </div>

          <div className="glass-card rounded-xl p-4 border border-cyan-500/30 bg-[#0f171c] text-center">
            <div className="text-[11px] text-cyan-300/80 font-bold mb-1">{t('sentryWards')}</div>
            <div className="text-2xl font-black text-cyan-400 font-mono">{sentryCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">True Sight Dewards</div>
          </div>
        </div>

        {/* Wards Log */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 bg-[#111724]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Timeline Events</span>
          </h4>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 text-xs font-mono">
            {allTeamWards.map((w, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedMinute(Math.floor(w.time / 60))}
                className={`flex items-center justify-between p-2 rounded-lg border transition cursor-pointer ${
                  Math.floor(w.time / 60) <= selectedMinute
                    ? 'bg-slate-900/80 border-slate-700/80 text-slate-200'
                    : 'bg-slate-950/40 border-slate-900 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      w.type === 'OBSERVER' ? 'bg-yellow-400' : 'bg-cyan-400'
                    }`}
                  />
                  <span className="font-bold">{w.type}</span>
                </div>
                <span className="text-[11px] text-slate-400">{formatDuration(w.time)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
