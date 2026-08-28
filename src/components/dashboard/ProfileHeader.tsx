import React from 'react';
import { Trophy, Flame, Target, Award, ExternalLink, LayoutGrid, Sparkles } from 'lucide-react';
import { PlayerProfileSummary } from '../../types/dota';
import { getRankTierInfo } from '../../constants/ranks';
import { formatPercent } from '../../utils/dotaFormatters';
import { handleAvatarError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';
import { computeRecentFormStats } from '../../utils/recentFormStats';
import { describeDaysSince } from '../../utils/heroGrid/tabFormat';
import { DAYS_SINCE_LABEL } from '../heroGrid/labels';

interface ProfileHeaderProps {
  profile: PlayerProfileSummary;
  /**
   * T036: o acesso à replica existe SÓ com a feature ativa — mesmo molde do toggle da
   * `Navbar`. Desligada, a feature nao lê nem escreve nada, entao um botao para uma tela
   * que so pode estar vazia seria ruido.
   */
  heroGridEnabled?: boolean;
  /** Epoch ms da ultima gravacao do espelho, para o `title` do botao. */
  lastMirrorSyncAt?: number | null;
  /**
   * Perfil de OUTRA conta na tela. O espelho é da conta configurada, entao o botao fica
   * desativado com a explicacao no `title` — desativar, e nao esconder.
   */
  isViewingDifferentAccount?: boolean;
  onOpenHeroGridMirror?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  heroGridEnabled = false,
  lastMirrorSyncAt = null,
  isViewingDifferentAccount = false,
  onOpenHeroGridMirror,
}) => {
  const { t, language } = useLanguage();
  const rankInfo = getRankTierInfo(profile.seasonRank, profile.leaderboardRank);
  // Mesmos agregados da stat rail e do card de Forma Recente.
  const form = computeRecentFormStats(profile.recentMatches);

  /**
   * "Ha quantos dias" no proprio botao, e nao so no `title`.
   *
   * FR-024a manda tornar visivel que o espelho envelheceu — com o app fechado nao ha
   * sincronizacao. Deixar isso so no tooltip esconderia justamente o caso que o requisito
   * existe para mostrar. `describeDaysSince` recebe FRACAO de dia, entao o epoch vira
   * diferenca aqui.
   */
  const mirrorDays = lastMirrorSyncAt
    ? describeDaysSince((Date.now() - lastMirrorSyncAt) / 86_400_000)
    : describeDaysSince(null);
  // `NEVER` é tratado antes da tabela: aqui o rotulo simplesmente NAO aparece, porque o
  // botao ja diz "nunca gravado" no `title` e um chip a mais seria ruido no card.
  const mirrorAge =
    mirrorDays.kind === 'NEVER' ? null : t(DAYS_SINCE_LABEL[mirrorDays.kind], { n: mirrorDays.days });

  return (
    <div className="glass-card rounded-2xl p-6 relative overflow-hidden border border-slate-800 shadow-xl bg-gradient-to-r from-[#101726] via-[#121c2e] to-[#151c2a]">
      {/* Background Subtle Accent Glow */}
      <div
        className="absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ backgroundColor: rankInfo.color }}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        {/* Left: Avatar & Basic Information */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-20 h-20 rounded-2xl border-2 border-slate-700/80 shadow-md object-cover"
              onError={handleAvatarError}
            />
            {profile.leaderboardRank && (
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">
                #{profile.leaderboardRank}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white tracking-wide">{profile.name}</h1>
              {profile.profileUri && (
                <a
                  href={profile.profileUri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-amber-400 transition"
                  title={t('openSteamProfile')}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
              <span className="font-mono text-slate-300">ID: {profile.steamAccountId}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{profile.totalMatches.toLocaleString()} {t('matches')}</span>
              </span>
            </div>

            {/* Rank Badge & Tier Display */}
            <div className="flex items-center gap-3 mt-3">
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-bold shadow-sm"
                style={{
                  backgroundColor: `${rankInfo.color}15`,
                  borderColor: `${rankInfo.color}40`,
                  color: rankInfo.color,
                }}
              >
                <Award className="w-4 h-4" />
                <span>{rankInfo.fullName}</span>
              </div>
              <div className="text-xs font-mono font-medium text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                Est. <span className="text-amber-400 font-bold">{rankInfo.approxMmr.toLocaleString()}</span> MMR
              </div>

              {/* Entrada para a replica do layout espelho. O `title` traz a data da ultima
                  gravacao para o jogador saber, antes de clicar, se ha algo recente lá. */}
              {heroGridEnabled && onOpenHeroGridMirror && (
                <button
                  type="button"
                  onClick={onOpenHeroGridMirror}
                  disabled={isViewingDifferentAccount}
                  title={
                    isViewingDifferentAccount
                      ? t('heroGridOtherAccountBody')
                      : lastMirrorSyncAt
                        ? t('heroGridMirrorLastSync', {
                            date: new Date(lastMirrorSyncAt).toLocaleString(language),
                          })
                        : t('heroGridMirrorNeverWritten')
                  }
                  className="flex items-center gap-2 px-3 py-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-white text-xs font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-500/10 disabled:hover:text-cyan-300"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>{t('heroGridMirrorOpenFromProfile')}</span>
                  {mirrorAge && (
                    <span className="text-[10px] font-mono font-normal text-cyan-400/70">
                      {mirrorAge}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Aggregate Career Statistics */}
        <div className="grid grid-cols-3 gap-4 md:border-l md:border-slate-800 md:pl-8">
          {/* Win Rate */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 text-center min-w-[100px]">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-1">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('winRate')}</span>
            </div>
            <div className={`text-xl font-black ${profile.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPercent(profile.winRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {profile.winCount}{t('wins')} - {profile.totalMatches - profile.winCount}{t('losses')}
            </div>
          </div>

          {/* Total Matches */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 text-center min-w-[100px]">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>{t('careerMatches')}</span>
            </div>
            <div className="text-xl font-black text-white">{profile.totalMatches.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{t('matches')}</div>
          </div>

          {/* Average IMP / Impact */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 text-center min-w-[100px]">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-1">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('avgImp')}</span>
            </div>
            <div className={`text-xl font-black ${form.avgImp >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
              {form.avgImp >= 0 ? `+${form.avgImp}` : form.avgImp}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
              {t('matchesSampled', { count: form.count })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
