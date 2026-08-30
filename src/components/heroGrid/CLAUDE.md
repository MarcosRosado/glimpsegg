# src/components/heroGrid/

As duas telas da feature de layout espelho de heróis. Montadas pelo `App.tsx` conforme o
`panelView` (`HERO_GRID_PANEL` / `HERO_GRID_MIRROR`), e só quando a feature está habilitada.
A decisão do *que* escrever mora em `src/utils/heroGrid/`; o I/O, em `electron/heroGrid/`.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `HeroGridTab.tsx` | Painel de diagnóstico e ação: ranking por grupo, sincronização manual, histórico e restauração de backup. É onde o jogador vê o que será escrito **antes** da escrita | `App.tsx` |
| `HeroGridMirrorScreen.tsx` | Réplica visual do que **já está gravado** no arquivo do jogador, com os grupos nas posições do jogo (`buildMirrorCanvas`, `MIRROR_UNIT_SCALE`) | `App.tsx` |
| `labels.ts` | Tabelas enum → chave i18n compartilhadas: `CRITERION_LABEL`, `NO_DATA_LABEL`, `DAYS_SINCE_LABEL`, `metaSourceKey` | as duas telas, `dashboard/ProfileHeader.tsx`, e o teste de `utils/heroGrid/heroTooltip.ts` |
| `primitives.tsx` | `Notice`, `Chip` e `LayoutRef` — as três peças de UI que as duas telas dividem | as duas telas, `App.tsx` (`Notice`) |

## Regras locais

- **A réplica desenha o snapshot, nunca o resultado em memória.** A fonte é
  `sync.mirrorSnapshot`, persistido só quando os bytes chegaram ao disco — e não `sync.groups`,
  que existe mesmo quando a escrita foi **recusada**. Desenhar o espelho recusado com a moldura
  de "este é o seu layout" é a forma mais convincente de inventar dado que a feature alcança:
  o jogador abriria o Dota esperando a ordem que viu aqui. Divergiu, a tela diz que a última
  tentativa não foi gravada.
- **Identidade de layout é POSIÇÃO, nunca nome** — `LayoutRef` mostra nome *e* índice
  (`heroGridLayoutPosition`). Ver a seção do espelho em [../../../CLAUDE.md](../../../CLAUDE.md).
- **`useHeroGridSync` é instância única**, criada no `App.tsx` e passada na prop `sync` para
  `HeroGridTab` e `HeroGridMirrorScreen` (o `SettingsModal` recebe só callbacks presos a ela). Duas instâncias = dois timers disputando a mesma
  sincronização; a trava do main recusaria a segunda com `WRITE_IN_PROGRESS` e o jogador veria
  uma falha inventada pela própria UI.
- **O winrate é o GERAL do herói**, e a tela é obrigada a dizer isso: não há como inferir a
  função de um grupo pelo nome, então a ordem do grupo de suportes não é "melhores suportes".
  Com `bracketIsPlayerSpecific === false` a tela diz "média geral", nunca "no seu ranque".
- **O espelho é gerado** — editar à mão é trabalho perdido na sincronização seguinte, e a tela
  avisa antes.
- `labels.ts` é `Record<enum, TranslationKey>` **com literais explícitos**. Chave montada em
  runtime some do teste de chave órfã e, com `strict: false`, do `tsc -b` junto.
- Tipografia na escala `rem` do app (`text-xs`), nunca px absoluto: `text-[11px]` não escala
  com o `font-size` do `html` e nasce ~17% menor que o vizinho.
- `.tsx` não tem teste (vitest em `environment: 'node'`). Formatação testável mora em
  `utils/heroGrid/tabFormat.ts`, `mirrorLayout.ts` e `heroTooltip.ts`.

## Ao sair um patch

Nada aqui muda por patch de Dota. Estas telas não conhecem herói nem item: nome e retrato saem
de `getHero`, que sempre devolve fallback, e o winrate vem das fontes de meta em tempo de
sincronização. Herói novo entra em `src/constants/heroes.ts`.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../../CLAUDE.md](../../CLAUDE.md) ·
[electron/heroGrid/CLAUDE.md](../../../electron/heroGrid/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../../docs/PATCH-CHECKLIST.md)
