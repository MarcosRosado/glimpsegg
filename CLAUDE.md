# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GlimpseGG é um app desktop (Electron + React 19 + TypeScript + Vite 8) de análise pós-jogo de
Dota 2. É um **cliente puro**: não existe backend, banco nem telemetria. Fala direto com
`api.stratz.com` (GraphQL, exige token) e `api.opendota.com` (REST, público).

Convenção de idioma: documentação, comentários e mensagens de commit em pt-BR; identificadores de
código em inglês. Os comentários existentes explicam *por que* algo é assim, muitas vezes citando o
bug que a decisão substituiu — vale ler antes de "simplificar" um trecho.

## Comandos

| Comando | Para quê |
| --- | --- |
| `npm run electron:dev` | Dev real: vite + Electron juntos (`concurrently`, espera a porta 5173) |
| `npm run dev` | Só o vite. Sem `window.api`, o app cai no **caminho browser** (fetch direto + `localStorage`) |
| `npm test` | Vitest, uma passada |
| `npm run test:watch` | Vitest em watch |
| `npm run build` | `tsc -b && vite build`. Os gates de tipo moram aqui — ver *Gates* |
| `npx oxlint` | Lint (config em `.oxlintrc.json`; não há script npm) |
| `npm run icons:check` | Compara os ícones commitados com o sha256 dos masters. Roda no CI |
| `npm run icons:generate` | Regenera os ícones a partir de `build/icon.svg` |
| `npm run electron:start` | Roda o bundle de `dist/` em modo produção |
| `npm run electron:test-clean` | Electron com `userData` em `/tmp/glimpsegg-clean-test`. O diretório **persiste** entre execuções: apague-o antes de rodar para testar o onboarding de primeira execução |
| `npm run dist` | AppImage local |

Rodar um teste isolado:

```bash
npx vitest run src/services/visionMapper.test.ts    # um arquivo
npx vitest run -t "paridade dos dicionarios"        # por nome de describe/it
```

`vitest.config.ts` é separado do `vite.config.ts` de propósito, com `environment: 'node'` e
`include: ['src/**/*.test.ts']` — **não há ambiente de DOM**. Componentes `.tsx` não têm teste; a
lógica testável foi extraída para funções puras em `src/utils/` e `src/services/`. Ao mexer em
comportamento dentro de um componente, considere extrair a parte pura para conseguir testar.

## Os dois caminhos de rede

É a bifurcação mais importante do projeto e ela aparece em todo serviço:

- **Electron** — `electron/preload.cjs` expõe `window.api`; as chamadas vão por IPC para
  `electron/main.cjs`, que faz o fetch no processo main. Config persistida em
  `stratz_app_config.json` dentro do `userData`.
- **Browser** (`npm run dev`) — `window.api` é `undefined`, então o renderer faz `fetch` direto e a
  config vive no `localStorage` (`stratz_api_key`, `stratz_steam_id`, `app_language`).

Todo serviço testa `window.api` e tem os dois ramos (padrão curto em `src/services/opendota.ts`;
padrão longo em `stratzGql.ts`). Código novo de rede precisa cobrir os dois. Host novo exige
liberação em **três** lugares independentes: a CSP em `vite.config.ts` (só produção — em dev não há
CSP), a `EXTERNAL_HOST_ALLOWLIST` em `electron/main.cjs` (só para abrir link no browser do sistema)
e um handler IPC. O handler `api:stratz-graphql` é genérico, então query nova na STRATZ não precisa
de handler novo.

## Pipeline de dados de partida

`fetchMatchDetails(matchId, apiKey)` → `mapStratzMatch(m)` → `MatchDetails`.

`mapStratzMatch` é exportada, pura e testada (`stratzGql.test.ts`) — é onde vive praticamente toda a
tradução da resposta crua da STRATZ para o modelo do app, incluindo as funções `map*`/`normalize*`
privadas do arquivo. Ela também chama `buildVisionData` e calcula
`availability: MatchDataAvailability` via `computeAvailability`.

O teste roda contra `src/services/__fixtures__/match-parsed.json`: uma resposta 200 **real** e
anonimizada da STRATZ, de partida parseada. É o único jeito de exercitar o mapper de ponta a ponta —
use essa fixture ao mexer em parsing em vez de montar objeto sintético à mão, e não a substitua por
dado inventado.

Falha de rede ou de parsing devolve `null`, e o `App` mostra toast. **Não existe fallback para dados
fabricados** — o antigo `src/services/mockData.ts` foi removido de propósito, porque ele fazia a tela
abrir com a partida errada em vez de avisar.

`src/App.tsx` é o orquestrador: guarda token, perfil atual, histórico de perfis, partida
selecionada, slot selecionado e aba ativa; alterna entre a view de dashboard e a de partida
(`selectedMatch ? ... : ...`) e monta as quatro abas.

## A doutrina central: nunca inventar dado

Boa parte do desenho do projeto existe para isso. Três mecanismos, todos tipados:

1. **`MatchDataAvailability`** (`types/dota.ts`) — 10 flags (`parsed`, `perMinuteStats`,
   `deathEvents`, `wards`, `heroAverage`, `laneOutcomes`…). Regra de coaching ou seção de UI que
   exija uma flag ausente é **pulada**, não estimada.
2. **`BenchmarkSource`** — `HERO_AVERAGE` | `HERO_STATS` | `MATCH_ONLY` | `ROLE_BASELINE`. Todo
   número de comparação carrega procedência e `sampleSize`, e a UI renderiza isso como chip.
   `ROLE_BASELINE` é constante estática e **precisa** aparecer rotulado como estimativa.
3. **`ResolvedBracket.isPlayerSpecific`** (`utils/rankBracket.ts`) — quando o bracket cai em `ALL`,
   a UI não pode dizer "no seu ranque"; tem de dizer "média geral". É regra de honestidade.

Quando faltar dado, as saídas legítimas são esconder a seção ou marcar a procedência. Preencher
lacuna com estimativa não rotulada é regressão, mesmo que a tela fique mais bonita. Precisar de uma
condição nova de disponibilidade → adicionar flag em `MatchDataAvailability`.

## Motor de coaching (`src/utils/insights/`)

Determinístico, sem LLM. Regras declarativas, texto fora da regra:

- `ALL_RULES` (em `index.ts`) reúne os arrays de `rules/*.ts`. Cada `InsightRule` tem `id`,
  `category`, `requires` (flags de availability), `positions` opcional, e
  `evaluate(ctx) => RuleHit | null`. O `RuleHit` traz `magnitude` 0..1, `params` com números
  **crus**, `source` e `sampleSize`.
- **Regras não produzem texto.** `RuleId` mapeia para chaves i18n em `ruleText.ts`; a formatação por
  locale acontece na UI (`CoachingInsightsTab`).
- `rank.ts` converte `magnitude` em score, ordena por severidade real e separa forças de melhorias.
  O corte é por **relevância**, não por cota: `IMPROVEMENT_SCORE_FLOOR` descarta melhoria fraca e
  `MAX_PER_CATEGORY`/`MAX_STRENGTHS`/`MAX_IMPROVEMENTS` limitam o topo. Não existe piso de
  quantidade — lista vazia é resultado válido e correto (a versão anterior inventava três blocos de
  conselho genérico para preencher).
- `compositeBurstNoDispel` é a manchete: quando dispara, suprime as regras de
  `SUPPRESSED_BY_COMPOSITE` para não repetir três versões fracas do mesmo diagnóstico.
- Regra que lança exceção é logada e pulada; não derruba a aba.
- `buildInsightContext` (`context.ts`) monta o `InsightContext`: posição efetiva, benchmarks já
  resolvidos com procedência, estatísticas medidas e normalizadas, mortes, `threat` e `build`.

**Adicionar uma regra toca quatro pontos**, e faltar qualquer um quebra o build ou os testes:
`RuleId` em `insights/types.ts` → entrada em `RULE_TEXT` (`ruleText.ts`) → o array em `rules/` →
as chaves nos **dois** dicionários de `i18n/translations.ts`.

`src/utils/insightsEngine.ts` é apenas um shim de compatibilidade para imports antigos; deve
desaparecer quando não houver mais nenhum.

## Visão e wards

- `src/services/visionMapper.ts` é puro e tem **precedência explícita de fonte**:
  (A) `playbackData.wardEvents` → tempo de vida, autor e deward reais;
  (B) `players[].stats.wards` → só colocação, tempo de vida *estimado*;
  (C) nada → `source: 'NONE'`. Nunca inventar ward. `VISION_SOURCE_IS_ESTIMATED` diz à UI quando
  avisar. Ele existe separado de `stratzGql.ts` justamente para ser testável — o bug que substituiu
  (quatro wards hardcoded por jogador) sobreviveu porque nada verificava esse caminho.
- Coordenadas: `utils/minimapCoords.ts` + `constants/mapGeometry.ts`. **Quem chama declara o espaço
  de origem; a função nunca infere** — a versão que inferia pela faixa de valores plotava todo o lado
  Radiant errado. Células da STRATZ vão de 64 a 192 (128 unidades de mundo por célula) e o Y cresce
  para o norte, então toda conversão inverte o Y.
- As constantes de calibração estão sustentadas por medições documentadas no topo do
  `mapGeometry.ts` (amostra de 544 wards reais, âncoras de runa) e verificadas em
  `minimapCoords.test.ts`. Não alterar esses números sem refazer a calibração contra
  `public/minimap.png` — trocar a imagem do minimapa invalida `MAP_IMAGE_INSET`.

## Recomendação de build

- `hooks/useBuildAdvice.ts` é chamado **só** pelo `CoachingInsightsTab`, nunca no
  `handleSelectMatch` — assim overview, performance e vision não pagam o request. Ele resolve
  posição e bracket (`rankBracket.ts`), busca os agregados e chama `computeBuildAdvice`.
- `services/stratzHeroStats.ts` traz `itemFullPurchase` e `heroVsHeroMatchup` em **um** documento
  GraphQL sob a raiz `heroStats` (1 request a frio). Trata `RateLimitedError` explicitamente.
- `services/statsCache.ts` — cache em `localStorage` + memória, TTL de 7 dias, e a chave inclui o
  patch vindo de `gameVersionService`. Trocar de aba não refaz request; patch novo invalida tudo.
- `utils/buildAdvisor.ts` é puro e define "item de build" como "item presente no `itemFullPurchase`
  deste herói/posição/ranque". Por isso não precisa de grafo de componentes: intersectar as compras
  do jogador com esse conjunto já devolve a build real. Usa `wilson.ts` para não deixar amostra
  pequena virar recomendação confiante.

## i18n

`src/i18n/translations.ts` guarda `pt-BR` e `en-US` num único objeto `as const`, com
`TranslationKey = keyof typeof translations['pt-BR']`. O `t(key, params)` do `LanguageContext`
substitui `{nome}` por valor.

**Nunca montar chave em runtime** (`t(\`prefixo${x}\`)`). Tabela de chave dinâmica deve ser
`Record<..., TranslationKey>` com literais explícitos — é dessa convenção que depende o teste de
chave órfã, que só enxerga literais no código.

## Gates: o que realmente segura o projeto

`tsconfig.app.json` tem `strict: false`. As compensações abaixo são deliberadas e **não devem ser
afrouxadas** — com `strict: false` são praticamente a única rede de tipos disponível:

- `RULE_TEXT: Record<RuleId, RuleTextKeys>` — `RuleId` é união fechada, então regra sem texto,
  chave digitada errado ou chave removida do dicionário fazem `tsc -b` falhar.
- `const _localeParity: Record<TranslationKey, string> = translations['en-US']` no fim de
  `translations.ts` — pega o caso inverso (chave que existe em pt-BR e falta em en-US), que antes
  caía silenciosamente no fallback em runtime.
- `i18n/translations.test.ts` — paridade de chaves, nenhuma entrada vazia, mesmos placeholders nas
  duas locales, e nenhuma chave órfã em `src/`.

## Ícones e marca

`build/icon.svg` é o master: todos os PNG, o `.ico` e `public/favicon.svg` são **gerados** dele por
`npm run icons:generate` e **precisam ser commitados junto** — o CI não gera ícones, então um commit
sem eles publica release com arte antiga sem sinal de erro. `npm run icons:check` existe para
transformar isso em erro vermelho.

Duas restrições impostas por preflight no gerador: nada de elemento `<text>` no master (a fonte que
o fontconfig resolve varia por máquina; letras vão como `<path>`) e ImageMagick precisa do delegate
RSVG (sem librsvg o renderizador MSVG interno ignora gradientes e filtros e destrói o ícone sem
erro).

O monograma in-app é outro arquivo, redesenhado à mão na grade de 24px:
`src/components/brand/BrandMark.tsx`. Mexer em um exige revisar o outro.

## Release

Todo push na `main` dispara `.github/workflows/release.yml`: incrementa o patch, commita
`chore: release vX [skip ci]`, cria a tag e faz build/publish nas três plataformas. Gates, nessa
ordem: `icons:check` → `npm test` → `npm run build`. Teste vermelho bloqueia a release de propósito.
Não editar `version` no `package.json` à mão — o workflow faz isso.

## Metadados estáticos do Dota

`src/constants/heroes.ts`, `items.ts` e `abilities.ts` são tabelas grandes com acesso por
`getHero`/`getItem`/`getHeroAbilities`, que **sempre devolvem fallback** em vez de `undefined` — é o
que permite exibir herói ou item de patch novo sem quebrar a tela. `scripts/sync-items-full.cjs`
regenera o catálogo de itens a partir das constantes da OpenDota. Herói ou item novo entra aqui.

`constants/mapGeometry.ts`, `counterItems.ts`, `baselines.ts` e `ranks.ts` são constantes de domínio
com justificativa no comentário de topo; `gameVersion.ts` guarda o patch de fallback.

## Segredos

`.gitignore` cobre `.env*` inteiro (exceto `.env.example`), deliberadamente amplo para pegar
`.env.bak` e afins. O token pessoal da STRATZ **não é revogável**: se vazar, fica válido até expirar.
Não colar em issue, log, teste, fixture ou captura de tela. Ele vive em texto claro apenas no
`userData` do Electron (`stratz_app_config.json`) ou no `localStorage` em dev, e nunca é embutido no
bundle.
