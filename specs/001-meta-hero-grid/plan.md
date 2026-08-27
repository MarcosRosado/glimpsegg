# Implementation Plan: Layout espelho de heróis ordenado por winrate do meta

**Branch**: `001-meta-hero-grid` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-meta-hero-grid/spec.md`

## Summary

A feature acrescenta um **layout espelho** ao `hero_grid_config.json` da conta Steam local: cópia
fiel do layout que o jogador escolher (grupos, nomes, coordenadas, alocação de heróis), com a ordem
interna de cada grupo definida por uma nota que combina winrate do meta e desempenho pessoal. O
layout de origem não é alterado — o `configs` do arquivo é um array, então o espelho é um elemento
novo ao lado do dele.

Desligada por padrão. Ligada, sincroniza uma vez por dia enquanto o app estiver aberto, com
recuperação na primeira abertura seguinte quando o momento passou com o app fechado.

**Abordagem técnica**, em uma frase: toda a decisão de *o que* escrever vive em funções puras
TypeScript sob `src/` (testadas pelo vitest); o processo main do Electron só faz I/O de arquivo,
backup, escrita atômica e detecção de processo. Fontes de dados reaproveitam **integralmente** o
transporte que já existe — `api:opendota-fetch` e o `api:stratz-graphql` genérico — então **nenhum
host novo, nenhuma mudança de CSP e nenhum handler IPC de rede novo**.

Ver [research.md](./research.md) para o que foi verificado. Os três desvios que a pesquisa levantou
foram **resolvidos** pela sessão de clarificação de 2026-08-26, registrada em
[spec.md § Clarifications](./spec.md#clarifications):

| Desvio | Resolução |
| --- | --- |
| D-1 — D2PT entrega ordem, não winrate | **Fonte cortada da v1.** Só OpenDota + STRATZ, ambas com winrate e amostra |
| D-2 — "byte a byte" impossível num round-trip | Igualdade profunda da origem verificada antes de gravar + backup byte-exato + serializador que preserva o estilo do arquivo |
| D-3 — posição por grupo não é inferível | **Recorte por posição removido.** Winrate geral do herói em todos os grupos, rotulado como tal |

Duas decisões extras da mesma sessão: precedência invertida para **OpenDota → STRATZ** (a que não
exige token vem primeiro), e "processo em background" significa **dentro do app** — sem autostart,
bandeja ou modo headless.

## Technical Context

**Language/Version**: TypeScript ~6.0 (`strict: false`), React 19, Node via Electron 43

**Primary Dependencies**: nenhuma nova. Reaproveita `wilson.ts`, `rankBracket.ts`, `statsCache.ts`,
`gameVersionService.ts`, `opendota.ts` (o `fetchOpenDotaHeroStats()` já existe), `constants/heroes.ts`.
`fs`/`path`/`child_process` do Node no main process.

**Storage**: `stratz_app_config.json` no `userData` (Electron) / `localStorage` (browser) para
preferências e marcadores de sincronização. `localStorage` para cache de agregados via `statsCache`.
Alvo de escrita externo: `hero_grid_config.json` do Steam. Não há banco.

**Testing**: Vitest, `environment: 'node'`,
`include: ['src/**/*.test.ts', 'electron/**/*.test.cjs']`. Sem DOM — nenhum `.tsx` é testado, o que
dita a fronteira de arquitetura (ver Gate 6). O segundo padrão do `include` foi acrescentado por esta
feature: a maior parte da lógica vai para `src/`, mas a guarda que compara os bytes antes de gravar
**tem** de rodar no main, e não pode ser a única coisa sem teste.

**Target Platform**: desktop Electron em Linux, Windows e macOS. Modo browser (`npm run dev`) roda a
UI e o ranking, mas **não** escreve layout. A feature funciona por completo sem o token da STRATZ,
usando só a OpenDota.

**Project Type**: desktop-app, cliente puro. Sem backend, sem telemetria.

**Performance Goals**: sincronização completa < 30s (SC-009). A frio: 1 request OpenDota heroStats +
1 OpenDota player heroes + 1 STRATZ (só se houver token). Sem recorte por posição, é **um** request de
meta, não um por posição. Morno (cache por patch, TTL 7 dias): 0 requests para os agregados de meta.
UI não bloqueia (SC-008).

**Constraints**: escrever num arquivo insubstituível do usuário, que o cliente do Dota reescreve ao
sair. Zero requisição e zero leitura de arquivo com a feature desligada (FR-002). Token da STRATZ não
é revogável — não aparece em log, fixture nem captura.

**Scale/Scope**: 1 arquivo de grids, ~1–10 layouts nele, ~127 heróis, ~8 grupos por layout, 1
sincronização/dia. Escopo de código: ~8 módulos novos em `src/`, 4 em `electron/`, 1 aba de UI, 1
bloco de configurações, ~2 dicionários de i18n. As clarificações removeram 3 módulos previstos
(`d2ptOrder.ts`, `groupPosition.ts`, `GroupPositionMapper.tsx`) e o handler IPC do D2PT.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Estado da constituição**: `.specify/memory/constitution.md` está com os placeholders do template —
não há constituição ratificada neste projeto. Os gates abaixo derivam do `CLAUDE.md`, que é o
documento de doutrina de fato e é explícito sobre o que "realmente segura o projeto".

| # | Gate (origem no CLAUDE.md) | Antes da Phase 0 | Depois da Phase 1 |
| --- | --- | --- | --- |
| 1 | **Nunca inventar dado.** Falta de dado → esconder ou rotular procedência, nunca estimar sem rótulo | PASS — FR-018, FR-030c, FR-020 já mandam isso | **PASS** — D-1 resolvido cortando o D2PT: as duas fontes restantes entregam winrate **e** amostra, então nenhum número sem procedência influencia a ordem |
| 2 | **Procedência tipada.** Todo número de comparação carrega fonte + `sampleSize` | PASS | PASS — `MetaWinrate` carrega `source` + `matchCount` em 100% dos casos. Sem `RANK_ONLY`, sem exceção |
| 3 | **Os dois caminhos de rede.** Todo serviço novo cobre Electron e browser | PASS | PASS — cada serviço testa `window.api`; só a escrita de layout fica indisponível e **rotulada** no browser |
| 4 | **Host novo exige três liberações** (CSP, allowlist, handler IPC) | N/A | **N/A** — nenhum host novo. `api.opendota.com` e `api.stratz.com` já estão liberados nos três lugares, e o `api:stratz-graphql` é genérico |
| 5 | **i18n.** Chave nunca montada em runtime; paridade pt-BR/en-US; sem chave órfã | N/A | PASS por construção — tabelas de chave dinâmica como `Record<..., TranslationKey>` com literais |
| 6 | **Lógica testável fora de `.tsx`.** Vitest precisa alcançar tudo que decide | N/A | PASS **após correção** — a análise pegou este gate declarado PASS indevidamente: a guarda de imutabilidade (I-1, I-2) e a detecção de contas (I-25, I-26) moram em `electron/*.cjs`, que o `include` do vitest não cobria. Corrigido acrescentando `electron/**/*.test.cjs` ao `vitest.config.ts` |
| 7 | **Segredos.** Token da STRATZ fora de log, fixture e captura | N/A | PASS — fixtures de winrate não contêm token; a fixture de resposta é anonimizada como `match-parsed.json` |
| 8 | **Gates de build** (`RULE_TEXT`, `_localeParity`, `translations.test.ts`) intactos | N/A | PASS — a feature não adiciona `InsightRule`, então `RULE_TEXT` não é tocado |

**Todos os gates PASS, sem condicional.** O único gate que estava em atenção antes das clarificações
(Gate 1) foi resolvido por decisão de escopo, não por exceção à regra — o que é o desfecho preferível.

## Project Structure

### Documentation (this feature)

```text
specs/001-meta-hero-grid/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões verificadas (D-1..D-3 resolvidos na spec)
├── data-model.md        # Phase 1 — entidades e invariantes
├── quickstart.md        # Phase 1 — como validar de ponta a ponta
├── contracts/           # Phase 1 — contratos de IPC, arquivo e UI
│   ├── hero-grid-file.md
│   ├── ipc-hero-grid.md
│   ├── meta-sources.md
│   └── config-keys.md
├── checklists/
│   └── requirements.md  # 16/16
└── tasks.md             # Phase 2 — criado por /speckit-tasks, NÃO por este comando
```

### Source Code (repository root)

```text
electron/
├── main.cjs                        # + registro dos handlers grid:*
├── preload.cjs                     # + ponte window.api.heroGrid
└── heroGrid/                       # NOVO — só I/O, nada de decisão
    ├── steamPaths.cjs              # raízes por plataforma, dedupe por realpath, filtro de pseudo-conta
    ├── steamPaths.test.cjs         # I-25, I-26: dedupe e pseudo-contas
    ├── gridFile.cjs                # ler, backup byte a byte, escrita atômica (tmp+fsync+rename), poda de backups
    ├── gridFile.test.cjs           # I-1, I-2: a guarda de imutabilidade, sobre bytes reais
    └── dotaProcess.cjs             # Dota rodando? casa nome de executável, não linha de comando

src/
├── services/heroGrid/
│   ├── openDotaWinrates.ts         # PRIMEIRA fonte: buckets 1..8 → bracket (reusa fetchOpenDotaHeroStats)
│   ├── stratzWinrates.ts           # SEGUNDA fonte: winWeek por bracket. Só se houver token
│   ├── personalWinrates.ts         # OpenDota players/{id}/heroes
│   └── heroGridBridge.ts           # window.api.heroGrid vs indisponível (caminho browser)
├── utils/heroGrid/
│   ├── mirrorBuilder.ts            # origem + ranking → objeto do arquivo novo. PURO. O coração.
│   ├── mirrorBuilder.test.ts
│   ├── ranking.ts                  # nota combinada via wilson.ts, pesos, procedência
│   ├── ranking.test.ts
│   ├── sourcePrecedence.ts         # OpenDota → STRATZ, com rótulo por herói
│   ├── sourcePrecedence.test.ts
│   ├── valveJson.ts                # serializador que preserva o estilo do arquivo — FR-007c
│   ├── valveJson.test.ts           # PURO e testado: main recebe texto pronto, não objeto
│   ├── syncScheduler.ts            # shouldSyncNow / nextSyncAt / backoff. PURO.
│   └── syncScheduler.test.ts
├── hooks/
│   └── useHeroGridSync.ts          # timer de 5 min + orquestração da sincronização
├── components/heroGrid/
│   └── HeroGridTab.tsx             # ranking, procedência, origem vs espelho, histórico, dias desde o último sync
├── components/settings/
│   └── SettingsModal.tsx           # + bloco da feature (toggle, conta, origem, critério, ranque)
├── types/
│   ├── heroGrid.ts                 # NOVO — entidades de data-model.md
│   └── electron.d.ts               # + AppConfig novas chaves, + ElectronApi.heroGrid
└── i18n/translations.ts            # + chaves nos DOIS dicionários
```

**Structure Decision**: mantida a estrutura do projeto — `electron/` para I/O privilegiado, `src/`
para tudo o mais, com a divisão `services/` (fala com o mundo) × `utils/` (puro e testado) que o
projeto já usa em `visionMapper.ts` × `minimapCoords.ts` e em `stratzHeroStats.ts` ×
`buildAdvisor.ts`. O único subdiretório novo em `electron/` é `heroGrid/`, criado porque o
`main.cjs` já tem 400+ linhas e quatro responsabilidades novas de sistema de arquivos não cabem lá
sem virar um despejo.

## Implementation Phases

Ordem derivada das prioridades das user stories, com cada fatia entregando algo verificável.

As fases abaixo usam **os mesmos números e nomes de `tasks.md`**, para não existirem duas
nomenclaturas para a mesma feature.

**Phases 1–2 — Setup e Foundational: ler sem escrever**
Tipos, fixture do grid real, defaults de preferência, detecção de contas e caminho, leitura do
arquivo, serializador com teste de round-trip. **Nenhuma escrita e nenhuma fonte de meta.** O parsing
e a serialização ficam provados antes de existir código que grave — é o que cobre o risco R-002 na
janela mais barata possível.

**Phase 3 — US1, o espelho (MVP)**
OpenDota como fonte, desempenho pessoal, ranking combinado, `mirrorBuilder`, backup byte-exato,
escrita atômica, guarda de igualdade profunda da origem (FR-007b), trava de escrita, detecção de Dota
rodando, remoção do espelho, aba de UI e bloco de configurações. É aqui que mora o risco do arquivo, e
ele entra já protegido: backup, atomicidade e guarda nascem no mesmo commit que a escrita.

**Phase 4 — US2, sincronização diária**
`syncScheduler` puro, hook com timer de 5 min, marcadores persistidos, backoff, histórico, tolerância
a salto de relógio, contador de dias desde o último sync (FR-024a).

**Phase 5 — US3, segunda fonte e degradação**
STRATZ, precedência rotulada, classificação `SUCCESS`/`PARTIAL`/`FAILURE`, transparência na UI.

**Phase 6 — US4, troca de critério.** **Phase 7 — polish e validação do `quickstart.md`.**

Não há fase de D2PT: a fonte foi cortada na clarificação de 2026-08-26.

## Complexity Tracking

Nenhum gate da doutrina foi violado. As três entradas abaixo são complexidades que a pesquisa
justificou e que existem para satisfazer requisito, não por gosto.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Serializador JSON próprio (`src/utils/heroGrid/valveJson.ts`) | FR-007c: o arquivo real usa tabs e floats de 6 decimais; `JSON.stringify` reescreve a formatação inteira e faz o diff parecer que a ferramenta mexeu na origem | `JSON.stringify` puro passaria no teste de igualdade profunda, mas produz um arquivo visualmente "reescrito", o que corrói a confiança justamente na feature que promete não tocar no layout do jogador |

As duas outras entradas desta tabela — mapeamento grupo→posição e handler IPC do D2PT — **deixaram de
existir** com as clarificações de 2026-08-26. A feature ficou mais simples do que o plano original:
menos três módulos, menos um handler IPC, menos uma chave de configuração, e nenhuma liberação de host.
