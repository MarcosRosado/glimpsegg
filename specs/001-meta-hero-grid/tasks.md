---

description: "Task list — Layout espelho de heróis ordenado por winrate do meta"
---

# Tasks: Layout espelho de heróis ordenado por winrate do meta

**Input**: Design documents from `specs/001-meta-hero-grid/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **incluídos e obrigatórios.** Não é preferência de estilo — o `CLAUDE.md` declara que os
testes e o `tsc -b` são "o que realmente segura o projeto" com `strict: false`, o release para em
teste vermelho, e esta feature escreve num arquivo insubstituível do usuário. As invariantes I-1 a
I-27 do `data-model.md` são a especificação dos testes.

**Organization**: agrupadas por user story. Cada fase é um incremento entregável e testável sozinho.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1..US4, conforme `spec.md`
- Caminhos exatos em cada tarefa

## Path Conventions

Este projeto **não tem diretório `tests/`**. Teste mora ao lado do fonte, e o `vitest.config.ts` usa
`include: ['src/**/*.test.ts', 'electron/**/*.test.cjs']` com `environment: 'node'`. Não há ambiente
de DOM: nenhum `.tsx` é testado, e é isso que obriga a lógica a morar em módulos puros.

- Lógica pura e serviços: `src/utils/heroGrid/`, `src/services/heroGrid/` — testes `*.test.ts`
- I/O privilegiado: `electron/heroGrid/` — testes `*.test.cjs`
- Fixtures: `src/services/__fixtures__/`

O segundo padrão do `include` foi acrescentado por esta feature, e é a correção de um problema que a
análise pegou: a guarda que impede alterar o layout do jogador **tem** de rodar no main, comparando os
bytes que vão ao disco, e antes disso ela seria a única coisa do app sem teste. A regra do projeto
passa a ser: *main é I/O burro, e o pouco que ele decide é testado onde ele decide.*

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: tipos, fixtures e andaimes que todo o resto usa. Nada de rede, nada de escrita.

- [X] T001 [P] Criar `src/types/heroGrid.ts` com `HeroGridFile`, `HeroGridConfig`, `HeroGridCategory`, `MetaSource`, `MetaWinrate`, `PersonalWinrate`, `HeroScore`, `RankingCriterion`, `ConfigRef`, `MirrorResult`, `MirrorGroupReport`, `SyncState`, `SyncRecord`, `SyncFreshness`, `SteamAccountCandidate`, `HeroGridPreferences`, conforme `data-model.md` (comentários em pt-BR explicando o *porquê* de cada invariante embutida)
- [X] T002 [P] Criar fixture `src/services/__fixtures__/hero-grid-real.json` a partir do `hero_grid_config.json` real da máquina, **anonimizada** (renomear os grupos), preservando as características que pegam bug: 8 grupos, coordenadas fracionárias de 6 decimais, 128 entradas com um herói repetido em dois grupos, `version: 3`. **O que esta fixture NÃO cobre** (e por isso TX-A existe): tem um único layout, nenhum nome repetido, nenhum grupo vazio, e contém o catálogo inteiro de heróis — ou seja, é o caso *atípico*
- [X] T003 [P] Criar a **anti-fixture** `src/services/__fixtures__/hero-grid-adverse.json`, sintética, desenhada para ser o oposto do grid real: **3 layouts** (dois deles com o *mesmo* `config_name`), um layout com **duas categorias de nome idêntico** (caso real — o grid do D2PT repete `Best with` sete vezes), um layout com **uma única categoria**, uma categoria **vazia**, poucos heróis por grupo (a maioria dos heróis fora do layout), um herói em três grupos, e `version` diferente de 3. É a fixture que prova que a feature não foi escrita só para o grid do autor
- [X] T004 [P] Estender `src/types/electron.d.ts`: acrescentar as chaves `heroGrid*` em `AppConfig` e a interface `HeroGridApi` em `ElectronApi` conforme `contracts/ipc-hero-grid.md` e `contracts/config-keys.md`
- [X] T005 [P] Criar `src/utils/heroGrid/preferences.ts` com os defaults de `contracts/config-keys.md` (`heroGridEnabled: false` e demais), lendo chave ausente como default — é o mecanismo que garante FR-001 em atualização de versão anterior
- [X] T006 [P] Criar `src/utils/heroGrid/preferences.test.ts` provando que config vazio devolve `enabled: false` e `criterion: 'COMBINED'`, e que chave desconhecida não quebra a leitura

**Checkpoint**: tipos e fixture prontos; nada executa ainda.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: localizar e **ler** o arquivo de grids, com a ponte IPC nos dois caminhos de rede.
Ainda **sem escrever nada** e **sem consultar fonte de meta**.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T007 Criar `electron/heroGrid/steamPaths.cjs`: raízes por plataforma conforme `contracts/hero-grid-file.md`, **dedupe por `realpath`** (na máquina real três raízes apontam para o mesmo diretório por symlink), filtro de pseudo-conta (`0` e `anonymous` existem e não são contas), montagem do caminho `userdata/<id3>/570/remote/cfg/hero_grid_config.json` sem varrer o disco
- [X] T008 [P] Criar `electron/heroGrid/steamPaths.test.cjs` cobrindo I-25, I-26 e I-27: nenhum candidato duplicado depois do `realpath` (as três raízes do Linux apontam para o mesmo diretório na máquina real), `0` e `anonymous` nunca aparecem como conta, e `gridFileExists: false` é devolvido como estado normal em vez de erro
- [X] T009 Criar `electron/heroGrid/gridFile.cjs` com **apenas a leitura** nesta fase: `readGridFile(path)` devolvendo `{ exists, file, raw }`, sem criar arquivo quando ausente (L-1) e sem sobrescrever em JSON inválido (L-2)
- [X] T010 Registrar em `electron/main.cjs` os handlers `grid:list-accounts` e `grid:read`, com a validação de caminho S-1 de `contracts/ipc-hero-grid.md` (o renderer não pode fazer o main ler caminho arbitrário)
- [X] T011 Expor `window.api.heroGrid` em `electron/preload.cjs` com `listAccounts` e `readFile`
- [X] T012 Criar `src/services/heroGrid/heroGridBridge.ts` testando `window.api` e devolvendo indisponível explícito no caminho browser — nunca simular sucesso
- [X] T013 [P] Criar `src/utils/heroGrid/valveJson.ts`: serializador puro que reproduz o estilo do arquivo (tabulação, 6 decimais nos floats, `[` em linha própria), satisfazendo FR-007c
- [X] T014 [P] Criar `src/utils/heroGrid/valveJson.test.ts` provando **round-trip**: `parse(serialize(fixture))` é igual em profundidade à fixture, `serialize` da fixture reproduz o texto original byte a byte quando o conteúdo não mudou, e `version` é preservado do arquivo lido em vez de fixado (I-3)
- [X] T015 [P] Acrescentar em `src/i18n/translations.ts` o grupo base de chaves da feature nos **dois** dicionários (bloco de configurações, estados de arquivo ausente / JSON inválido / sem permissão), com as tabelas enum→texto como `Record<..., TranslationKey>` de literais explícitos

**Checkpoint**: o app localiza a conta, lê o grid e sabe reserializá-lo sem perder nada. Rodar
`npm test` e `npm run build` — o gate `_localeParity` já vale a partir de T015.

---

## Phase 3: User Story 1 — Ligar a feature e ganhar um layout espelho ordenado (Priority: P1) 🎯 MVP

**Goal**: marcar a opção, escolher o layout de origem, e o app acrescenta um layout espelho ordenado
sem tocar no original.

**Independent Test**: com a feature desmarcada, marcar, escolher origem e sincronizar; verificar que
(a) o layout de origem está igual em profundidade ao que era antes, (b) existe um layout novo com os
mesmos grupos, nomes e conjunto de heróis por grupo, (c) a ordem de cada grupo do espelho corresponde
ao ranking exibido, (d) nenhum outro layout mudou. O bloco Python do Nível 4 do `quickstart.md` faz
essa verificação.

**Escopo de fonte nesta fase**: **só OpenDota**. Ela é a fonte primária (FR-015), é pública e não
exige token, então o MVP fecha sem configuração nenhuma. A STRATZ e a degradação entre fontes entram
na US3.

### Tests for User Story 1 ⚠️

> Escrever antes da implementação e confirmar que falham.

- [X] T016 [P] [US1] Criar `src/utils/heroGrid/ranking.test.ts` cobrindo I-15 a I-19: `breakdown` completo quando há nota, `personalWeight` monotônico em `games` e zero quando `games === 0`, `COMBINED` sem pessoal virando meta puro (não `null`), e amostra pequena não superando amostra grande com vantagem comprovada
- [X] T017 [P] [US1] Criar `src/utils/heroGrid/mirrorBuilder.test.ts` contra `hero-grid-real.json`, cobrindo I-5 a I-10: mesmo número de grupos, nomes e coordenadas idênticos, mesmo conjunto de heróis por grupo, herói repetido presente nos dois grupos com a mesma nota (I-8), heróis sem dado no fim do grupo com ordenação estável (I-9), idempotência (I-10), e **no máximo um espelho** por origem identificado por `config_name` (I-4)
- [X] T018 [US1] Acrescentar a `src/utils/heroGrid/mirrorBuilder.test.ts` (criado em T017; não paralelizável com ele) o caso de **guarda**: se o construtor receber um espelho cujo `config_name` colide com um config que não é o espelho registrado, ele recusa em vez de sobrescrever (FR-008e)

- [X] T019 [P] [US1] Criar `electron/heroGrid/gridFile.test.cjs` cobrindo I-1 e I-2, as invariantes mais importantes da feature: dado um texto a gravar em que o config de origem foi alterado, a guarda **aborta com `SOURCE_MUTATED` e não grava**; dado um texto em que **qualquer outro layout, em qualquer posição**, foi alterado, aborta igual (E-4); e dado um texto com número de configs diferente do esperado, aborta com `CONFIG_COUNT_MISMATCH`. Usar a anti-fixture de T003, porque com um único layout o caso E-4 não existe. O teste roda no main porque é lá que a guarda compara os bytes que vão ao disco
- [X] T020 [US1] Acrescentar a `src/utils/heroGrid/mirrorBuilder.test.ts` (mesmo arquivo de T017 e T018; sequencial em relação a eles) o caso de **re-espelhamento** (FR-008d): com a origem alterada entre duas chamadas (grupo renomeado, herói movido de grupo, grupo criado e grupo removido), o espelho passa a refletir a nova estrutura e `structureChanged` vem `true`
- [X] T021 [US1] Acrescentar a `src/utils/heroGrid/mirrorBuilder.test.ts` os casos que **só a anti-fixture exercita**: I-2 (com 3 layouts, os outros dois ficam intactos — invariante que a fixture de um layout só passa por vazio), I-4a (duas categorias de mesmo nome espelhadas e ordenadas independentemente), I-4b (o espelho vai para o fim de `configs` e a posição dos layouts do jogador não muda), categoria vazia, layout de nome duplicado, e a maioria dos heróis caindo em `outsideSource`
- [X] T022 [US1] Acrescentar a `src/utils/heroGrid/mirrorBuilder.test.ts` o caso de **rename** (FR-008h, N-3): com o espelho ou a origem renomeados no jogo entre duas chamadas, o app reconhece os mesmos layouts pela posição, atualiza o `name` guardado e **não** cria um segundo espelho. Sem este teste, FR-008c passa a depender de o jogador nunca renomear nada

### Implementation for User Story 1

- [X] T023 [P] [US1] Criar `src/services/heroGrid/openDotaWinrates.ts`: reaproveitar `fetchOpenDotaHeroStats()` de `src/services/opendota.ts`, somar os buckets `N_pick`/`N_win` conforme o mapa de `contracts/meta-sources.md`, e devolver `MetaWinrate[]` com `source: 'OPENDOTA_BRACKET'`, `matchCount` e `patch`. Bucket com `pick === 0` é ausência, **não** 0%. Usar `statsCache` com a chave `['gridmeta','od',bracket]` do contrato: o `heroStats` é o maior payload da feature (164 KB, medido) e a invalidação por patch do `statsCache` é o que cumpre FR-021
- [X] T024 [P] [US1] Criar `src/services/heroGrid/personalWinrates.ts`: `GET players/{account_id}/heroes` pelos dois caminhos (`window.api.openDotaFetch` e `fetch` direto), devolvendo `PersonalWinrate[]` com `games` e `wins`. Cache de TTL curto (1h) — histórico do jogador muda todo dia, ao contrário dos agregados de meta
- [X] T025 [US1] Criar `src/utils/heroGrid/ranking.ts`: nota combinada usando `wilsonLowerBound` de `src/utils/insights/wilson.ts`, com a constante de encolhimento **`K = 20`** nomeada no topo do módulo junto do raciocínio (20 jogos é onde o histórico do jogador passa a pesar tanto quanto o meta — tabela da curva em `contracts/meta-sources.md § 4`), e `breakdown` carregando as duas parcelas e o peso (FR-030b — nota sem `breakdown` não é exibível). Depende de T023, T024
- [X] T026 [US1] Criar `src/utils/heroGrid/mirrorBuilder.ts`: recebe o `HeroGridFile` lido, `source: ConfigRef`, `mirror: ConfigRef | null` e os `HeroScore[]`; devolve `MirrorResult` com a origem **intocada** e o espelho novo ou substituído. **Identidade por posição, nunca por nome** (regras N-1 a N-7 de `contracts/hero-grid-file.md`): categoria referenciada por índice, espelho novo acrescentado no fim de `configs`, e nome tratado como rótulo. Copia `category_name`, `x_position`, `y_position`, `width`, `height` e o conjunto de `hero_ids`, alterando só a ordem. Preserva campo desconhecido de config e de categoria (L-4). Depende de T025
- [X] T027 [US1] Implementar em `src/utils/heroGrid/mirrorBuilder.ts` a comparação entre a estrutura da origem e a do espelho existente, produzindo `structureChanged` e reconstruindo o espelho a partir da estrutura nova (FR-008d). Sem isso a feature serve um grid que não corresponde mais ao do jogador — é o risco R-002a. Depende de T026
- [X] T028 [US1] Acrescentar a escrita em `electron/heroGrid/gridFile.cjs`: backup **byte a byte** para `hero_grid_config.glimpse.bak.<epoch>` (E-1), `JSON.parse` do texto recebido e **guarda de igualdade profunda por posição** — compara o array `configs` inteiro exceto `expectedMirrorIndex`, e valida `expectedConfigCount` — abortando com `SOURCE_MUTATED`, `CONFIG_COUNT_MISMATCH` ou `SOURCE_INDEX_GONE` (E-3, E-4, FR-007a, FR-007b), escrita atômica tmp+`fsync`+`rename` (E-2), poda mantendo 5 backups (E-6), trava de escrita única (E-5)
- [X] T029 [P] [US1] Criar `electron/heroGrid/dotaProcess.cjs`: `ps -A -o comm=` no Linux/macOS e `tasklist /FO CSV /NH` no Windows, casando **nome de executável exato** (`dota2` / `dota2.exe`). Casar substring de linha de comando produz falso positivo permanente — foi o erro real encontrado na pesquisa
- [X] T030 [US1] Registrar em `electron/main.cjs` os handlers `grid:write`, `grid:restore`, `grid:list-backups` e `grid:is-dota-running`, e expor os métodos correspondentes em `electron/preload.cjs`. Depende de T028, T029
- [X] T031 [US1] Estender `src/services/heroGrid/heroGridBridge.ts` com `writeFile`, `restoreBackup`, `listBackups` e `isDotaRunning`, mantendo o caminho browser explicitamente indisponível para escrita
- [X] T032 [US1] Criar `src/hooks/useHeroGridSync.ts` com a orquestração de **uma** sincronização manual: ler grid → buscar OpenDota e pessoal → ranquear → construir espelho → serializar com `valveJson` → gravar via ponte. Sem agendamento nesta fase. Depende de T023–T031
- [X] T033 [US1] Acrescentar o bloco da feature em `src/components/settings/SettingsModal.tsx`: toggle **desmarcado por padrão**, seleção de conta Steam (pré-selecionando a que casa com o `steamAccountId` já configurado), seleção do layout de origem **por posição, com o nome como rótulo** (layouts de nome repetido têm de ser distinguíveis na lista — mostrar posição e quantidade de grupos), nome do espelho, e o diálogo de confirmação explícita de FR-003 antes da primeira escrita
- [X] T034 [US1] Acrescentar ao `src/components/settings/SettingsModal.tsx` o campo de **caminho manual** da coleção de layouts, usado quando a detecção automática não acha nada (FR-006), com a validação S-1 correspondente em `electron/main.cjs` aceitando o caminho configurado explicitamente pelo jogador. Cobre Steam em disco secundário, Flatpak e Snap
- [X] T035 [US1] Criar `src/components/heroGrid/HeroGridTab.tsx`: ranking por grupo com winrate, fonte, amostra e as parcelas da nota; marcação de "sem dado"; aviso de que o winrate é o **geral do herói**, não o da função do grupo (FR-034b); aviso de que edição manual no espelho será descartada (FR-008f); heróis do ranking que não estão na origem marcados como "fora do layout de origem", sem entrar no espelho (FR-035a); identificação de qual layout é a origem e qual é o espelho, com aviso quando o espelho está desatualizado em relação à estrutura da origem (FR-035b); botões de sincronizar agora, remover espelho e restaurar backup
- [X] T036 [US1] Ligar a aba em `src/App.tsx` e no `src/components/layout/Navbar.tsx`, visível só com a feature ativa
- [X] T037 [US1] Implementar a **remoção do espelho** em `src/utils/heroGrid/mirrorBuilder.ts` (produzir a coleção sem o config do espelho) e no fluxo de escrita de `src/hooks/useHeroGridSync.ts`, passando pelo mesmo backup, atomicidade e guarda de T028 — remover é uma escrita, não uma ação de UI (FR-008g)
- [X] T038 [US1] Ligar em `src/components/settings/SettingsModal.tsx` o fluxo de **desativação** (FR-004): desmarcar a opção interrompe a sincronização, oferece remover o espelho via T037 e mantém a restauração de backup disponível, deixando claro que o layout de origem nunca foi tocado. Preservar `heroGridMirror` ao desmarcar (C-4), senão a remoção deixa de ser possível
- [X] T039 [US1] Tratar em `useHeroGridSync.ts` e na UI os caminhos ruins de FR-011, L-1, L-2, E-8 e FR-008e: Dota rodando (avisar e oferecer adiar), arquivo ausente ("crie um grid no Dota primeiro", sem criar arquivo), JSON inválido, sem permissão, colisão de nome, e **layout de origem apagado** (`SOURCE_INDEX_GONE`: avisar e pedir nova origem, sem adivinhar por nome — N-4)
- [X] T040 [US1] Acrescentar em `src/i18n/translations.ts`, nos dois dicionários, as chaves da US1 (rótulos do bloco de configurações, da aba, de procedência `OPENDOTA_BRACKET`, dos avisos e dos motivos de "sem dado")

**Checkpoint**: MVP funcional. `npm test`, `npx oxlint` e `npm run build` verdes, e o Nível 4 do
`quickstart.md` devolvendo `True` em todas as linhas. **Pare e valide antes de seguir** — é a última
oportunidade de encontrar problema de escrita com pouca superfície.

---

## Phase 4: User Story 2 — Sincronização diária em background (Priority: P2)

**Goal**: sincronizar sozinho uma vez por dia enquanto o app está aberto, com recuperação na
primeira abertura seguinte.

**Independent Test**: adulterar `heroGridLastSuccessfulSyncAt` para 25h atrás, reabrir o app e
verificar que uma sincronização ocorreu sozinha e que o marcador avançou. Os casos de relógio são
testáveis sem esperar, porque o agendador é função pura.

### Tests for User Story 2 ⚠️

- [X] T041 [P] [US2] Criar `src/utils/heroGrid/syncScheduler.test.ts`: 23h59 não devido, 24h01 devido, app reaberto após 3 dias fechado devido **uma vez** (não uma por dia perdido, FR-023), relógio recuado (`now < lastAt`) não devido e marcador **não** reescrito (FR-029), backoff `min(30min * 2^(n-1), 6h)` com teto (FR-028), sucesso zerando o contador de falhas
- [X] T042 [US2] Acrescentar a `src/utils/heroGrid/syncScheduler.test.ts` (criado em T041; sequencial em relação a ele) as invariantes I-22 e I-23: falha não avança `lastSuccessfulSyncAt`, e `outcome: 'FAILURE'` implica arquivo não escrito

### Implementation for User Story 2

- [X] T043 [P] [US2] Criar `src/utils/heroGrid/syncScheduler.ts` puro: `shouldSyncNow(state, now)`, `nextDueAt(state)`, `backoffMs(failures)`, `daysSinceLastSuccess(state, now)` e a máquina de estados `IDLE/DUE/RUNNING/BACKOFF/OFF` de `data-model.md § 6`
- [X] T044 [US2] Acrescentar ao `src/hooks/useHeroGridSync.ts` o timer de verificação a cada 5 minutos e a verificação na montagem. **Não** usar `setTimeout` de 24h — timer longo não sobrevive a hibernação de forma confiável. Depende de T043
- [X] T045 [US2] Persistir `heroGridLastSuccessfulSyncAt`, `heroGridLastAttemptAt`, `heroGridConsecutiveFailures` e `heroGridSyncHistory` (máximo 20 registros, C-5) em `src/utils/heroGrid/preferences.ts`, pelos dois caminhos de config, atualizando só em sucesso ou parcial (I-22)
- [X] T046 [US2] Em `src/hooks/useHeroGridSync.ts`, garantir que a sincronização não bloqueia a interface (FR-025/SC-008) e que uma sincronização manual disparada durante a automática não produz escrita concorrente — a trava do main (`electron/heroGrid/gridFile.cjs`) é a garantia, a do renderer é a conveniência
- [X] T047 [US2] Acrescentar ao `HeroGridTab.tsx` o cabeçalho de frescor: última sincronização, resultado, próxima prevista e **quantos dias se passaram** (FR-024a — espelho velho por app fechado precisa ser visível, não silencioso), mais o histórico de sincronizações (FR-036)
- [X] T048 [US2] Verificar a invariante I-20 em `src/utils/heroGrid/syncScheduler.test.ts`: com `heroGridEnabled === false`, o agendador devolve estado `OFF`, nenhum timer é armado, nenhuma leitura de arquivo acontece e nenhuma requisição sai (FR-002, SC-001)
- [X] T049 [P] [US2] Acrescentar as chaves i18n da US2 nos dois dicionários de `src/i18n/translations.ts` (estados de sincronização, próxima prevista, dias desde a última, histórico, motivos de falha)

**Checkpoint**: US1 e US2 funcionam independentemente. Nenhum autostart, nenhuma bandeja — com o app
fechado não há sincronização, por decisão registrada em FR-022a.

---

## Phase 5: User Story 3 — Transparência de fonte e degradação honesta (Priority: P2)

**Goal**: segunda fonte, precedência resolvida e rotulada, e degradação que nunca mente.

**Independent Test**: simular indisponibilidade de cada fonte, uma por vez e as duas juntas, e
verificar a mensagem exibida e o estado final da coleção. Com as duas fora, o arquivo não é tocado.

**Nota de ordem**: US3 e US2 são ambas P2 e independentes. Se preferir, US3 pode vir antes — ela
melhora a qualidade do dado que a US1 já usa, enquanto a US2 automatiza o que a US1 já faz.

### Tests for User Story 3 ⚠️

- [X] T050 [P] [US3] Criar `src/utils/heroGrid/sourcePrecedence.test.ts`: OpenDota vence quando as duas têm dado, STRATZ preenche herói ausente na OpenDota, e cada linha do resultado carrega a fonte que efetivamente prevaleceu
- [X] T051 [US3] Acrescentar a `src/utils/heroGrid/sourcePrecedence.test.ts` (criado em T050; sequencial em relação a ele) as invariantes I-11 a I-14 e I-24: todo `MetaWinrate` tem `matchCount` (não existe caminho que produza número sem amostra), nenhum é construído sem `source` e `patch`, herói ausente das duas fontes ganha **ausência** e não zeros, e uma fonte fora ⇒ `PARTIAL` que escreve, duas fora ⇒ `FAILURE` que não escreve
- [X] T052 [P] [US3] Criar `src/services/heroGrid/stratzWinrates.test.ts` contra a fixture anonimizada de resposta da STRATZ, provando o mapeamento de `heroId`/`winCount`/`matchCount` e o tratamento de 429 sem retry

### Implementation for User Story 3

- [X] T053 [US3] **Verificar contra a API real** o argumento de bracket de `heroStats.winWeek` (`bracketBasicIds` com `RankBracketBasicEnum` vs. `bracketIds` com `RankBracketEnum`) e salvar a resposta **anonimizada** em `src/services/__fixtures__/hero-winrates.json`. É a única incógnita de contrato aberta. **Nunca** colar o token em log, fixture, issue ou captura — ele não é revogável. Procedimento em `contracts/meta-sources.md`
- [X] T054 [US3] Criar `src/services/heroGrid/stratzWinrates.ts` com a query de `contracts/meta-sources.md` pelo `window.api.stratzQuery` genérico — **sem** `positionIds` (FR-034) —, mapeando contra a fixture de T053, com `RateLimitedError` em 429 sem retry e cache por patch via `statsCache`. Depende de T053
- [X] T055 [US3] Criar `src/utils/heroGrid/sourcePrecedence.ts`: resolve OpenDota → STRATZ por herói, marca a fonte vencedora, e resolve o bracket com `resolveBracket`/`tierToBracket` de `src/utils/rankBracket.ts`, propagando `bracketIsPlayerSpecific` (I-13 — com `false`, a UI diz "média geral", nunca "no seu ranque"). Depende de T054
- [X] T056 [US3] Ligar `sourcePrecedence` ao `useHeroGridSync.ts` e classificar o `outcome` da sincronização em `SUCCESS`/`PARTIAL`/`FAILURE` conforme a tabela de degradação de `contracts/meta-sources.md`, garantindo que `FAILURE` não escreve e não avança o marcador de sucesso (FR-017)
- [X] T057 [US3] Em `src/services/heroGrid/stratzWinrates.ts` e `src/utils/heroGrid/sourcePrecedence.ts`, tratar a ausência do token da STRATZ como fonte indisponível e **não** como erro: a feature conclui inteira só com a OpenDota e rotula (FR-015a, I-21)
- [X] T058 [US3] Acrescentar ao `HeroGridTab.tsx` os chips de procedência por herói (fonte + amostra), o aviso de qual fonte faltou, a marcação de "sem dado" com motivo, e o rótulo de bracket honesto ("no seu ranque" só quando `bracketIsPlayerSpecific`)
- [X] T059 [P] [US3] Acrescentar as chaves i18n da US3 nos dois dicionários de `src/i18n/translations.ts` (`STRATZ_BRACKET`, fonte indisponível, sem token, média geral vs. no seu ranque, amostra)

**Checkpoint**: nenhum número na tela sem fonte e amostra. Com as duas fontes fora, zero escrita.

---

## Phase 6: User Story 4 — Trocar o critério de ordenação (Priority: P3)

**Goal**: alternar entre combinado (padrão), só meta e só desempenho pessoal, e escolher o ranque de
referência.

**Independent Test**: alternar o critério e verificar que a ordem muda de forma coerente, com o
critério ativo rotulado na tela e a amostra pessoal visível por herói.

### Tests for User Story 4 ⚠️

- [X] T060 [P] [US4] Acrescentar a `src/utils/heroGrid/ranking.test.ts` as invariantes I-17 e I-18 nos três critérios: `COMBINED` sem pessoal cai para meta puro rotulado, e `PERSONAL_ONLY` sem pessoal devolve `score: null` com `noDataReason` — **nunca** cai para o meta em silêncio (FR-032a)
- [X] T061 [P] [US4] Acrescentar a `src/utils/heroGrid/sourcePrecedence.test.ts` o caso de trocar o ranque de referência para um que a fonte não segmenta, resultando em `bracket: 'ALL'` com `bracketIsPlayerSpecific: false` (FR-020)

### Implementation for User Story 4

- [X] T062 [US4] Estender `src/utils/heroGrid/ranking.ts` para honrar `RankingCriterion`, com `META_ONLY` ignorando o componente pessoal e `PERSONAL_ONLY` produzindo `null` na ausência de histórico
- [X] T063 [US4] Acrescentar ao `SettingsModal.tsx` o seletor de critério (padrão `COMBINED`) e o seletor de ranque de referência, persistindo `heroGridCriterion` e `heroGridBracket`
- [X] T064 [US4] Acrescentar ao `HeroGridTab.tsx` o rótulo do critério ativo e a exibição da amostra pessoal por herói (FR-032)
- [X] T065 [P] [US4] Acrescentar as chaves i18n da US4 nos dois dicionários de `src/i18n/translations.ts` (nomes dos três critérios, rótulo de critério ativo, amostra pessoal, ranque de referência)

**Checkpoint**: todas as user stories funcionam de forma independente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T066 [P] Rodar o roteiro completo do `quickstart.md` (Níveis 1 a 6), incluindo os 11 cenários do Nível 5, e registrar o resultado de cada um — **PARCIAL**: Níveis 1, 2, 4 e 6 executados (ver `validacao.md`). Faltam os Níveis 3 e 5, que exigem interação humana com o app gráfico e com o Dota 2 aberto (abrir/fechar o jogo, cortar a rede, `chmod 444`), e a execução do Nível 4 contra o arquivo **real** em vez da cópia
- [X] T067 [P] Verificar em `src/i18n/translations.test.ts` que a feature não introduziu chave órfã, entrada vazia, divergência de placeholder ou chave montada em runtime
- [X] T068 Confirmar que `npm run build` (`tsc -b`) passa e que o gate `_localeParity` no fim de `src/i18n/translations.ts` continua cobrindo as chaves novas
- [X] T069 [P] Conferir que nenhum log, fixture ou mensagem de erro da feature contém o token da STRATZ (S-2) e que `hero-winrates.json` está anonimizada
- [X] T070 Medir a sincronização a frio disparada por `src/hooks/useHeroGridSync.ts` e confirmar SC-009 (< 30s) e SC-008 (interface responsiva durante a sincronização)
- [X] T071 [P] Verificar SC-003b rodando 30 sincronizações consecutivas com o roteiro de idempotência do Nível 4 de `quickstart.md`, confirmando que o `hero_grid_config.json` mantém **exatamente um** espelho por origem
- [X] T072 [P] Atualizar o `CLAUDE.md` com uma seção sobre a feature: a estratégia de espelho, a fronteira "main é I/O burro", e por que o recorte por posição e o D2PT ficaram fora — é o tipo de decisão que o arquivo existe para registrar antes que alguém "simplifique"
- [X] T073 Revisar a diferença real produzida no `hero_grid_config.json` a olho, confirmando que ela se limita ao layout espelho (FR-007c)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende do Setup. **Bloqueia todas as user stories**
- **US1 (Phase 3)**: depende da Phase 2. É o MVP
- **US2 (Phase 4)** e **US3 (Phase 5)**: dependem da Phase 2 para começar, mas ambas integram no
  `useHeroGridSync.ts` criado em T032 (US1), então na prática rodam depois da US1
- **US4 (Phase 6)**: depende de T025 (`ranking.ts`) da US1
- **Polish (Phase 7)**: depende das stories desejadas

### User Story Dependencies

- **US1 (P1)**: independente. Entrega valor completo só com a OpenDota
- **US2 (P2)**: independente da US3. Automatiza o que a US1 já faz
- **US3 (P2)**: independente da US2. Melhora a qualidade do dado que a US1 já usa. **Pode vir antes
  da US2** se a prioridade for precisão em vez de automação
- **US4 (P3)**: precisa do `ranking.ts` da US1; independente da US2 e da US3

### Within Each User Story

- Teste escrito e falhando antes da implementação
- Tipos antes de lógica pura, lógica pura antes de serviço, serviço antes de UI
- Handlers IPC depois do módulo de I/O que eles expõem
- Tarefa que acrescenta caso a um arquivo de teste já criado vem **depois** dele, sem marcador de paralelismo
- i18n por último dentro da fase, quando as strings já estão estáveis

### Parallel Opportunities

- **Phase 1**: T001–T006 são seis arquivos distintos — tudo em paralelo. T002 (fixture do grid real)
  e T003 (anti-fixture) são o par que sustenta quase toda a confiança da feature
- **Phase 2**: T008 depois de T007; T013, T014 e T015 em paralelo com a trilha
  T007→T009→T010→T011→T012
- **US1**: T016, T017 e T019 em paralelo (três arquivos distintos); **T018, T020, T021 e T022 em
  sequência depois de T017**, porque os quatro acrescentam casos ao mesmo `mirrorBuilder.test.ts`;
  T023, T024 e T029 em paralelo
- **US2**: T041 antes de T042 (mesmo arquivo); T043 e T049 em paralelo
- **US3**: T050 antes de T051 (mesmo arquivo); T052 em paralelo com os dois; T059 em paralelo com a
  implementação
- **Phase 7**: T066, T067, T069, T071, T072 em paralelo

**Regra que essas linhas aplicam**: o marcador de paralelismo só vale para arquivos distintos. Tarefa
que acrescenta caso a um arquivo de teste criado por outra tarefa **não** é paralela a ela, mesmo sendo
"só um teste a mais" — duas escritas concorrentes no mesmo arquivo perdem uma das duas.
`mirrorBuilder.test.ts` concentra cinco tarefas (T017, T018, T020, T021, T022) porque é o arquivo que
prova a invariante central; elas são sequenciais entre si e paralelas a tudo o mais.

---

## Parallel Example: User Story 1

```bash
# As duas fixtures juntas, na Phase 1 — é o par que define se a feature é geral ou só sua:
Task: "Criar src/services/__fixtures__/hero-grid-real.json a partir do grid real, anonimizada"
Task: "Criar src/services/__fixtures__/hero-grid-adverse.json, a anti-fixture sintética"

# T016, T017 e T019 juntos — três arquivos distintos (devem falhar antes da implementação):
Task: "Criar src/utils/heroGrid/ranking.test.ts cobrindo I-15 a I-19"
Task: "Criar src/utils/heroGrid/mirrorBuilder.test.ts contra hero-grid-real.json cobrindo I-5 a I-10"
Task: "Criar electron/heroGrid/gridFile.test.cjs cobrindo I-1 e I-2, a guarda de imutabilidade"

# Depois, em sequência no mesmo arquivo: T018, T020, T021 e T022.

# As duas fontes de dado e a detecção de processo, juntas:
Task: "Criar src/services/heroGrid/openDotaWinrates.ts"
Task: "Criar src/services/heroGrid/personalWinrates.ts"
Task: "Criar electron/heroGrid/dotaProcess.cjs"

# Rodar os testes da feature — os DOIS caminhos, porque o include agora cobre electron/:
npx vitest run src/utils/heroGrid/ src/services/heroGrid/ electron/heroGrid/
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1)
2. **PARE E VALIDE**: `npm test`, `npx oxlint`, `npm run build`, e o Nível 4 do `quickstart.md`
3. Nesse ponto o app já entrega a feature inteira do ponto de vista do jogador: espelho ordenado,
   origem intocada, sem exigir token nenhum

### Incremental Delivery

1. Setup + Foundational → o app lê o grid e sabe reserializá-lo
2. + US1 → **MVP**: espelho ordenado por winrate da OpenDota combinado com o histórico do jogador
3. + US3 → segunda fonte, precedência rotulada, degradação honesta
4. + US2 → sincronização diária automática
5. + US4 → troca de critério e de ranque

Ordem sugerida das P2: **US3 antes da US2**. Automatizar um dado que ainda pode melhorar significa
gravar diariamente uma ordem que você vai querer refazer; e a US3 é o que fecha a exigência de
procedência sobre a segunda fonte.

### Sequência de risco

A ordem das fases é deliberada em relação ao risco do arquivo. Phase 2 lê e reserializa **sem
escrever**, então o parsing e o serializador ficam provados antes de qualquer escrita existir. A
escrita nasce em T028 já com backup, atomicidade e a guarda de igualdade profunda no mesmo commit —
nunca "escreve agora, protege depois".

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- Confirmar que o teste falha antes de implementar
- Commit por tarefa ou grupo lógico; parar em qualquer checkpoint para validar
- **Antes de rodar qualquer coisa que escreva**, fazer o backup manual do `hero_grid_config.json`
  e anotar o `sha256sum`, como manda o topo do `quickstart.md`
- As invariantes de `data-model.md` são a fonte da verdade dos testes; **todas** têm tarefa nomeada —
  I-1/I-2 em T019, I-3 em T014, I-4 em T017, I-4a/I-4b em T021, I-25/I-26/I-27 em T008
- **Duas fixtures, de propósito**: `hero-grid-real.json` é o seu grid (8 grupos, catálogo inteiro,
  layout único) e `hero-grid-adverse.json` é o oposto dele (3 layouts, nomes repetidos, grupo vazio,
  poucos heróis). A primeira prova que funciona para você; a segunda prova que funciona para os
  outros. Invariante que só a segunda exercita: I-2 — com um layout só, "não altere os outros" passa
  vazio
- Não afrouxar os gates existentes (`RULE_TEXT`, `_localeParity`, `translations.test.ts`): com
  `strict: false`, eles são praticamente a única rede de tipos do projeto
