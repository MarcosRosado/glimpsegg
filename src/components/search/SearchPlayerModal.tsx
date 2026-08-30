import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Star,
  Trash2,
  User,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  History,
  RotateCcw,
} from 'lucide-react';
import { ProfileHistoryItem } from '../../types/dota';
import { useLanguage } from '../../context/LanguageContext';
import { handleAvatarError } from '../../utils/imageFallback';
import { getRankTierInfo } from '../../constants/ranks';

interface SearchPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSteamId: string;
  configuredSteamId: string;
  configuredProfileName?: string;
  profileHistory: ProfileHistoryItem[];
  onSearch: (input: string) => Promise<void>;
  onSelectProfile: (steamAccountId: string) => Promise<void>;
  onToggleFavorite: (steamAccountId: string) => void;
  onRemoveHistory: (steamAccountId: string) => void;
  onClearHistory: () => void;
  onReturnToConfigured: () => void;
  isLoading?: boolean;
}

export const SearchPlayerModal: React.FC<SearchPlayerModalProps> = ({
  isOpen,
  onClose,
  currentSteamId,
  configuredSteamId,
  configuredProfileName,
  profileHistory,
  onSearch,
  onSelectProfile,
  onToggleFavorite,
  onRemoveHistory,
  onClearHistory,
  onReturnToConfigured,
  isLoading = false,
}) => {
  const { t, language } = useLanguage();
  const [searchInput, setSearchInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setShowConfirmClear(false);
    } else {
      setSearchInput('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSearch(searchInput.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelect = async (steamAccountId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSelectProfile(steamAccountId);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      onReturnToConfigured();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isViewingDifferentAccount = currentSteamId !== configuredSteamId;
  const favorites = profileHistory.filter((p) => p.isFavorite);
  const recentHistory = profileHistory.filter((p) => !p.isFavorite);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="glass-card rounded-2xl border border-slate-700/80 w-full max-w-2xl overflow-hidden shadow-2xl bg-[#0e1422] flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/90 bg-[#101726]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-950 to-slate-900 border border-cyan-500/40 flex items-center justify-center shadow-md shadow-cyan-950/40">
              <Search className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{t('searchModalTitle')}</span>
              </h3>
              <p className="text-[11px] text-slate-400">{t('searchModalSubtitle')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={t('closeEsc')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar Input */}
        <div className="p-5 border-b border-slate-800/80 bg-[#0c121e]">
          <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full bg-[#141d2d] border border-slate-700/80 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 font-mono transition shadow-inner"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!searchInput.trim() || isSubmitting || isLoading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition disabled:opacity-50 shrink-0"
            >
              {isSubmitting || isLoading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('searching')}</span>
                </>
              ) : (
                <>
                  <span>{t('searchBtn')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1 font-mono">
            <span>{t('searchExampleHint')}</span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {/* Quick Return to Configured Account Card */}
          <div
            className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
              isViewingDifferentAccount
                ? 'bg-cyan-950/30 border-cyan-500/40 shadow-sm'
                : 'bg-slate-900/40 border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                  isViewingDifferentAccount
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                }`}
              >
                <User className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white truncate">
                    {configuredProfileName || t('myPrimaryAccount')}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                    ID: {configuredSteamId}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {isViewingDifferentAccount
                    ? t('viewingDifferentAccount')
                    : `${t('myPrimaryAccount')} (${t('activeProfile')})`}
                </p>
              </div>
            </div>

            {isViewingDifferentAccount ? (
              <button
                type="button"
                onClick={handleReturn}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('returnToConfigured')}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold shrink-0 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('activeProfile')}</span>
              </div>
            )}
          </div>

          {/* Section 1: Favorites */}
          {favorites.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 font-mono uppercase tracking-wider">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{t('favorites')}</span>
                <span className="text-slate-400 text-[11px] font-normal">({favorites.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {favorites.map((item) => {
                  const isActive = item.steamAccountId === currentSteamId;
                  const rank = item.seasonRank ? getRankTierInfo(item.seasonRank, item.leaderboardRank) : null;

                  return (
                    <div
                      key={item.steamAccountId}
                      className={`group p-2.5 rounded-xl border transition flex items-center justify-between gap-2.5 cursor-pointer ${
                        isActive
                          ? 'bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-950/20'
                          : 'bg-[#121927] border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                      onClick={() => handleSelect(item.steamAccountId)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={item.avatar}
                          alt={item.name}
                          className="w-8 h-8 rounded-lg border border-slate-700 object-cover shrink-0"
                          onError={handleAvatarError}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-300 transition">
                              {item.name}
                            </span>
                            {isActive && (
                              <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                                {t('activeShort')}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 truncate">
                            <span>ID: {item.steamAccountId}</span>
                            {rank && (
                              <>
                                <span>•</span>
                                <span style={{ color: rank.color }}>{rank.fullName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(item.steamAccountId)}
                          className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-400/10 transition"
                          title={t('unfavoriteProfile')}
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveHistory(item.steamAccountId)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition"
                          title={t('removeFromHistory')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Recent History */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                <History className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('recentProfiles')}</span>
                <span className="text-slate-400 text-[11px] font-normal">({recentHistory.length})</span>
              </div>

              {profileHistory.length > 0 && (
                <div className="flex items-center gap-2">
                  {showConfirmClear ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                      <span className="text-[10px] text-rose-300">{t('confirmClearHistory')}</span>
                      <button
                        type="button"
                        onClick={() => {
                          onClearHistory();
                          setShowConfirmClear(false);
                        }}
                        className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-[10px] font-bold text-white transition"
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfirmClear(false)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfirmClear(true)}
                      className="text-[11px] text-slate-400 hover:text-rose-400 transition flex items-center gap-1 font-mono"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t('clearHistory')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {recentHistory.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">{t('noSearchHistory')}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {t('noHistoryHint')}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentHistory.map((item) => {
                  const isActive = item.steamAccountId === currentSteamId;
                  const rank = item.seasonRank ? getRankTierInfo(item.seasonRank, item.leaderboardRank) : null;
                  const formattedDate = new Date(item.lastSearched).toLocaleDateString(language, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={item.steamAccountId}
                      className={`group p-2.5 rounded-xl border transition flex items-center justify-between gap-2.5 cursor-pointer ${
                        isActive
                          ? 'bg-cyan-950/20 border-cyan-500/50 shadow-md shadow-cyan-950/20'
                          : 'bg-[#121927] border-slate-800/90 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                      onClick={() => handleSelect(item.steamAccountId)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.avatar}
                          alt={item.name}
                          className="w-8 h-8 rounded-lg border border-slate-700 object-cover shrink-0"
                          onError={handleAvatarError}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100 truncate group-hover:text-cyan-300 transition">
                              {item.name}
                            </span>
                            {isActive && (
                              <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                                {t('activeShort')}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 truncate">
                            <span>ID: {item.steamAccountId}</span>
                            {rank && (
                              <>
                                <span>•</span>
                                <span style={{ color: rank.color }}>{rank.fullName}</span>
                              </>
                            )}
                            <span>•</span>
                            <span className="text-slate-400">{formattedDate}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(item.steamAccountId)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition"
                          title={t('favoriteProfile')}
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveHistory(item.steamAccountId)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition"
                          title={t('removeFromHistory')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Shortcut Info */}
        <div className="p-3.5 border-t border-slate-800 bg-[#101726] flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">
                ↵
              </kbd>{' '}
              {t('searchBtn')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">
                Esc
              </kbd>{' '}
              {t('close')}
            </span>
          </div>

          <span className="text-slate-400">{t('playerResolverFooter')}</span>
        </div>
      </div>
    </div>
  );
};
