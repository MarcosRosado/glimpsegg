# Contrato: fontes de winrate

Precedência fixa e visível (FR-015): **OpenDota → STRATZ**. Duas fontes, ambas entregando winrate
**e** tamanho de amostra. Cada linha de dado sai destas funções já com procedência; nenhuma camada
acima infere fonte.

**Sem recorte por posição** (FR-034): o winrate usado é o **geral do herói** por ranque. Nenhuma
fonte é consultada por posição, e a tela precisa dizer que o número não é o da função do grupo
(FR-034b).

> **Dota 2 Pro Tracker foi cortado do escopo** na clarificação de 2026-08-26 (FR-013a). O que ele
> publica de forma consumível é ordem de meta, sem winrate e sem amostra — não satisfaz FR-014. Ver
> `research.md § R4` para o achado completo, que serve de justificativa e de ponto de partida caso a
> fonte seja reavaliada no futuro sob FR-013b.

---

## 1. OpenDota — fonte primária

**Verificado nesta sessão** (`GET /api/heroStats`, HTTP 200, 127 heróis, 60 campos por herói).
Pública, sem chave. `fetchOpenDotaHeroStats()` **já existe** em `src/services/opendota.ts` —
reaproveitar, não reescrever.

Campos usados: `1_pick`/`1_win` … `8_pick`/`8_win` (buckets de rank tier).

Mapa bucket → bracket do app, na mesma partição que `tierToBracket()` já usa:

| `RankBracketBasic` | Buckets somados |
| --- | --- |
| `HERALD_GUARDIAN` | 1, 2 |
| `CRUSADER_ARCHON` | 3, 4 |
| `LEGEND_ANCIENT` | 5, 6 |
| `DIVINE_IMMORTAL` | 7, 8 |
| `ALL` | 1..8 |

| Aspecto | Valor |
| --- | --- |
| `source` | `OPENDOTA_BRACKET` |
| Amostra | soma dos `_pick` dos buckets do grupo |
| Por que vem primeiro | não exige token, uma requisição, já integrada. A feature funciona sem configuração alguma (FR-015a) |
| Bucket com `pick === 0` | herói sem dado naquele bracket — **não** virar 0% |
| Amostra real | grande: 19.239 picks só de Anti-Mage no bucket 7, verificado |
| Cache | `statsCache`, chave `['gridmeta','od',bracket]`, TTL 7 dias, invalidado por patch |

---

## 2. STRATZ — segunda fonte

Preenche herói que a OpenDota não devolveu e serve de segunda medição. Vai pelo
`api:stratz-graphql` genérico: nenhum host novo, nenhuma mudança de CSP, nenhum handler novo —
igual a `stratzHeroStats.ts`.

**VERIFICADO contra a API real em 2026-08-26** (introspecção + 6 requisições HTTP 200, uma por
bracket). A incógnita de contrato está **fechada**, e a suposição do plano estava **errada**:

```graphql
query GetHeroMetaWinrates($brackets: [RankBracket]) {
  heroStats {
    winWeek(take: 1, bracketIds: $brackets) {
      week
      heroId
      winCount
      matchCount
    }
  }
}
```

| O que se supôs | O que a API tem |
| --- | --- |
| `bracketBasicIds: [RankBracketBasicEnum]` | **`bracketIds: [RankBracket]`** — o argumento tem outro nome *e* outro enum |
| enum de 4 faixas agregadas | `RankBracket` é **por medalha**: `UNCALIBRATED`, `HERALD`, `GUARDIAN`, `CRUSADER`, `ARCHON`, `LEGEND`, `ANCIENT`, `DIVINE`, `IMMORTAL` |

Ou seja: `winWeek` **não** aceita o `RankBracketBasicEnum` que o resto do projeto usa
(`stratzHeroStats.ts` usa, porque `itemFullPurchase` aceita — são argumentos diferentes de campos
diferentes). O mapper precisa **expandir** o `RankBracketBasic` do app na lista de medalhas:

| `RankBracketBasic` do app | `bracketIds` a enviar |
| --- | --- |
| `HERALD_GUARDIAN` | `['HERALD', 'GUARDIAN']` |
| `CRUSADER_ARCHON` | `['CRUSADER', 'ARCHON']` |
| `LEGEND_ANCIENT` | `['LEGEND', 'ANCIENT']` |
| `DIVINE_IMMORTAL` | `['DIVINE', 'IMMORTAL']` |
| `UNCALIBRATED` | `['UNCALIBRATED']` |
| `ALL` | **omitir o argumento** (`null`) — sem filtro |

Essa partição é a **mesma** de `tierToBracket()`, então o app não ganha vocabulário novo: a expansão
é uma tabela de literais em `stratzWinrates.ts`, não um conceito.

**Forma da resposta, medida:**

| Fato | Valor medido |
| --- | --- |
| Linhas devolvidas | **127, uma por herói** — `take: 1` é 1 semana, e sem `groupBy` a API já agrega por herói |
| Duplicata por `heroId` | nenhuma (`max 1` linha por herói em todos os 6 brackets) |
| `groupBy` | **não passar.** O default já entrega o agrupamento desejado; o enum é `HERO_ID`/`ALL`/`HERO_ID_DURATION_MINUTES`/`TIME`/`HERO_ID_POSITION_BRACKET` |
| `durationMinute` | vem `0` sem `groupBy` de duração — **não pedir o campo**, ele não significa nada aqui |
| Amostra por bracket | HERALD_GUARDIAN 12,7M · CRUSADER_ARCHON 27,9M · LEGEND_ANCIENT 19,0M · DIVINE_IMMORTAL 5,0M · UNCALIBRATED 1,7M · ALL 66,4M partidas |
| Coerência | a soma das 5 faixas dá exatamente o `ALL` — a partição é completa e disjunta |

Fixture: `src/services/__fixtures__/hero-winrates.json`, resposta real 200, sem token e sem dado de
jogador (o agregado é global). Contém `divineImmortal` completa (127 heróis), amostras de `all` e
`heraldGuardianSample`, além dos casos `emptyBracket` e `rateLimited` para os caminhos ruins.

| Aspecto | Valor |
| --- | --- |
| `source` | `STRATZ_BRACKET` |
| Amostra | `matchCount` |
| `positionIds` | **não passar.** Recorte por posição está fora de escopo (FR-034) |
| `bracketIds` | expandir o `RankBracketBasic` na tabela de medalhas acima. `ALL` => omitir |
| `groupBy` | **não passar.** O default já devolve uma linha por herói |
| Token ausente | fonte indisponível — a feature roda inteira só com OpenDota, rotulado (FR-015a, FR-016) |
| HTTP 429 | `RateLimitedError`, **sem retry** — mesmo tratamento de `stratzHeroStats.ts` |
| Cache | `statsCache`, chave `['gridmeta','stratz',bracket]`, TTL 7 dias, invalidado por patch |

---

## 3. Desempenho pessoal

`GET /api/players/{account_id}/heroes` da OpenDota. Público, sem token, uma requisição. Devolve por
herói `games` e `win` do jogador.

| Aspecto | Valor |
| --- | --- |
| Amostra | `games` — é o que FR-032 manda exibir por herói |
| `games === 0` | Herói nunca jogado. `personalWeight = 0` em `COMBINED`; `score = null` em `PERSONAL_ONLY` |
| Cache | TTL curto (1h): o histórico do jogador muda todo dia, ao contrário dos agregados de meta |
| Ausente | Perfil não configurado → `COMBINED` opera como `META_ONLY`, rotulado (FR-030c) |

---

## 4. Composição da nota

```
metaComponent     = wilsonLowerBound(wins, matchCount)
personalComponent = wilsonLowerBound(playerWins, playerGames)
personalWeight    = playerGames / (playerGames + K)     // K = 20
score             = (1 - personalWeight) * metaComponent + personalWeight * personalComponent
```

**`K = 20`**, valor inicial com justificativa — não é número solto. A curva que ele produz:

| Jogos do jogador com o herói | Peso do componente pessoal |
| --- | --- |
| 0 | 0,00 |
| 3 | 0,13 |
| 10 | 0,33 |
| **20** | **0,50** |
| 50 | 0,71 |
| 100 | 0,83 |

A escolha é: **20 jogos é onde o histórico do jogador passa a pesar tanto quanto o meta**. Abaixo de
uns 5 jogos o pessoal quase não move a ordem, que é o comportamento que FR-030a pede; acima de 50 o
meta vira contexto e a experiência do jogador domina, que é o que faz a nota combinada valer a pena.
O valor mora numa constante nomeada no topo de `src/utils/heroGrid/ranking.ts`, com este raciocínio
no comentário, seguindo a convenção de `constants/` do projeto. Ajustar `K` é ajustar uma constante
documentada, não reescrever a fórmula — e a tabela acima é o que o teste de monotonicidade ancora.

`wilsonLowerBound` é `src/utils/insights/wilson.ts`, que já existe e já é testado — zero dependência
nova, e é a função que o projeto adotou justamente para amostra pequena não virar recomendação
confiante (FR-019, FR-030a).

O `breakdown` que a UI exibe (FR-030b) é literalmente esses valores intermediários. Nota sem
`breakdown` disponível não é exibível.

---

## 5. Degradação (FR-016, FR-017)

| Situação | `outcome` | Escreve arquivo? |
| --- | --- | --- |
| Ambas responderam | `SUCCESS` | sim |
| Só OpenDota (sem token, ou STRATZ fora) | `PARTIAL` | sim, com rótulo de qual faltou |
| Só STRATZ (OpenDota fora) | `PARTIAL` | sim, com rótulo de qual faltou |
| Nenhuma das duas | `FAILURE` | **não** — arquivo intacto, `lastSuccessfulSyncAt` intacto |
