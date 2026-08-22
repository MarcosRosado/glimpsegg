import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  User,
  ExternalLink,
  Save,
  CheckCircle,
  Database,
  Sparkles,
  Globe,
  Star,
  HelpCircle,
  DownloadCloud,
  RefreshCw,
} from 'lucide-react';
import { resolveSteamId } from '../../services/steamResolver';
import { useLanguage } from '../../context/LanguageContext';
import { ProfileHistoryItem } from '../../types/dota';
import { extractSteamIdFromStratzToken } from '../../utils/stratzToken';
import { useGamePatch } from '../../hooks/useGamePatch';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  currentSteamId: string;
  profileHistory?: ProfileHistoryItem[];
  onSave: (apiKey: string, steamId: string) => Promise<void>;
  onOpenGuide?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentApiKey,
  currentSteamId,
  profileHistory = [],
  onSave,
  onOpenGuide,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [steamInput, setSteamInput] = useState(currentSteamId);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState<string | null>(null);
  const { patch: dotaPatch } = useGamePatch(apiKey);

  useEffect(() => {
    if (isOpen) {
      setApiKey(currentApiKey);
      setSteamInput(currentSteamId);
      setResolveError(null);
      setSavedSuccess(false);
      setUpdateStatusText(null);

      // Load app version if running in Electron
      if (window.api && typeof window.api.getVersion === 'function') {
        window.api.getVersion().then((v) => {
          if (v) setAppVersion(v);
        }).catch(() => {});
      }
    }
  }, [isOpen, currentApiKey, currentSteamId]);

  if (!isOpen) return null;

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    const autoSteamId = extractSteamIdFromStratzToken(val);
    if (autoSteamId && !steamInput.trim()) {
      setSteamInput(autoSteamId);
    }
  };

  const handleCheckUpdates = async () => {
    if (!window.api?.updater?.check) {
      setUpdateStatusText('Auto-update disponível apenas na versão empacotada.');
      return;
    }

    setIsCheckingUpdate(true);
    setUpdateStatusText(t('checkingUpdates'));

    try {
      const res = await window.api.updater.check();
      if (res?.dev) {
        setUpdateStatusText('Ambiente de desenvolvimento (sem updates)');
      } else if (res?.updateInfo) {
        setUpdateStatusText(`${t('updateAvailable').replace('{version}', res.updateInfo.version)}`);
      } else {
        setUpdateStatusText(t('noUpdatesAvailable'));
      }
    } catch (e: any) {
      setUpdateStatusText(t('updateError'));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setResolveError(null);

    try {
      // Resolve Steam ID if provided
      let finalSteamId = steamInput.trim();
      if (finalSteamId) {
        const res = await resolveSteamId(finalSteamId);
        if (res.success && res.steamAccountId) {
          finalSteamId = res.steamAccountId;
        } else {
          setResolveError(res.error || t('steamIdResolveError'));
          setIsSaving(false);
          return;
        }
      }

      await onSave(apiKey.trim(), finalSteamId);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      setResolveError(t('saveConfigError'));
    } finally {
      setIsSaving(false);
    }
  };

  const loadDemoPreset = (steamId: string) => {
    setSteamInput(steamId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="glass-card rounded-2xl border border-slate-700 w-full max-w-lg overflow-hidden shadow-2xl bg-[#0f1522] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#101726] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Key className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{t('settingsTitle')}</h3>
              <p className="text-[11px] text-slate-400">{t('settingsSubtitle')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Language Selection Setting */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('languageSetting')}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage('pt-BR')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  language === 'pt-BR'
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/50'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>🇧🇷 Português (Brasil)</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en-US')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  language === 'en-US'
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/50'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>🇺🇸 English (US)</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">{t('languageDesc')}</p>
          </div>

          {/* STRATZ API Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>{t('stratzApiKey')}</span>
                {apiKey ? (
                  <span className="text-[10px] text-emerald-400 font-normal">{t('activeShort')}</span>
                ) : (
                  <span className="text-[10px] text-rose-400 font-normal">{t('apiKeyRequired')}</span>
                )}
              </label>

              <div className="flex items-center gap-2">
                {onOpenGuide && (
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>{t('howToGetKey')}</span>
                  </button>
                )}
                <a
                  href="https://stratz.com/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>stratz.com/api</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <input
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder={t('stratzTokenPlaceholder')}
              className="w-full bg-[#141d2d] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono transition"
            />
            <p className="text-[10px] text-slate-400">
              {t('stratzApiKeyDesc')}
            </p>

            {/* Privacy Disclaimer Card */}
            <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/30 text-[11px] text-slate-300 leading-relaxed mt-2">
              <strong className="text-cyan-300 font-bold block mb-0.5">{t('privacyDisclaimerTitle')}</strong>
              {t('privacyDisclaimerText')}
            </div>
          </div>

          {/* Steam Account ID / Vanity URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('steamAccount')}</span>
            </label>

            <input
              type="text"
              value={steamInput}
              onChange={(e) => setSteamInput(e.target.value)}
              placeholder={t('steamAccountPlaceholder')}
              className="w-full bg-[#141d2d] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono transition"
            />

            {resolveError && (
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px]">
                {resolveError}
              </div>
            )}
            <p className="text-[10px] text-slate-400">{t('steamAccountDesc')}</p>
          </div>

          {/* Quick Profiles from History & Favorites */}
          {profileHistory && profileHistory.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('quickProfiles')}</span>
              </div>

              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar p-0.5">
                {profileHistory.slice(0, 8).map((p) => {
                  const isSelected = steamInput === p.steamAccountId;
                  return (
                    <button
                      key={p.steamAccountId}
                      type="button"
                      onClick={() => loadDemoPreset(p.steamAccountId)}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-sm'
                          : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                      }`}
                      title={`ID: ${p.steamAccountId}`}
                    >
                      {p.isFavorite ? (
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                      )}
                      <span className="truncate max-w-[120px]">{p.name || p.steamAccountId}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Auto Updater & Version Section */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-slate-400">
                <span>
                  {t('appVersion')}: <strong className="text-slate-200">v{appVersion}</strong>
                </span>
                <span className="hidden sm:inline text-slate-700">·</span>
                <span title={t('gamePatchTooltip')}>
                  {t('gamePatch')}: <strong className="text-cyan-300">{dotaPatch}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handleCheckUpdates}
                disabled={isCheckingUpdate}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 text-cyan-400 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                <span>{t('checkForUpdates')}</span>
              </button>
            </div>

            {updateStatusText && (
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-cyan-300 flex items-center gap-2">
                <DownloadCloud className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{updateStatusText}</span>
              </div>
            )}
          </div>

          {/* Footer Save Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              {t('cancel')}
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition disabled:opacity-50"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4 text-slate-950" />
                  <span>{t('settingsSavedAlert')}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{t('saveSettings')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
