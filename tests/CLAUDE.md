# tests/

A suíte inteira do projeto. Teste **não fica junto do código**: `src/` e `electron/` contêm só o que
o app embarca, e tudo que verifica comportamento mora aqui. A árvore **espelha `src/`**,
`tests/electron/` espelha `electron/` e `tests/scripts/` espelha `scripts/` (só o que o workflow de release usa) — `src/utils/heroGrid/ranking.ts` é testado por
`tests/utils/heroGrid/ranking.test.ts`. Arquivo novo segue o espelho; não há pasta de "testes
soltos".

O `include` do `vitest.config.ts` (`['tests/**/*.test.ts', 'tests/**/*.test.cjs']`) é o único lugar
que precisa saber disso. O `tsconfig.app.json` inclui `["src", "tests"]`, então o `tsc -b` do
`npm run build` também checa os testes `.ts` — teste que não compila quebra o build, de propósito.

## Arquivos

| Pasta | Espelha | O que cobre |
| --- | --- | --- |
| `utils/` | `src/utils/` | Motores puros: `awardEngine`, `buildAdvisor`, `dotaFormatters`, `glint`, `heroShare`, `laneResult`, `laneVerdict`, `legacyStorage`, `minimapCoords`, `navigation`, `patchTransition`, `rankBracket`, `recentFormStats`, `settingsTabs` |
| `utils/matchMetrics/` | `src/utils/matchMetrics/` | As métricas novas da 2.0 (`fights`, `deathCost`, `itemUsage`, `turningPoint`, `laneEfficiency`) sobre as duas fixtures reais, com oráculo tirado do cru |
| `utils/insights/` | `src/utils/insights/` | Motor de coaching: `context`, `index`, `threatProfile`, `timeSeries`, `wilson` — mais `placeholders`, também sem fonte homônima |
| `utils/heroGrid/` | `src/utils/heroGrid/` | Decisões puras do layout espelho: `mirrorBuilder`, `mirrorLayout`, `ranking`, `preferences`, `sourcePrecedence`, `syncScheduler`, `valveJson`, `heroTooltip`, `settingsOptions`, `tabFormat` |
| `services/` | `src/services/` | `openDotaMatch` (o mapper de ponta a ponta contra a fixture real, inclusive o veredito de rota), `openDotaProfile` (inclusive paginação e o filtro de patch que contorna o `?patch=` atrasado), `openDotaAccount`, `openDotaHealth` (só 5xx conta, falha por rota, fechar vale até o próximo 5xx), `steamResolver` (`withAccountProfile`: Steam primeiro, o "não existe" dela é final, OpenDota de reserva sobre o perfil real anonimizado, as duas falhando) e `visionMapper` (os helpers de visão sobre as duas partidas reais, com oráculo cru segundo a segundo) |
| `support/` | — (não espelha nada) | `fixtureMatches.ts`: as duas partidas reais da OpenDota pelo mapper real, e as sobreposições `withSynthetic*` (média do herói, divisão de dano) para as regras dormentes. Não é teste; ver abaixo |
| `services/heroGrid/` | `src/services/heroGrid/` | `heroGridBridge` (o caminho browser devolve indisponível **explícito**, nunca sucesso simulado), `openDotaWinrates` — sem rede e sem token |
| `i18n/` | `src/i18n/` | `translations`: paridade de chaves, nenhuma entrada vazia, mesmos placeholders nas duas locales e o guard de chave órfã |
| `scripts/` | `scripts/` | `next-version` (o passo de versão do `release.yml`: sem tag, igual, patch maior, minor/major maior, menor que a tag). `.test.cjs` com globais, como os do main |
| `electron/heroGrid/` | `electron/heroGrid/` | Os `.test.cjs` do processo main: `gridFile` (a guarda de imutabilidade, sobre os bytes que vão ao disco), `pathGuard`, `steamPaths`, `dotaProcess` |
| `electron/` | `electron/` | `steamProfile` (só SteamID64 vira URL; nome e foto do XML; foto fora da Valve descartada; perfil inexistente e resposta desconhecida) e `configMigration` (o arquivo de config renomeado: copia sem o token, antigo intocado, roda uma vez), sobre um diretório temporário real |

## Regras locais

- **`environment: 'node'`, sem DOM.** Componente `.tsx` **não tem teste** — não há `window`, não há
  render. Comportamento que precisa de teste é extraído para função pura em `src/utils/` ou
  `src/services/`, e é o extrato que ganha arquivo aqui. Quem precisa de `window` monta com
  `vi.stubGlobal` e restaura no `afterEach` (caso do `services/heroGrid/heroGridBridge.test.ts`).
- **Os testes do processo main são `.cjs` e usam `globals: true`.** Nada de `import` neles: o
  Vitest 4 recusa `require('vitest')`, e um `import` dentro de um `.cjs` quebra o parse do oxlint,
  que trata `.cjs` como script CommonJS. Com os globais ligados, `describe`/`it`/`expect`/`vi` vêm
  do ambiente e o arquivo continua sendo CommonJS de verdade — igual ao módulo sob teste. Os testes
  `.ts` seguem importando explicitamente; os globais só somam.
- **As fixtures não moram aqui.** Elas ficam em
  [`src/services/__fixtures__/`](../src/services/__fixtures__/CLAUDE.md) e são consumidas por import
  relativo (`../../src/services/__fixtures__/match-parsed-opendota.json`). São respostas 200
  **reais** e anonimizadas da OpenDota (e o gerador de IMP da STRATZ, ainda sem consumidor), mais o grid da Valve — dado de contrato de API, não material
  de teste inventado, e por isso ficam do lado do serviço cujo formato elas documentam. Ao mexer em
  parsing, use a fixture em vez de montar objeto sintético à mão, e não a substitua por dado
  inventado.
- **O guard de chave órfã varre `src/`, não `tests/`.** `tests/i18n/translations.test.ts` chama
  `collectSources('src')`, então chave de tradução citada apenas dentro de um teste **não** conta
  como usada. Antes da mudança de pasta contava; hoje não. Isso apertou o gate de graça — não
  "corrigir" ampliando o scan para `tests/`.
- **`support/` é a única pasta fora do espelho, e é dado, não teste.** Desde que a fixture da
  STRATZ saiu (2026-11-19), os testes de destaques e de coaching partem de
  `support/fixtureMatches.ts`: base **real** (mapper real sobre fixture real) e, por cima, só o
  que a OpenDota não tem, em funções com `Synthetic` no nome. A "média do herói" sintética é a
  própria série do jogador dividida por uma razão escolhida no teste — nenhum número copiado da
  STRATZ. Não pôr ali valor editado de fixture para fazer regra disparar: partida que dispara
  entra como fixture real nova, escolhida pelo que dispara.

## Navegação: um teste nomeado por tema

Todo o resto do diretório é `<fonte>.test.ts` para uma fonte de mesmo nome. Este não (o
`utils/matchContext.test.ts`, que também não tinha fonte homônima, saiu em 2026-11-19: o
`resolveMatchType` foi para `utils/dotaFormatters.test.ts` e o resto testava funções do mapper
da STRATZ):

- **`utils/insights/placeholders.test.ts`** — não existe `src/utils/insights/placeholders.ts`. Ele
  roda o motor (acertos crus, antes do corte de relevância) sobre as duas fixtures reais e sobre
  as sobreposições sintéticas, renderiza cada insight nas duas locales e falha se sobrar
  `{marcador}` sem substituição, se um marcador não vier do motor nem da camada de render
  (`{bracket}`), se as locales usarem marcadores diferentes na mesma chave, se uma regra ficar
  órfã de texto **ou se uma regra deixar de disparar em todas as fontes** — as exceções ficam
  listadas à mão em `SEM_EXERCICIO`, com o motivo (hoje `visionUptimeLow` e
  `visionWardsLostEarly`).

## Rodando

```bash
npm test                                             # a suíte inteira, uma passada
npm run test:watch                                   # em watch
npx vitest run tests/services/visionMapper.test.ts   # um arquivo
npx vitest run tests/utils/heroGrid/                 # uma pasta
npx vitest run -t "paridade dos dicionarios"         # por nome de describe/it
```

## Ao sair um patch

- As fixtures fixam **forma**, não valor: winrate desatualizado não deixa nada vermelho. Regenerar
  só quando a STRATZ ou a OpenDota mudarem o schema — e não há script, é captura manual anonimizada
  à mão.
- `utils/minimapCoords.test.ts` é quem confere a calibração do minimapa: trocar `public/minimap.png`
  invalida `MAP_IMAGE_INSET` e a calibração tem de ser refeita antes.
- Limiar calibrado (`awardEngine`, tags do `MatchList`) envelhece **sem** teste vermelho — a taxa de
  disparo mora no comentário ao lado da constante, não numa asserção. Ver a checklist.
- `npm test` é gate de release: teste vermelho bloqueia a publicação, de propósito.

Ver também: [../CLAUDE.md](../CLAUDE.md) ·
[../src/services/__fixtures__/CLAUDE.md](../src/services/__fixtures__/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../docs/PATCH-CHECKLIST.md)
