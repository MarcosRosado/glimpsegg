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

## 2. Catálogo de itens — tem script

```bash
node scripts/sync-items-full.cjs   # busca a OpenDota e sobrescreve src/constants/items.ts
```

Commitar o arquivo gerado.

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
| `src/components/dashboard/MostPlayedHeroes.tsx` | heroId `145` e `131` literais no JSX para o badge `NEW` | herói novo não ganha o selo; esses dois nunca deixam de ser "novos" |
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
| `src/utils/dotaFormatters.ts` | `IMP_EXTREME` | 400 jogadores (60 partidas) |
| `src/constants/baselines.ts` | `ROLE_BASELINES` | curadoria manual |
| `src/utils/performance.ts` | baselines do `calculateCustomImp` e do radar | curadoria manual |
| `src/utils/insights/rank.ts` | `IMPROVEMENT_SCORE_FLOOR`, `MAX_PER_CATEGORY`, `MAX_IMPROVEMENTS`, `MAX_STRENGTHS` | corte de relevância |
| `src/utils/insights/rules/*.ts` | limiares por regra | ver o comentário de cada uma |
| `src/components/performance/PlayerPerformanceTab.tsx` | `deltaSec <= -45` / `>= 60` (item adiantado/atrasado) | — |

Ao mexer: registre a nova amostra, a data e a taxa de disparo no comentário. Número sem
procedência é o que este projeto inteiro existe para evitar.

## 7. Enums novos da STRATZ e da Valve

- `mapStratzRole` e `mapStratzLane` (`src/services/stratzGql.ts`) devolvem `UNKNOWN` para valor
  desconhecido — de propósito: chutar `SAFE` dava a um roamer o veredito da safelane. O efeito
  visível é o badge sumir, não um erro.
- `formatGameMode` e `formatLobbyType` (`src/utils/dotaFormatters.ts`) formatam o enum cru quando
  não reconhecem (`ABILITY_DRAFT` → "Ability Draft"), o que é aceitável. **Mas com entrada vazia o
  default é "All Pick Ranqueado"** — uma suposição, não uma medição. Modo de jogo novo entra aqui.
- Esses dois formatadores devolvem string em pt-BR cravada, fora do `t()`. Modo novo herda o mesmo
  problema.

## 8. Fixtures: só se o schema mudou

`src/services/__fixtures__/` fixa **forma**, não valor. Winrate desatualizado não quebra teste
nenhum. Regenerar só quando a STRATZ ou a OpenDota mudarem o schema da resposta — e não há script:
é captura manual de resposta real, anonimizada à mão.

## 9. Fechar

```bash
npm test        # gate de release; teste vermelho bloqueia a publicação
npm run build   # tsc -b + vite build — é onde moram os gates de tipo
npx oxlint
```

---

Mapa das pastas e o que cada uma faz: [../CLAUDE.md](../CLAUDE.md) e os `CLAUDE.md` de cada pasta.
