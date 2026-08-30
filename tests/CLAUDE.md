# tests/

A suíte inteira do projeto. Teste **não fica junto do código**: `src/` e `electron/` contêm só o que
o app embarca, e tudo que verifica comportamento mora aqui. A árvore **espelha `src/`**, e
`tests/electron/` espelha `electron/` — `src/utils/heroGrid/ranking.ts` é testado por
`tests/utils/heroGrid/ranking.test.ts`. Arquivo novo segue o espelho; não há pasta de "testes
soltos".

O `include` do `vitest.config.ts` (`['tests/**/*.test.ts', 'tests/**/*.test.cjs']`) é o único lugar
que precisa saber disso. O `tsconfig.app.json` inclui `["src", "tests"]`, então o `tsc -b` do
`npm run build` também checa os testes `.ts` — teste que não compila quebra o build, de propósito.

## Arquivos

| Pasta | Espelha | O que cobre |
| --- | --- | --- |
| `utils/` | `src/utils/` | Motores puros: `awardEngine`, `buildAdvisor`, `dotaFormatters`, `laneResult`, `minimapCoords`, `rankBracket`, `settingsTabs` — mais `matchContext`, sem fonte homônima (ver abaixo) |
| `utils/insights/` | `src/utils/insights/` | Motor de coaching: `context`, `index`, `threatProfile`, `timeSeries`, `wilson` — mais `placeholders`, também sem fonte homônima |
| `utils/heroGrid/` | `src/utils/heroGrid/` | Decisões puras do layout espelho: `mirrorBuilder`, `mirrorLayout`, `ranking`, `preferences`, `sourcePrecedence`, `syncScheduler`, `valveJson`, `heroTooltip`, `settingsOptions`, `tabFormat` |
| `services/` | `src/services/` | `stratzGql` (o mapper de ponta a ponta contra a fixture real) e `visionMapper` |
| `services/heroGrid/` | `src/services/heroGrid/` | `heroGridBridge` (o caminho browser devolve indisponível **explícito**, nunca sucesso simulado), `openDotaWinrates`, `stratzWinrates` — transporte injetado, sem rede e sem token |
| `i18n/` | `src/i18n/` | `translations`: paridade de chaves, nenhuma entrada vazia, mesmos placeholders nas duas locales e o guard de chave órfã |
| `electron/heroGrid/` | `electron/heroGrid/` | Os `.test.cjs` do processo main: `gridFile` (a guarda de imutabilidade, sobre os bytes que vão ao disco), `pathGuard`, `steamPaths`, `dotaProcess` |

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
  relativo (`../../src/services/__fixtures__/match-parsed.json`). São respostas 200 **reais** e
  anonimizadas da STRATZ e da OpenDota, mais o grid da Valve — dado de contrato de API, não material
  de teste inventado, e por isso ficam do lado do serviço cujo formato elas documentam. Ao mexer em
  parsing, use a fixture em vez de montar objeto sintético à mão, e não a substitua por dado
  inventado.
- **O guard de chave órfã varre `src/`, não `tests/`.** `tests/i18n/translations.test.ts` chama
  `collectSources('src')`, então chave de tradução citada apenas dentro de um teste **não** conta
  como usada. Antes da mudança de pasta contava; hoje não. Isso apertou o gate de graça — não
  "corrigir" ampliando o scan para `tests/`.

## Navegação: dois testes nomeados por tema

Todo o resto do diretório é `<fonte>.test.ts` para uma fonte de mesmo nome. Estes dois não:

- **`utils/matchContext.test.ts`** — não existe `src/utils/matchContext.ts`. O arquivo é nomeado
  pelo *tema*: cobre `resolveMatchType` (de `src/utils/dotaFormatters.ts`) e `ALL_TOWERS_STANDING`,
  `derivePartySize` e `deriveTeamShares` (de `src/services/stratzGql.ts`). As duas regras existem
  para **não inventar dado**: a lista da home precisa poder dizer "não sei" em vez de rotular uma
  partida casual como ranqueada ou uma partida em grupo como solo.
- **`utils/insights/placeholders.test.ts`** — não existe `src/utils/insights/placeholders.ts`. Ele
  roda o motor sobre a fixture real, renderiza cada insight nas duas locales e falha se sobrar
  `{marcador}` sem substituição, se um marcador não vier do motor nem da camada de render
  (`{bracket}`), se as locales usarem marcadores diferentes na mesma chave, ou se uma regra ficar
  órfã de texto.

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
