import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ExternalLink,
  ShieldCheck,
  Globe,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
  Lock,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { extractSteamIdFromStratzToken, validateStratzApiKey, ValidatedTokenInfo } from '../../utils/stratzToken';
import { getRankTierInfo } from '../../constants/ranks';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onComplete: (apiKey: string, steamAccountId: string) => void;
  initialApiKey?: string;
  initialSteamId?: string;
  mode?: 'onboarding' | 'guide';
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialApiKey = '',
  initialSteamId = '',
  mode = 'onboarding',
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [tokenInput, setTokenInput] = useState<string>(initialApiKey);
  const [manualSteamId, setManualSteamId] = useState<string>(initialSteamId);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ValidatedTokenInfo | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTokenInput(initialApiKey);
      setManualSteamId(initialSteamId);
      setValidationError(null);

      if (initialApiKey.trim()) {
        handleValidate(initialApiKey.trim(), initialSteamId.trim() || undefined);
      }
    }
  }, [isOpen, initialApiKey, initialSteamId]);

  if (!isOpen) return null;

  const handleValidate = async (rawToken: string, explicitId?: string) => {
    const cleanToken = rawToken.trim().replace(/^Bearer\s+/i, '');
    if (!cleanToken) return;

    setIsValidating(true);
    setValidationError(null);

    try {
      const res = await validateStratzApiKey(cleanToken, explicitId || manualSteamId || undefined);
      if (res.success) {
        setValidationResult(res);
        if (res.steamAccountId) {
          setManualSteamId(res.steamAccountId);
        }
      } else {
        setValidationResult(null);
        setValidationError(res.error || t('stratzTokenError'));
      }
    } catch (err: any) {
      setValidationResult(null);
      setValidationError(err.message || t('stratzTokenError'));
    } finally {
      setIsValidating(false);
    }
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTokenInput(val);
    const clean = val.trim().replace(/^Bearer\s+/i, '');
    
    // If user pasted a JWT, automatically extract Steam ID immediately
    const autoSteamId = extractSteamIdFromStratzToken(clean);
    if (autoSteamId) {
      setManualSteamId(autoSteamId);
    }

    // Auto-trigger validation if token length is reasonable
    if (clean.length > 20) {
      handleValidate(clean, autoSteamId || undefined);
    } else {
      setValidationResult(null);
      setValidationError(null);
    }
  };

  const handleOpenStratzApi = () => {
    window.open('https://stratz.com/api', '_blank');
  };

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb.jpg';
  };

  const handleSaveAndLaunch = () => {
    const finalToken = tokenInput.trim().replace(/^Bearer\s+/i, '');
    const autoExtracted = extractSteamIdFromStratzToken(finalToken);
    const finalSteamId = manualSteamId.trim() || validationResult?.steamAccountId || autoExtracted || '';
    if (finalToken && finalSteamId) {
      onComplete(finalToken, finalSteamId);
    } else if (finalToken && !finalSteamId) {
      setValidationError('Por favor informe o SteamID da sua conta para carregar o histórico.');
    }
  };

  const rankInfo = validationResult?.seasonRank
    ? getRankTierInfo(validationResult.seasonRank, validationResult.leaderboardRank)
    : null;

  const canSave = Boolean(tokenInput.trim() && (manualSteamId.trim() || validationResult?.steamAccountId || extractSteamIdFromStratzToken(tokenInput)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b101b] border border-cyan-500/30 rounded-2xl w-full max-w-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Logo, Language Toggle and Close */}
        <div className="px-6 py-4 border-b border-slate-800/90 bg-[#0e1626]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-950 via-slate-900 to-emerald-950 flex items-center justify-center border border-cyan-500/40 shadow-md shadow-cyan-950/40">
              <KeyRound className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>{t('onboardingTitle')}</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-mono">
                  Setup
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t('onboardingSubtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === 'pt-BR' ? 'en-US' : 'pt-BR')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition"
              title="Change Language"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'pt-BR' ? 'PT' : 'EN'}</span>
            </button>

            {/* Optional Close Button if opened in guide mode */}
            {mode === 'guide' && onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Privacy & 100% Local Storage Guarantee Disclaimer */}
          <div className="p-3.5 rounded-xl bg-cyan-950/25 border border-cyan-500/30 flex items-start gap-3 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                <span>{t('privacyDisclaimerTitle')}</span>
                <Lock className="w-3 h-3 text-emerald-400" />
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {t('privacyDisclaimerText')}
              </p>
            </div>
          </div>

          {/* Step-by-Step Interactive Guide */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('howToGetKey')}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-[#0e1628] border border-slate-800 hover:border-slate-700 transition space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-cyan-300 font-bold text-xs">
                    <span>{t('onboardingStep1Title')}</span>
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {t('onboardingStep1Desc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenStratzApi}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition shadow-sm"
                >
                  <span>{t('openStratzApi')}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-[#0e1628] border border-slate-800 hover:border-slate-700 transition space-y-2">
                <div className="flex items-center justify-between text-amber-300 font-bold text-xs">
                  <span>{t('onboardingStep2Title')}</span>
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {t('onboardingStep2Desc')}
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-[#0e1628] border border-slate-800 hover:border-slate-700 transition space-y-2">
                <div className="flex items-center justify-between text-emerald-300 font-bold text-xs">
                  <span>{t('onboardingStep3Title')}</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {t('onboardingStep3Desc')}
                </p>
              </div>
            </div>
          </div>

          {/* Token Input & Real-Time Validation Box */}
          <div className="space-y-3 pt-1">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>{t('stratzApiKey')}</span>
              {isValidating && (
                <span className="text-[11px] text-cyan-400 flex items-center gap-1 font-sans lowercase">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  {t('validatingToken')}
                </span>
              )}
            </label>

            <div className="relative">
              <textarea
                value={tokenInput}
                onChange={handleTokenChange}
                placeholder={t('pasteTokenPlaceholder')}
                rows={3}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none transition resize-none ${
                  validationResult?.success
                    ? 'border-emerald-500/70 focus:border-emerald-400 ring-1 ring-emerald-500/30'
                    : validationError
                    ? 'border-rose-500/70 focus:border-rose-400 ring-1 ring-rose-500/30'
                    : 'border-slate-700 focus:border-cyan-500/60'
                }`}
              />
            </div>

            {/* Validation Error Banner */}
            {validationError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Validation Success Card (Profile Preview) */}
            {validationResult?.success && (
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-lg shadow-emerald-950/20">
                <div className="flex items-center gap-3">
                  {validationResult.avatar ? (
                    <img
                      src={validationResult.avatar}
                      alt={validationResult.name}
                      className="w-10 h-10 rounded-xl border border-emerald-500/40 object-cover shadow-sm"
                      onError={handleAvatarError}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 text-emerald-300 font-bold">
                      {validationResult.name?.charAt(0) || 'P'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-white">{validationResult.name}</span>
                      {rankInfo && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.2 rounded border"
                          style={{
                            backgroundColor: `${rankInfo.color}15`,
                            borderColor: `${rankInfo.color}40`,
                            color: rankInfo.color,
                          }}
                        >
                          {rankInfo.fullName}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-emerald-300/80 font-mono mt-0.5">
                      <span>{t('tokenDetectedId')} </span>
                      <strong className="text-white">{validationResult.steamAccountId}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Validado</span>
                </div>
              </div>
            )}

            {/* Manual SteamID input fallback */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-mono text-slate-300 flex items-center justify-between">
                <span>{t('manualSteamIdPrompt')}</span>
                <span className="text-[10px] text-slate-500">SteamID32 ou ID64</span>
              </label>
              <input
                type="text"
                value={manualSteamId}
                onChange={(e) => {
                  setManualSteamId(e.target.value);
                  if (tokenInput.trim() && e.target.value.trim()) {
                    handleValidate(tokenInput, e.target.value.trim());
                  }
                }}
                placeholder="Ex: 123456789 ou 76561198083722517"
                className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#080d16] flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
            <span>Requer chave de API gratuita do STRATZ.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {mode === 'guide' && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                {t('cancel')}
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAndLaunch}
              disabled={!canSave || isValidating}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-cyan-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{t('saveAndStart')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
