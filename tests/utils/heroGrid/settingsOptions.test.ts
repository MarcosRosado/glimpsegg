import { describe, expect, it } from 'vitest';
import type { HeroGridFile, SteamAccountCandidate } from '../../../src/types/heroGrid';
import {
  buildLayoutOptions,
  findLayoutOption,
  GRID_FILE_BASENAME,
  looksLikeGridFilePath,
  preselectAccount,
  preselectSourceRef,
  resolveGridFilePath,
} from '../../../src/utils/heroGrid/settingsOptions';

/**
 * Testes das decisoes puras do bloco de configuracoes (T033/T034).
 *
 * O caso que importa mais aqui é o dos layouts HOMONIMOS: é ele que justifica a lista
 * mostrar posicao e quantidade de grupos em vez de so o nome. O grid publicado pelo Dota 2
 * Pro Tracker repete `Best with` sete vezes num unico layout — nome repetido é caso real.
 */

function config(name: string, groups: number) {
  return {
    config_name: name,
    categories: Array.from({ length: groups }, (_, i) => ({
      category_name: `g${i}`,
      x_position: 0,
      y_position: 0,
      width: 10,
      height: 10,
      hero_ids: [1],
    })),
  };
}

function file(...configs: ReturnType<typeof config>[]): HeroGridFile {
  return { version: 3, configs };
}

function account(
  steamId3: string,
  extra: Partial<SteamAccountCandidate> = {}
): SteamAccountCandidate {
  return {
    steamId3,
    steamRoot: '/home/p/.steam/steam',
    gridFilePath: `/home/p/.steam/steam/userdata/${steamId3}/570/remote/cfg/${GRID_FILE_BASENAME}`,
    gridFileExists: true,
    isConfiguredProfile: false,
    ...extra,
  };
}

describe('buildLayoutOptions', () => {
  it('devolve lista vazia para arquivo ausente ou `configs` invalido', () => {
    expect(buildLayoutOptions(null)).toEqual([]);
    expect(buildLayoutOptions(undefined)).toEqual([]);
    expect(buildLayoutOptions({ version: 3, configs: null } as unknown as HeroGridFile)).toEqual([]);
  });

  it('preserva a ordem do arquivo e conta os grupos', () => {
    const options = buildLayoutOptions(file(config('Solo', 3), config('Dupla', 8)));
    expect(options).toEqual([
      { index: 0, name: 'Solo', groupCount: 3, isNameAmbiguous: false },
      { index: 1, name: 'Dupla', groupCount: 8, isNameAmbiguous: false },
    ]);
  });

  it('marca nome repetido nas DUAS ocorrencias, mantendo as posicoes distintas', () => {
    const options = buildLayoutOptions(
      file(config('Meta Espelho', 4), config('Outro', 1), config('Meta Espelho', 8))
    );
    expect(options.map((o) => o.isNameAmbiguous)).toEqual([true, false, true]);
    // O que distingue os dois homonimos na lista: posicao e quantidade de grupos.
    expect(options[0]).toMatchObject({ index: 0, groupCount: 4 });
    expect(options[2]).toMatchObject({ index: 2, groupCount: 8 });
  });

  it('nao descarta config malformado: a posicao exibida tem de casar com o `index` real', () => {
    const options = buildLayoutOptions({
      version: 3,
      configs: [{ config_name: 'Quebrado' }, config('Bom', 2)],
    } as unknown as HeroGridFile);
    expect(options).toHaveLength(2);
    expect(options[0]).toEqual({ index: 0, name: 'Quebrado', groupCount: 0, isNameAmbiguous: false });
    expect(options[1].index).toBe(1);
  });
});

describe('preselectAccount', () => {
  it('sem candidata devolve null', () => {
    expect(preselectAccount([], 'x')).toBeNull();
    expect(preselectAccount(null, 'x')).toBeNull();
  });

  it('escolha salva ganha do perfil configurado', () => {
    const chosen = preselectAccount(
      [account('111', { isConfiguredProfile: true }), account('222')],
      '222'
    );
    expect(chosen?.steamId3).toBe('222');
  });

  it('sem escolha salva, o perfil já configurado no app é o palpite', () => {
    const chosen = preselectAccount([account('111'), account('222', { isConfiguredProfile: true })]);
    expect(chosen?.steamId3).toBe('222');
  });

  it('escolha salva que nao existe mais na maquina cai para o proximo degrau', () => {
    const chosen = preselectAccount([account('111', { isConfiguredProfile: true })], '999');
    expect(chosen?.steamId3).toBe('111');
  });

  it('candidata unica é pre-selecionada mesmo sem arquivo de grid (I-27)', () => {
    const chosen = preselectAccount([account('111', { gridFileExists: false })]);
    expect(chosen?.steamId3).toBe('111');
  });

  it('varias candidatas sem pista: escolhe a primeira que já tem grid', () => {
    const chosen = preselectAccount([
      account('111', { gridFileExists: false }),
      account('222', { gridFileExists: true }),
    ]);
    expect(chosen?.steamId3).toBe('222');
  });

  it('varias candidatas e nenhuma com grid: devolve null em vez de chutar', () => {
    expect(
      preselectAccount([
        account('111', { gridFileExists: false }),
        account('222', { gridFileExists: false }),
      ])
    ).toBeNull();
  });
});

describe('resolveGridFilePath', () => {
  it('caminho manual vence a deteccao automatica (FR-006)', () => {
    const manual = `/mnt/hd2/Steam/userdata/1/570/remote/cfg/${GRID_FILE_BASENAME}`;
    expect(resolveGridFilePath(account('111'), manual)).toBe(manual);
  });

  it('manual vazio ou so espaco nao conta como valor', () => {
    const detected = account('111').gridFilePath;
    expect(resolveGridFilePath(account('111'), '   ')).toBe(detected);
    expect(resolveGridFilePath(account('111'), null)).toBe(detected);
  });

  it('sem conta e sem manual devolve null', () => {
    expect(resolveGridFilePath(null, '')).toBeNull();
  });
});

describe('looksLikeGridFilePath', () => {
  it('aceita o nome exigido, com separador de qualquer plataforma', () => {
    expect(looksLikeGridFilePath(`/a/b/${GRID_FILE_BASENAME}`)).toBe(true);
    expect(looksLikeGridFilePath(`C:\\Steam\\cfg\\${GRID_FILE_BASENAME}`)).toBe(true);
  });

  it('recusa diretorio, nome diferente e vazio', () => {
    expect(looksLikeGridFilePath('/a/b/cfg')).toBe(false);
    expect(looksLikeGridFilePath('/a/b/hero_grid.json')).toBe(false);
    expect(looksLikeGridFilePath('')).toBe(false);
    expect(looksLikeGridFilePath(null)).toBe(false);
  });
});

describe('preselectSourceRef', () => {
  const options = buildLayoutOptions(file(config('A', 2), config('B', 3)));

  it('posicao guardada com nome novo é RENAME: mantem o index, atualiza o rotulo (N-3)', () => {
    expect(preselectSourceRef(options, { index: 1, name: 'nome antigo' })).toEqual({
      index: 1,
      name: 'B',
    });
  });

  it('posicao guardada que nao existe mais devolve null, sem adivinhar por nome (N-4)', () => {
    expect(preselectSourceRef(options, { index: 7, name: 'A' })).toBeNull();
  });

  it('layout unico é pre-selecionado (FR-005a)', () => {
    const single = buildLayoutOptions(file(config('Unico', 5)));
    expect(preselectSourceRef(single, null)).toEqual({ index: 0, name: 'Unico' });
  });

  it('varios layouts e nada guardado: o jogador escolhe', () => {
    expect(preselectSourceRef(options, null)).toBeNull();
  });
});

describe('findLayoutOption', () => {
  const options = buildLayoutOptions(file(config('A', 1), config('A', 2)));

  it('localiza por POSICAO, nao por nome', () => {
    expect(findLayoutOption(options, 1)).toMatchObject({ index: 1, groupCount: 2 });
    expect(findLayoutOption(options, 9)).toBeNull();
    expect(findLayoutOption(options, null)).toBeNull();
  });
});
