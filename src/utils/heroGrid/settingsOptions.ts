import type { ConfigRef, HeroGridFile, SteamAccountCandidate } from '../../types/heroGrid';

/**
 * Decisoes puras do bloco de configuracoes da feature de layout espelho
 * (specs/001-meta-hero-grid, T033/T034).
 *
 * Existe separado do `SettingsModal.tsx` por um motivo pratico: o vitest deste projeto roda
 * em `environment: 'node'` e nao tem DOM, logo nenhum `.tsx` é testavel. Toda escolha que
 * um teste precisa exercitar — qual conta pre-selecionar, como rotular dois layouts
 * homonimos, qual caminho de arquivo usar — mora aqui, e o componente fica so com o JSX.
 *
 * ## Identidade por POSICAO, nunca por nome (N-1..N-7 de `contracts/hero-grid-file.md`)
 *
 * Nenhuma funcao deste modulo localiza layout por `config_name`. O Dota 2 permite dois
 * layouts com o mesmo nome e permite renomear a qualquer momento; procurar por nome perde o
 * rastro do espelho num rename e cria um segundo na sincronizacao seguinte (FR-008c). Por
 * isso `LayoutOption.index` é a identidade e `name` é rotulo, e por isso
 * `isNameAmbiguous` existe: a lista tem de deixar o jogador distinguir dois homonimos, e o
 * unico jeito honesto é mostrar a posicao e o tamanho de cada um.
 */

/** Nome de arquivo exigido pelo contrato da Valve. Rotulo unico, sem concatenacao solta. */
export const GRID_FILE_BASENAME = 'hero_grid_config.json';

/** Uma linha da lista de layouts de origem. */
export interface LayoutOption {
  /** A identidade (N-1): posicao no array `configs`. */
  index: number;
  /** Ultimo nome conhecido. So rotulo. */
  name: string;
  /** Quantidade de grupos — parte do que distingue dois layouts homonimos. */
  groupCount: number;
  /** `true` => existe outro layout na colecao com este mesmo nome. */
  isNameAmbiguous: boolean;
}

/**
 * `HeroGridFile` -> lista exibivel, preservando a ordem do arquivo.
 *
 * Config malformado (sem `categories`, ou `categories` nao-array) NAO é descartado: ele
 * ocupa uma posicao no array, e omitir a linha faria as posicoes exibidas deixarem de
 * corresponder aos `index` reais — que é exatamente o erro que a identidade por posicao
 * existe para evitar. Ele aparece com `groupCount: 0`.
 */
export function buildLayoutOptions(file: HeroGridFile | null | undefined): LayoutOption[] {
  if (!file || !Array.isArray(file.configs)) return [];

  const nameCount = new Map<string, number>();
  for (const config of file.configs) {
    const name = typeof config?.config_name === 'string' ? config.config_name : '';
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
  }

  return file.configs.map((config, index) => {
    const name = typeof config?.config_name === 'string' ? config.config_name : '';
    return {
      index,
      name,
      groupCount: Array.isArray(config?.categories) ? config.categories.length : 0,
      isNameAmbiguous: (nameCount.get(name) ?? 0) > 1,
    };
  });
}

export function findLayoutOption(
  options: LayoutOption[],
  index: number | null | undefined
): LayoutOption | null {
  if (typeof index !== 'number') return null;
  return options.find((option) => option.index === index) ?? null;
}

/**
 * FR-005: qual conta Steam vem pre-selecionada.
 *
 * Precedencia, e o motivo de cada degrau:
 * 1. a que o jogador já escolheu antes (`savedSteamId3`) — escolha explicita ganha de tudo;
 * 2. `isConfiguredProfile` — o `steamAccountId` que o app já usa é o palpite mais provavel;
 * 3. candidata unica — nao ha o que escolher;
 * 4. a primeira que já TEM arquivo de grid — as outras exigiriam criar um grid no Dota;
 * 5. `null`, e a UI pede a escolha.
 *
 * O degrau 4 nao vale como "achou": se nenhuma tem arquivo, devolve `null` em vez de chutar
 * a primeira, porque pre-selecionar uma conta sem grid faria a tela parecer configurada
 * quando nao ha nada para espelhar (I-27 é estado apresentavel, nao erro — mas tambem nao é
 * escolha).
 */
export function preselectAccount(
  candidates: SteamAccountCandidate[] | null | undefined,
  savedSteamId3?: string | null
): SteamAccountCandidate | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  if (savedSteamId3) {
    const saved = candidates.find((candidate) => candidate?.steamId3 === savedSteamId3);
    if (saved) return saved;
  }

  const configured = candidates.find((candidate) => candidate?.isConfiguredProfile);
  if (configured) return configured;

  if (candidates.length === 1) return candidates[0];

  return candidates.find((candidate) => candidate?.gridFileExists) ?? null;
}

/**
 * FR-006: caminho manual vence a deteccao automatica.
 *
 * Ele existe para os casos que a varredura de raizes nao alcanca — Steam em disco
 * secundario, Flatpak e Snap fora das raizes conhecidas — então quando o jogador digitou
 * um caminho, é esse que vale, mesmo que uma conta tenha sido detectada.
 */
export function resolveGridFilePath(
  account: SteamAccountCandidate | null | undefined,
  manualPath?: string | null
): string | null {
  const manual = typeof manualPath === 'string' ? manualPath.trim() : '';
  if (manual.length > 0) return manual;
  const detected = account?.gridFilePath;
  return typeof detected === 'string' && detected.trim().length > 0 ? detected.trim() : null;
}

/**
 * Checagem de FORMATO, para dar retorno imediato ao jogador enquanto ele digita.
 *
 * **Nao é validacao de seguranca.** A guarda real é S-1 em `electron/heroGrid/pathGuard.cjs`,
 * chamada pelo `main.cjs`: o renderer é codigo que um XSS alcanca, e quem contorna esta
 * funcao fala com o IPC direto. Ela nao decide nada — só evita mandar ao main um caminho
 * que obviamente nao é o arquivo da Valve.
 */
export function looksLikeGridFilePath(path: string | null | undefined): boolean {
  if (typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (trimmed.length === 0) return false;
  // Aceita separador dos dois mundos: o campo é digitado a mao, e Windows usa `\`.
  const basename = trimmed.split(/[\\/]/).pop() ?? '';
  return basename === GRID_FILE_BASENAME;
}

/**
 * N-3 / N-4: a referencia de origem que a tela deve mostrar.
 *
 * - posicao guardada existe => vale, com o nome ATUALIZADO a partir do arquivo. Nome
 *   diferente do guardado é rename, nao layout novo (N-3);
 * - posicao guardada nao existe mais => `null`, e a UI pede nova origem. Nao adivinha por
 *   nome (N-4) — o layout homonimo que sobrou pode ser outro layout;
 * - nada guardado e um unico layout => pre-seleciona (FR-005a permite o MAY, e a
 *   confirmacao de FR-003 continua sendo exigida antes de qualquer escrita);
 * - nada guardado e varios layouts => `null`, o jogador escolhe.
 */
export function preselectSourceRef(
  options: LayoutOption[],
  saved: ConfigRef | null | undefined
): ConfigRef | null {
  if (!Array.isArray(options) || options.length === 0) return null;

  if (saved && typeof saved.index === 'number') {
    const match = findLayoutOption(options, saved.index);
    return match ? { index: match.index, name: match.name } : null;
  }

  if (options.length === 1) return { index: options[0].index, name: options[0].name };
  return null;
}
