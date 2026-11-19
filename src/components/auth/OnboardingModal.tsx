import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Globe,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
  Lock,
  User,
  Eye,
  Search,
  Loader2,
} from 'lucide-react';
import { BrandMark } from '../brand/BrandMark';
import { useLanguage } from '../../context/LanguageContext';
import { resolveSteamId, withOpenDotaProfile } from '../../services/steamResolver';
import type { SteamResolveResult } from '../../types/electron';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  /** Recebe SEMPRE o account id (SteamID32) ja resolvido, nunca o texto digitado. */
  onComplete: (steamAccountId: string) => void;
  initialSteamId?: string;
  mode?: 'onboarding' | 'guide';
}

/**
 * Primeira execucao: o app pede só a conta Steam. Nao ha token — todos os dados vem da
 * OpenDota, que é publica.
 *
 * O fluxo tem DOIS passos de proposito (buscar → confirmar). Um link de perfil com nome
 * personalizado é resolvido por busca de nome, e a busca devolve o primeiro resultado:
 * salvar direto abriria o app na conta de outra pessoa sem aviso. A conta resolvida
 * aparece antes do botao de salvar, com o ID sempre visivel e nome/avatar do perfil publico
 * da OpenDota (`withOpenDotaProfile`). Sem perfil ou com a consulta falhando, o cartao diz
 * isso e mostra só o ID — a tela nao inventa nome.
 */
export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialSteamId = '',
  mode = 'onboarding',
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [accountInput, setAccountInput] = useState<string>(initialSteamId);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolved, setResolved] = useState<SteamResolveResult | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  /** Avatar que falhou ao carregar cai na inicial, em vez de numa imagem de outra conta. */
  const [avatarFailed, setAvatarFailed] = useState<boolean>(false);
  /** Descarta resposta de uma busca antiga que chegue depois de o campo ter mudado. */
  const requestSeq = useRef(0);

  useEffect(() => {
    if (isOpen) {
      requestSeq.current += 1;
      setAccountInput(initialSteamId);
      setResolved(null);
      setHasError(false);
      setIsResolving(false);
      setAvatarFailed(false);
    }
  }, [isOpen, initialSteamId]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Mudou o texto, a conta confirmada deixa de valer: o botao volta a ser "buscar".
    requestSeq.current += 1;
    setAccountInput(e.target.value);
    setResolved(null);
    setHasError(false);
    setIsResolving(false);
    setAvatarFailed(false);
  };

  const handleResolve = async () => {
    const input = accountInput.trim();
    if (!input) return;

    const seq = ++requestSeq.current;
    setIsResolving(true);
    setHasError(false);
    setResolved(null);
    setAvatarFailed(false);

    try {
      // Nome e foto do perfil público: sem eles, ID numérico confirmava só um número.
      const res = await withOpenDotaProfile(await resolveSteamId(input));
      if (seq !== requestSeq.current) return;
      if (res.success && res.steamAccountId) {
        setResolved(res);
      } else {
        // `res.error` é literal em ingles vindo do resolver; a tela usa o texto traduzido.
        setHasError(true);
      }
    } catch {
      if (seq !== requestSeq.current) return;
      setHasError(true);
    } finally {
      if (seq === requestSeq.current) setIsResolving(false);
    }
  };

  const handlePrimaryAction = () => {
    if (resolved?.steamAccountId) {
      onComplete(resolved.steamAccountId);
    } else {
      void handleResolve();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePrimaryAction();
    }
  };

  const canAct = Boolean(accountInput.trim()) && !isResolving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b101b] border border-cyan-500/30 rounded-2xl w-full max-w-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Logo, Language Toggle and Close */}
        <div className="px-6 py-4 border-b border-slate-800/90 bg-[#0e1626]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-950 via-slate-900 to-emerald-950 flex items-center justify-center border border-cyan-500/40 shadow-md shadow-cyan-950/40">
              <BrandMark className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>{t('onboardingTitle')}</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-mono">
                  {t('setupBadge')}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t('onboardingSubtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
          {/* Idioma vem PRIMEIRO, e no corpo — nao num canto do cabecalho.
              É a unica decisao desta tela que muda a propria tela: escolher a lingua
              depois de ler o passo a passo nao ajuda quem precisava dela para ler.
              O padrao é en-US (ver LanguageContext); a escolha grava na hora, sem
              botao de confirmar, e vale para o app inteiro. */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>{t('languageSetting')}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage('en-US')}
                aria-pressed={language === 'en-US'}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  language === 'en-US'
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/50'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>🇺🇸 English (US)</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage('pt-BR')}
                aria-pressed={language === 'pt-BR'}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  language === 'pt-BR'
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/50'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>🇧🇷 Português (Brasil)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">{t('languageDesc')}</p>
          </div>

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

          {/* O guia aparece nos dois modos: quem mais precisa do aviso de dados publicos é
              justamente quem esta configurando pela primeira vez — sem a opcao ligada no
              Dota, o perfil carrega vazio e parece defeito do app. */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('accountGuideTitle')}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-[#0e1628] border border-slate-800 hover:border-slate-700 transition space-y-2">
                <div className="flex items-center justify-between text-cyan-300 font-bold text-xs">
                  <span>{t('guideSteamIdTitle')}</span>
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {t('guideSteamIdDesc')}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0e1628] border border-slate-800 hover:border-slate-700 transition space-y-2">
                <div className="flex items-center justify-between text-amber-300 font-bold text-xs">
                  <span>{t('guidePublicDataTitle')}</span>
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {t('guidePublicDataDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* Campo da conta + conta resolvida */}
          <div className="space-y-3 pt-1">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>{t('onboardingAccountLabel')}</span>
              {isResolving && (
                <span className="text-[11px] text-cyan-400 flex items-center gap-1 font-sans normal-case">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  {t('onboardingResolving')}
                </span>
              )}
            </label>

            <input
              type="text"
              value={accountInput}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder={t('steamAccountPlaceholder')}
              autoFocus
              className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                resolved
                  ? 'border-emerald-500/70 focus:border-emerald-400 ring-1 ring-emerald-500/30'
                  : hasError
                  ? 'border-rose-500/70 focus:border-rose-400 ring-1 ring-rose-500/30'
                  : 'border-slate-700 focus:border-cyan-500/60'
              }`}
            />

            {hasError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{t('steamIdResolveError')}</span>
              </div>
            )}

            {resolved?.steamAccountId && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg shadow-emerald-950/20">
                  <div className="flex items-center gap-3 min-w-0">
                    {resolved.avatar && !avatarFailed ? (
                      <img
                        src={resolved.avatar}
                        alt={resolved.personaname || resolved.steamAccountId}
                        className="w-10 h-10 rounded-xl border border-emerald-500/40 object-cover shadow-sm shrink-0"
                        onError={() => setAvatarFailed(true)}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 text-emerald-300 font-bold shrink-0">
                        {resolved.personaname ? resolved.personaname.charAt(0) : <User className="w-4 h-4" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      {resolved.personaname && (
                        <div className="font-black text-sm text-white truncate">{resolved.personaname}</div>
                      )}
                      <div className="text-[11px] text-emerald-300/80 font-mono mt-0.5">
                        {t('onboardingAccountId', { id: resolved.steamAccountId })}
                      </div>
                    </div>
                  </div>

                  {/* "Encontrada" só quando o resolver trouxe o nome: ID numerico puro é
                      convertido sem consulta nenhuma, entao nada foi de fato encontrado. */}
                  {resolved.personaname && (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('onboardingAccountFound')}</span>
                    </div>
                  )}
                </div>
                {/* Sem perfil na OpenDota o ID pode estar errado; consulta que falhou só diz que
                    não deu para conferir. Os dois avisam em vez de deixar o cartão mudo. */}
                {resolved.profileStatus === 'NOT_FOUND' && (
                  <p className="text-[11px] text-amber-300">{t('onboardingProfileNotFound')}</p>
                )}
                {resolved.profileStatus === 'UNAVAILABLE' && (
                  <p className="text-[11px] text-amber-300/90">{t('onboardingProfileUnavailable')}</p>
                )}
                <p className="text-[11px] text-slate-400">{t('onboardingConfirmHint')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#080d16] flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
            <span>{t('onboardingFooterNote')}</span>
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
              onClick={handlePrimaryAction}
              disabled={!canAct}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-cyan-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resolved ? (
                <>
                  <span>{t('saveAndStart')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>{t('onboardingFindAccount')}</span>
                  {isResolving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
