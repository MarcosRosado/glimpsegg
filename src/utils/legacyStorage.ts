/**
 * Chaves do `localStorage` no caminho browser (`npm run dev`, sem `window.api`) e a migracao
 * dos nomes herdados da STRATZ (renomes do §6 de docs/PROPOSTA-V2.md, 2026-11-19).
 *
 * `stratz_steam_id` -> `glimpsegg_steam_id` e `stratz_profile_history` ->
 * `glimpsegg_profile_history`. A migracao COPIA, uma vez: so quando a chave nova esta ausente e
 * a antiga presente. A antiga fica onde esta — mesma regra do arquivo de config do Electron
 * (`electron/configMigration.cjs`), e pelo mesmo motivo de nao apagar o que o usuario tinha.
 *
 * `stratz_api_key` nao é migrada nem apagada: o app nao le, nao grava e nao apaga o token
 * (doutrina desde que a STRATZ saiu).
 *
 * `app_language` e as chaves `hero_grid_*` nunca tiveram o nome antigo e nao mudam.
 */

export const LOCAL_STORAGE_KEYS = {
  steamId: 'glimpsegg_steam_id',
  profileHistory: 'glimpsegg_profile_history',
} as const;

/** Chave nova -> chave herdada que ela substitui. */
export const LEGACY_LOCAL_STORAGE_KEYS: Record<(typeof LOCAL_STORAGE_KEYS)[keyof typeof LOCAL_STORAGE_KEYS], string> = {
  glimpsegg_steam_id: 'stratz_steam_id',
  glimpsegg_profile_history: 'stratz_profile_history',
};

/** O que a migracao precisa do `Storage` — permite testar sem DOM. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Copia as chaves herdadas para as novas, uma vez. Devolve as chaves novas que foram
 * preenchidas. Nunca lanca: `localStorage` pode jogar (janela privada, cota, dado bloqueado),
 * e migracao que falha nao pode impedir o app de abrir — ele so nasce sem a conta salva.
 */
export function migrateLegacyLocalStorage(storage: KeyValueStorage | null | undefined): string[] {
  const migrated: string[] = [];
  if (!storage) return migrated;
  for (const [next, legacy] of Object.entries(LEGACY_LOCAL_STORAGE_KEYS)) {
    try {
      if (storage.getItem(next) !== null) continue;
      const old = storage.getItem(legacy);
      if (old === null) continue;
      storage.setItem(next, old);
      migrated.push(next);
    } catch {
      // segue para a proxima chave
    }
  }
  return migrated;
}
