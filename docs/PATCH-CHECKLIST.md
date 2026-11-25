# Checklist de patch do Dota 2

O GlimpseGG existe para continuar produzindo a leitura que a STRATZ parou de atualizar. Isso
significa que **o trabalho recorrente do projeto é este documento**: quando a Valve publica um
patch, algumas coisas se resolvem sozinhas e outras envelhecem em silêncio — sem erro, sem teste
vermelho, sem tela quebrada.

A ordem abaixo é a de execução. Cada passo diz o que acontece se for pulado.

---

## 1. O número do patch: nada a fazer

`src/services/gameVersionService.ts` resolve o patch em runtime, em cascata:
Steam News → STRATZ (`GetGameVersions`) → OpenDota (`constants/patch`) → GitHub `dotaconstants` →
`CURRENT_GAME_PATCH`. Cache de 1 hora no `localStorage`.

`src/services/statsCache.ts` guarda o patch dentro do envelope e **invalida duro quando ele muda**
(`env.patch !== patch`), mesmo dentro do TTL de 7 dias. Ou seja: winrate de meta, `itemFullPurchase`
e `heroVsHeroMatchup` viram sozinhos.

`CURRENT_GAME_PATCH` (`src/constants/gameVersion.ts`) é só o **piso do fallback**. Atualizar é
higiene, não urgência.

> Se pular: nada acontece. Este passo existe para você não sair procurando onde "trocar o patch".

## 1b. Janela de transição — abrir no dia, fechar à mão

Preencher `PATCH_TRANSITION` em `src/constants/gameVersion.ts` com o patch, o `patch_timestamp`
do datafeed da Valve (em ISO, UTC) e o prazo em dias. Enquanto valer, o `PatchTransitionNotice`
avisa no topbar, na aba de coaching e no layout espelho que os agregados ainda misturam o patch
anterior.

**Fechar:** voltar a constante para `null` quando `node scripts/check-patch-readiness.cjs` der
`[ok]` em `itemFullPurchase` e `winWeek` (editar `PATCH`, `NEW_ITEM_IDS` e `REMOVED_ITEM_IDS` no
topo do script antes). O prazo em dias é só a rede de segurança.

> Se pular a abertura: o app rotula como patch novo um agregado que é quase todo do anterior.
> Se pular o fechamento: o aviso some sozinho no fim do prazo, e a constante fica como lixo.

## 2. Catálogo de itens — tem script

```bash
node scripts/sync-items-full.cjs   # Valve + OpenDota + catálogo atual -> src/constants/items.ts
```

O script imprime itens novos, custos e tiers alterados; conferir contra as notas e commitar o
arquivo gerado. A fonte primária é o **datafeed da Valve** (`dota2.com/datafeed/itemlist` e
`itemdata`), porque a OpenDota atrasa: no 7.42, 13 horas depois do patch, ela ainda servia o catálogo
do 7.41, e o sync antigo, que só lia a OpenDota, rodava sem mudar nada. Item removido do jogo
fica no catálogo — partida antiga ainda o referencia.

As notas completas do patch saem do mesmo datafeed, em JSON, sem precisar do site:
`https://www.dota2.com/datafeed/patchnotes?version=<patch>&language=english`. O
`patch_timestamp` de lá é **marcador de data** (sempre 08:00 UTC), não a hora da virada: a 7.42
virou às 21:28 UTC e a 7.42a às ~23:39 UTC (notícia da Steam). Hora de virada sai da notícia ou
de `/constants/patch` da OpenDota.

> Se pular: `getItem` devolve fallback — item novo aparece como `Item #<id>` com ícone de receita e
> `cost: 0`. **Sem erro.** E `cost: 0` derruba o corte `cost >= 1800` que o `ScoreboardTable`
> usa para separar item core de consumível.

## 3. Herói novo — manual, em dois arquivos

- `HEROES_MAP` em `src/constants/heroes.ts`
- `HERO_ABILITIES_MAP` em `src/constants/abilities.ts`

> Se pular: `getHero` devolve `Hero #<id>` com ícone `unknown.png`, e `getHeroAbilities` monta um
> Q/W/E/R genérico pelo `shortName`. A tela abre; os nomes é que estão errados.

Nota: `heroes.ts` exporta `registerDynamicHeroes`, que **ninguém chama**. É gancho morto — não
conte com ele para registrar herói em runtime.

## 4. Os quatro pontos com id ou nome de item/herói cravado

| Onde | O quê | Sintoma de envelhecimento |
| --- | --- | --- |
| `src/constants/heroes.ts` | `NEW_HERO_IDS`, lido pelo badge `NEW` do `heroes/HeroesSection.tsx` | herói novo não ganha o selo; o anterior nunca deixa de ser "novo" |
| `src/components/match/ScoreboardTable.tsx` | `GENERIC_CONSUMABLES` (nomes `item_*`) e o corte `cost >= 1800` | consumível novo aparece como item de build |
| `src/utils/performanceEnricher.ts` | `ITEM_BENCHMARKS`, `Record<itemId, segundos>` | item removido ou refeito deixa de ter timing de referência, sem aviso |
| `src/constants/counterItems.ts` | itens de resposta por arquétipo de ameaça | item que deixou de ser resposta canônica continua sendo sugerido — mas o `buildAdvisor` filtra pelo winrate real, então corrige sozinho na maioria dos casos |

## 5. Mecânica de visão e o minimapa

`src/constants/mapGeometry.ts` guarda `OBSERVER_VISION_UNITS`, `SENTRY_TRUE_SIGHT_UNITS`,
`OBSERVER_DURATION_SEC` e `SENTRY_DURATION_SEC` — o próprio comentário diz "patch novo = uma edição
aqui". São constantes estáticas: a API não manda esses valores.

Se o **minimapa** mudar (`public/minimap.png`), `MAP_IMAGE_INSET` precisa ser recalibrado contra a
imagem nova, e `tests/utils/minimapCoords.test.ts` é quem confere. Não alterar esses números sem
refazer a calibração descrita no topo do `mapGeometry.ts`.

## 6. Limiares calibrados — remedir, nunca ajustar no olho

Todos foram medidos sobre amostra real e datada, e **a taxa de disparo fica anotada ao lado da
constante**. Alvo das tags de destaque: 5% a 15%. Foi exatamente assim que o antigo
`goldPerMinute >= 750` passou a disparar em 59% das partidas sem ninguém notar.

| Arquivo | Símbolos | Amostra da calibração |
| --- | --- | --- |
| `src/components/dashboard/MatchList.tsx` | `FARM_GPM`, `KILL_PARTICIPATION_PCT`, `DAMAGE_SHARE_PCT`, `CS_PER_MIN`, `TOWER_DAMAGE`, `HERO_HEALING`, `DENIES`, `MAX_LEVEL`, `MARATHON_MIN`, `UNSPENT_GOLD` | 100 partidas, bracket 6, 2026-08-30 |
| `src/utils/awardEngine.ts` | `SUPERLATIVES` (`margin`/`floor` por métrica), `ROUGH_GAME_MAX_IMP`, `ROUGH_GAME_MIN_LEAD` | 60 partidas reais |
| `src/utils/glint.ts` | `GLINT_MODEL`, `GLINT_THRESHOLDS` | `scripts/fit-glint-experimental.cjs` (pares do gabarito) |
| `src/utils/laneVerdict.ts` | `LANE_VERDICT_MODEL` (empate, atropelo) | `scripts/fit-lane-verdict.cjs` (pares do gabarito, taxa de disparo) |
| `src/constants/baselines.ts` | `ROLE_BASELINES` | curadoria manual |
| `src/utils/performance.ts` | baselines do radar | curadoria manual |
| `src/utils/insights/rank.ts` | `IMPROVEMENT_SCORE_FLOOR`, `MAX_PER_CATEGORY`, `MAX_IMPROVEMENTS`, `MAX_STRENGTHS` | corte de relevância |
| `src/utils/insights/rules/*.ts` | limiares por regra | ver o comentário de cada uma |
| `src/components/performance/PlayerPerformanceTab.tsx` | `deltaSec <= -45` / `>= 60` (item adiantado/atrasado) | — |

Ao mexer: registre a nova amostra, a data e a taxa de disparo no comentário. Número sem
procedência é o que este projeto inteiro existe para evitar.

## 7. Enums novos da OpenDota e da Valve

- `mapPosition` e `mapLane` (`src/services/openDotaMatch.ts`) devolvem `UNKNOWN` para valor
  desconhecido — de propósito: chutar `POSITION_1` ou `SAFE` produziria rótulo errado. O efeito
  visível é a informação sumir, não um erro. (Os equivalentes da STRATZ saíram em 2026-11-19.)
- `formatGameMode` e `formatLobbyType` (`src/utils/dotaFormatters.ts`) formatam o enum cru quando
  não reconhecem (`ABILITY_DRAFT` → "Ability Draft"), o que é aceitável. **Mas com entrada vazia o
  default é "All Pick Ranqueado"** — uma suposição, não uma medição. Modo de jogo novo entra aqui.
- Esses dois formatadores devolvem string em pt-BR cravada, fora do `t()`. Modo novo herda o mesmo
  problema.

## 8. Fixtures: só se o schema mudou

`src/services/__fixtures__/` fixa **forma**, não valor. Winrate desatualizado não quebra teste
nenhum. Regenerar só quando a STRATZ ou a OpenDota mudarem o schema da resposta — e não há script:
é captura manual de resposta real, anonimizada à mão.

## 8b. Patch de letra (7.42a, 7.42b…)

Costuma ser só balanceamento. O app resolve a letra sozinho pela Steam News, o cache de
estatísticas vira junto e a janela de transição compara pelo patch maior — não reabrir. Sobra:
rodar o sync de itens (passo 2), subir `CURRENT_GAME_PATCH` (higiene) e, na régua interna, a
trilha nova do coletor ([COLETA-GABARITO.md](COLETA-GABARITO.md), "Trilha 7.42a"), porque a
OpenDota dá o mesmo `patch` à letra e a trilha antiga nunca chega nela. Em 7.42a (2026-11-24):
40 heróis e 3 itens ajustados, sem herói nem item novo, sync sem diferença.

## 9. Fechar

```bash
npm test        # gate de release; teste vermelho bloqueia a publicação
npm run build   # tsc -b + vite build — é onde moram os gates de tipo
npx oxlint
```

---

Mapa das pastas e o que cada uma faz: [../CLAUDE.md](../CLAUDE.md) e os `CLAUDE.md` de cada pasta.
