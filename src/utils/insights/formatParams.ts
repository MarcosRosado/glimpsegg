import { Language } from '../../i18n/translations';
import { formatDuration } from '../dotaFormatters';

/**
 * Formata os params CRUS emitidos pelo motor para exibicao, respeitando o locale.
 *
 * O `t()` faz `String(paramVal)` puro, entao sem esta etapa um numero como 2553 sairia
 * "2553" e qualquer `toLocaleString()` espalhado pelos textos pegaria o locale do
 * SISTEMA — um usuario pt-BR numa maquina en-US veria "2,553" em vez de "2.553".
 * Centralizar aqui tambem é o que mantem o motor puro e testavel.
 *
 * Convencao de sufixo:
 *   *Sec -> relogio de partida (m:ss)
 *   *Min -> minuto inteiro
 *   pct / winRate / share -> uma casa decimal quando fracionario
 */
export function formatParams(
  params: Record<string, number | string>,
  language: Language,
): Record<string, string | number> {
  const nf = new Intl.NumberFormat(language);
  const out: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      out[key] = value;
      continue;
    }

    if (key.endsWith('Sec')) {
      out[key] = formatDuration(value);
      continue;
    }
    if (key.endsWith('Min')) {
      out[key] = String(Math.round(value));
      continue;
    }
    if (Number.isInteger(value)) {
      out[key] = nf.format(value);
      continue;
    }
    out[key] = nf.format(Math.round(value * 10) / 10);
  }

  return out;
}
