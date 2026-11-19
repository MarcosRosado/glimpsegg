import React from 'react';
import { ChevronDown } from 'lucide-react';
import { MatchDetails } from '../../types/dota';
import { getHero } from '../../constants/heroes';
import { useLanguage } from '../../context/LanguageContext';

/**
 * O seletor de jogador da partida analisada, UM só e fixo ao lado das abas
 * (docs/PROPOSTA-V2.md §3.4, opção A dos wireframes). Na 1.0 cada aba tinha o seu, e trocar
 * de aba fazia escolher o mesmo jogador de novo.
 *
 * `<select>` nativo de propósito: teclado, leitor de tela e lista longa em janela estreita
 * vêm prontos. Agrupado por lado para "o meu time" ficar junto.
 */
export const MatchPlayerPicker: React.FC<{
  match: MatchDetails;
  selectedSlot: number;
  onSelect: (slot: number) => void;
  /** Conta configurada: a opção dela ganha "(você)". */
  configuredSteamId?: string;
}> = ({ match, selectedSlot, onSelect, configuredSteamId }) => {
  const { t } = useLanguage();
  const radiant = match.players.filter((p) => p.isRadiant);
  const dire = match.players.filter((p) => !p.isRadiant);

  const label = (p: MatchDetails['players'][number]) => {
    const hero = getHero(p.heroId).displayName;
    const you = configuredSteamId && p.steamAccountId === configuredSteamId ? ` (${t('youLabel')})` : '';
    return `${hero} · ${p.name}${you}`;
  };

  return (
    <label className="relative inline-flex items-center gap-2 text-xs text-slate-400 shrink-0">
      <span>{t('playerPickerLabel')}</span>
      <select
        value={selectedSlot}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="appearance-none rounded-lg border border-slate-700 bg-slate-900 hover:border-slate-600 pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-100 max-w-[16rem] truncate focus:outline-none focus:border-cyan-500/60"
      >
        <optgroup label={t('radiant')}>
          {radiant.map((p) => (
            <option key={p.playerSlot} value={p.playerSlot}>
              {label(p)}
            </option>
          ))}
        </optgroup>
        <optgroup label={t('dire')}>
          {dire.map((p) => (
            <option key={p.playerSlot} value={p.playerSlot}>
              {label(p)}
            </option>
          ))}
        </optgroup>
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 pointer-events-none text-slate-400" aria-hidden />
    </label>
  );
};
