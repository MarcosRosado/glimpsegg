import React from 'react';
import { Trophy, Crown, Shield, Skull, Zap, Swords, Coins, Flame, Eye, Landmark, HeartPulse } from 'lucide-react';
import { MatchDetails } from '../../types/dota';
import { computeMatchAwards } from '../../utils/awardEngine';
import { getHero } from '../../constants/heroes';
import { formatGold } from '../../utils/dotaFormatters';
import { handleHeroImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';

interface TeamOverviewCardProps {
  match: MatchDetails;
  selectedPlayerSlot: number;
  onSelectPlayer: (playerSlot: number) => void;
}

export const TeamOverviewCard: React.FC<TeamOverviewCardProps> = ({
  match,
  selectedPlayerSlot,
  onSelectPlayer,
}) => {
  const { t } = useLanguage();
  const { awards, aggregates } = computeMatchAwards(match);

  const totalGoldCombined = (aggregates.radiantNetworth + aggregates.direNetworth) || 1;
  const radGoldPct = Math.round((aggregates.radiantNetworth / totalGoldCombined) * 100);
  const direGoldPct = 100 - radGoldPct;

  const totalKillsCombined = (aggregates.radiantKills + aggregates.direKills) || 1;
  const radKillsPct = Math.round((aggregates.radiantKills / totalKillsCombined) * 100);
  const direKillsPct = 100 - radKillsPct;

  const totalDmgCombined = (aggregates.radiantHeroDamage + aggregates.direHeroDamage) || 1;
  const radDmgPct = Math.round((aggregates.radiantHeroDamage / totalDmgCombined) * 100);
  const direDmgPct = 100 - radDmgPct;

  return (
    <div className="space-y-6">
      {/* Top Awards Banner (MVP, Extreme MVP, Top Core, Top Support, Extreme LVP) */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 bg-[#0f1624] shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            {t('awardsTitle')}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {awards.map((award) => {
            const hero = getHero(award.heroId);
            const isSelected = selectedPlayerSlot === award.playerSlot;

            return (
              <div
                key={award.award + award.playerSlot}
                onClick={() => onSelectPlayer(award.playerSlot)}
                className={`relative rounded-xl p-4 border transition-all cursor-pointer group flex flex-col justify-between overflow-hidden ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/50'
                    : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/70 hover:border-slate-700'
                }`}
              >
                {/* Glow Background */}
                <div
                  className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: award.glowColor }}
                />

                {/* Top Badge Tag */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider flex items-center gap-1.5 shadow-sm bg-gradient-to-r ${award.badgeColor}`}
                  >
                    {award.award === 'EXTREME_MVP' && <Crown className="w-3.5 h-3.5 fill-current" />}
                    {award.award === 'MVP' && <Trophy className="w-3.5 h-3.5" />}
                    {award.award === 'TOP_CORE' && <Flame className="w-3.5 h-3.5" />}
                    {award.award === 'TOP_SUPPORT' && <Shield className="w-3.5 h-3.5" />}
                    {(award.award === 'LVP' || award.award === 'EXTREME_LVP') && <Skull className="w-3.5 h-3.5" />}
                    <span>{award.title}</span>
                  </span>

                  <span
                    className={`text-xs font-mono font-bold ${
                      award.score >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {award.score >= 0 ? `+${award.score}` : award.score} IMP
                  </span>
                </div>

                {/* Hero Avatar & Name */}
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={hero.avatarUrl}
                    alt={hero.displayName}
                    className="w-12 h-8 object-cover rounded-lg border border-slate-700 shadow-md shrink-0"
                    onError={handleHeroImageError}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-100 truncate group-hover:text-amber-400 transition">
                      {hero.displayName}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate font-mono">
                      {award.playerName}
                    </div>
                  </div>
                </div>

                {/* Stat Highlight line */}
                <div className="text-[11px] text-slate-300 font-mono bg-slate-950/60 py-1.5 px-2.5 rounded-lg border border-slate-800/80">
                  {award.highlightStats}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparative Team Statistics Dashboard */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 bg-[#0f1624] shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {t('teamComparison')}
            </h2>
          </div>
          <div className="flex items-center gap-6 text-xs font-bold">
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              {t('radiant')} ({match.didRadiantWin ? t('win') : t('loss')})
            </span>
            <span className="text-rose-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              {t('dire')} ({!match.didRadiantWin ? t('win') : t('loss')})
            </span>
          </div>
        </div>

        <div className="space-y-4 font-mono text-xs">
          {/* Networth Bar */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1.5 font-sans">
              <span className="font-bold text-emerald-400">{formatGold(aggregates.radiantNetworth)}</span>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" /> {t('totalGold')}
              </span>
              <span className="font-bold text-rose-400">{formatGold(aggregates.direNetworth)}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 flex overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                style={{ width: `${radGoldPct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                style={{ width: `${direGoldPct}%` }}
              />
            </div>
          </div>

          {/* Kills Bar */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1.5 font-sans">
              <span className="font-bold text-emerald-400">{aggregates.radiantKills} Kills</span>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Swords className="w-3.5 h-3.5 text-indigo-400" /> {t('totalKills')}
              </span>
              <span className="font-bold text-rose-400">{aggregates.direKills} Kills</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 flex overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                style={{ width: `${radKillsPct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                style={{ width: `${direKillsPct}%` }}
              />
            </div>
          </div>

          {/* Hero Damage Bar */}
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1.5 font-sans">
              <span className="font-bold text-emerald-400">{aggregates.radiantHeroDamage.toLocaleString()}</span>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" /> {t('totalDamage')}
              </span>
              <span className="font-bold text-rose-400">{aggregates.direHeroDamage.toLocaleString()}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 flex overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                style={{ width: `${radDmgPct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                style={{ width: `${direDmgPct}%` }}
              />
            </div>
          </div>

          {/* Tower Damage, Ally Healing & Vision Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300 font-sans font-medium">{t('towerDamage')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">{aggregates.radiantTowerDamage.toLocaleString()}</span>
                <span className="text-slate-600">vs</span>
                <span className="text-rose-400 font-bold">{aggregates.direTowerDamage.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-teal-400" />
                <span className="text-slate-300 font-sans font-medium">Cura Realizada</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">{aggregates.radiantHealing.toLocaleString()}</span>
                <span className="text-slate-600">vs</span>
                <span className="text-rose-400 font-bold">{aggregates.direHealing.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300 font-sans font-medium">{t('wardsPlaced')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">{aggregates.radiantWards}</span>
                <span className="text-slate-600">vs</span>
                <span className="text-rose-400 font-bold">{aggregates.direWards}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
