# Phase 1 — Data Model

**Feature**: `specs/001-meta-hero-grid` | **Date**: 2026-08-26

Alvo: `src/types/heroGrid.ts`. Convenção do projeto — identificadores em inglês, comentários em
pt-BR explicando *por que*. Nomes aqui são propostas de assinatura, não código final.

---

## 1. Arquivo de grids (espelha o formato da Valve)

```ts
/** Formato do hero_grid_config.json. Verificado contra arquivo real: version 3. */
interface HeroGridFile {
  version: number;              // 3 no arquivo real. Preservar o valor lido, não fixar.
  configs: HeroGridConfig[];    // Array. O espelho é UM elemento novo aqui. É a base do FR-007.
}

interface HeroGridConfig {
  config_name: string;
  categories: HeroGridCategory[];
}

interface HeroGridCategory {
  category_name: string;
  x_position: number;           // Copiado da origem. Sem isso o espelho renderiza fora de lugar.
  y_position: number;
  width: number;
  height: number;
  hero_ids: number[];           // A ORDEM é o que aparece no jogo. Único campo que o espelho altera.
}
```

### Identidade: posição, nunca nome

```ts
/**
 * Como o app se refere a um layout. `index` é a identidade; `name` é rótulo para o jogador.
 *
 * Por que não `config_name`: o Dota 2 permite dois layouts com o mesmo nome, permite dois GRUPOS
 * com o mesmo nome (o grid de meta publicado pelo D2PT repete "Best with" sete vezes num layout
 * so), e permite renomear a qualquer momento. Identidade por nome perde o rastro do espelho num
 * rename e cria um segundo na sincronizacao seguinte, violando FR-008c.
 */
interface ConfigRef {
  index: number;                // posição no array `configs`. A identidade.
  name: string;                 // último nome conhecido. Só para exibir e para detectar rename.
}
```

**Invariantes**

| # | Invariante | Requisito |
| --- | --- | --- |
| I-1 | O `HeroGridConfig` na posição da origem no arquivo escrito é **igual em profundidade** ao lido. Diferente → abortar sem gravar | FR-007b |
| I-2 | Nenhum outro `HeroGridConfig` do array é alterado, em nenhuma posição | FR-007a |
| I-3 | `version` é preservado do arquivo lido | — |
| I-4 | Existe no máximo um espelho por layout de origem, identificado por **posição**. Renomear o espelho ou a origem no jogo não cria um segundo | FR-008c, FR-008h |
| I-4a | Categoria é identificada pela **posição** dentro do layout, nunca por `category_name`. Duas categorias de mesmo nome são espelhadas e ordenadas independentemente | FR-008i |
| I-4b | A ordem do array `configs` é preservada: o espelho é acrescentado no fim, e a posição dos layouts do jogador não muda | FR-007a |

---

## 2. Espelho e sua relação com a origem

```ts
/** Resultado puro de mirrorBuilder: o arquivo inteiro pronto para gravar. */
interface MirrorResult {
  file: HeroGridFile;           // origem intocada + espelho (novo ou substituído)
  source: ConfigRef;
  mirror: ConfigRef;
  /** Por grupo: quantos heróis foram ordenados e quantos ficaram sem dado. */
  perGroup: MirrorGroupReport[];
  /** Heróis do ranking que NÃO estão na origem. Só informativo — não entram no espelho. */
  outsideSource: number[];
  /** true quando a estrutura da origem mudou desde o último espelho. */
  structureChanged: boolean;
}

interface MirrorGroupReport {
  categoryIndex: number;        // a identidade — nomes podem repetir (I-4a)
  categoryName: string;         // rótulo, só para exibir
  ordered: number;
  withoutData: number;
}
// Sem campo de posição: FR-034 removeu o recorte por função. Todo grupo usa o winrate geral.
```

**Invariantes de espelhamento** — cada uma é um teste de `mirrorBuilder.test.ts`:

| # | Invariante | Requisito |
| --- | --- | --- |
| I-5 | `mirror.categories.length === source.categories.length` | FR-008 |
| I-6 | Para todo i: `category_name`, `x_position`, `y_position`, `width`, `height` idênticos à origem | FR-008 |
| I-7 | Para todo i: `new Set(mirror.hero_ids)` igual a `new Set(source.hero_ids)` — mesmo conjunto, mesma cardinalidade | FR-008a |
| I-8 | Herói presente em dois grupos da origem aparece nos dois grupos do espelho. Sem recorte por posição, recebe a **mesma** nota nos dois | achado da pesquisa + FR-034a |
| I-9 | Heróis sem dado vão para o fim do próprio grupo, preservando a ordem relativa que tinham na origem (ordenação estável) | FR-018 |
| I-10 | Chamar duas vezes com a mesma entrada produz o mesmo `file` — idempotência | FR-008c |

---

## 3. Winrate com procedência

```ts
/**
 * Vocabulário de fontes. Duas, na ordem de precedência (FR-015).
 * Mesma disciplina de BenchmarkSource em types/dota.ts.
 * NÃO existe fonte sem winrate: a proposta RANK_ONLY caiu com o corte do D2PT (FR-013a).
 */
type MetaSource = 'OPENDOTA_BRACKET' | 'STRATZ_BRACKET';

interface MetaWinrate {
  heroId: number;
  source: MetaSource;
  winRate: number;              // 0..1. Sempre presente — não há fonte sem winrate.
  wins: number;
  matchCount: number;           // o sampleSize que FR-014 manda exibir. Sempre presente.
  bracket: RankBracketBasic;    // reusa utils/rankBracket.ts
  /** false => caiu em ALL. A UI tem de dizer "média geral", nunca "no seu ranque". */
  bracketIsPlayerSpecific: boolean;
  patch: string;                // de gameVersionService
}
// Sem campo `position`: FR-034 removeu o recorte por função de todas as fontes.

interface PersonalWinrate {
  heroId: number;
  games: number;                // amostra pessoal — FR-032 manda exibir por herói
  wins: number;
  winRate: number;
}
```

**Invariantes**

| # | Invariante | Requisito |
| --- | --- | --- |
| I-11 | Todo `MetaWinrate` tem `winRate`, `wins` e `matchCount` definidos. Não existe caminho que produza um sem amostra | FR-014, FR-013b |
| I-12 | Nenhum `MetaWinrate` é construído sem `source` e sem `patch` | FR-014, FR-021 |
| I-13 | `bracketIsPlayerSpecific === false` ⇒ nenhum texto de UI pode dizer "no seu ranque" | FR-020 |
| I-14 | Herói ausente de todas as fontes **não** ganha um `MetaWinrate` com valores zerados — ganha ausência, que a nota trata como "sem dado" | FR-018 |

---

## 4. Nota combinada

```ts
interface HeroScore {
  heroId: number;
  /** Nota final usada para ordenar. Ausente => "sem dado". */
  score: number | null;
  /** As parcelas. FR-030b: sem isso a nota NÃO é exibível. */
  breakdown: {
    metaComponent: number | null;      // wilsonLowerBound do meta
    personalComponent: number | null;  // wilsonLowerBound do pessoal
    personalWeight: number;            // 0..1, cresce com games. 0 => pessoal não aplicado
  };
  meta?: MetaWinrate;
  personal?: PersonalWinrate;
  criterion: RankingCriterion;
  /** Motivo de score === null. Vai para a UI como "sem dado" + explicação. */
  noDataReason?: 'NO_META' | 'NO_PERSONAL_IN_PERSONAL_ONLY' | 'HERO_UNKNOWN';
}

type RankingCriterion = 'COMBINED' | 'META_ONLY' | 'PERSONAL_ONLY';  // COMBINED é o padrão
```

**Invariantes**

| # | Invariante | Requisito |
| --- | --- | --- |
| I-15 | `score !== null` ⇒ `breakdown` completo e coerente com `score` | FR-030b |
| I-16 | `personalWeight` é monotônico não decrescente em `games`, e `games === 0 ⇒ personalWeight === 0` | FR-030a |
| I-17 | `criterion === 'COMBINED'` e sem pessoal utilizável ⇒ `score` é o meta puro e `personalWeight === 0`. **Não** vira `null` | FR-030c |
| I-18 | `criterion === 'PERSONAL_ONLY'` e sem pessoal ⇒ `score === null` com `noDataReason`. **Nunca** cai para o meta em silêncio | FR-032a |
| I-19 | Amostra pequena não promove herói acima de amostra grande com vantagem comprovada — garantido pelo limite inferior de Wilson | FR-019 |

---

## 5. Preferências e estado de sincronização

```ts
/** Vai para AppConfig (electron.d.ts). Tudo com default que mantém a feature desligada. */
interface HeroGridPreferences {
  enabled: boolean;                    // default FALSE — FR-001
  steamId3: string | null;             // conta escolhida; pré-selecionada pelo steamAccountId do app
  gridFilePath: string | null;         // caminho manual, quando a detecção falha — FR-006
  source: ConfigRef | null;            // layout de origem — FR-005a. Posição + último nome visto
  mirror: ConfigRef | null;            // espelho — FR-008b. Sobrevive a rename (FR-008h)
  criterion: RankingCriterion;         // default 'COMBINED' — FR-030
  bracket: RankBracketBasic | null;    // null => derivar do perfil; cai em ALL rotulado
}
// Sem groupPositions (FR-034a) e sem d2ptEnabled (FR-013a).

interface SyncState {
  lastSuccessfulSyncAt: number | null; // epoch ms. Só sucesso mexe aqui — FR-017
  lastAttemptAt: number | null;
  consecutiveFailures: number;         // alimenta o backoff — FR-028
  history: SyncRecord[];               // as N mais recentes — FR-036
}

interface SyncRecord {
  at: number;
  outcome: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
  sourcesUsed: MetaSource[];
  sourcesFailed: MetaSource[];
  heroesOrdered: number;
  structureChanged: boolean;
  error?: string;                      // mensagem, nunca token
}
```

**Invariantes**

| # | Invariante | Requisito |
| --- | --- | --- |
| I-20 | `enabled === false` ⇒ nenhuma leitura de arquivo e nenhuma requisição de meta | FR-002 |
| I-21 | Ausência do token da STRATZ ⇒ `outcome` é `PARTIAL` com a OpenDota, nunca `FAILURE` | FR-015a |
| I-22 | `lastSuccessfulSyncAt` só avança em `outcome !== 'FAILURE'` | FR-017 |
| I-23 | `outcome === 'FAILURE'` ⇒ o arquivo de grids não foi escrito | FR-017, SC-006 |
| I-24 | Falha de **uma** das duas fontes ⇒ `outcome` é `PARTIAL` e o arquivo É escrito. Falha das duas ⇒ `FAILURE` e nada é escrito | FR-016, FR-017 |

---

## 6. Estados do agendamento

Máquina de estados de `syncScheduler.ts`, puro:

```text
IDLE ──(now - last >= 24h)──────────────────► DUE
IDLE ──(now - last < 0, relógio recuou)─────► IDLE   (não sincroniza, não reescreve o marcador)
DUE  ──(sync inicia)───────────────────────► RUNNING
RUNNING ──(sucesso)────────────────────────► IDLE    (last := now, failures := 0)
RUNNING ──(parcial)────────────────────────► IDLE    (last := now, failures := 0)
RUNNING ──(falha)──────────────────────────► BACKOFF (failures += 1, last INALTERADO)
BACKOFF ──(now - lastAttempt >= espera)────► DUE
qualquer ──(feature desligada)─────────────► OFF     (nenhum timer, nenhuma requisição)
```

Espera do backoff: `min(30min * 2^(failures-1), 6h)`.

Duas escritas nunca simultâneas: `RUNNING` é exclusivo, e o main process ainda tem sua própria trava
(FR-012) — a do renderer é conveniência, a do main é a garantia.

---

## 7. Contas Steam detectadas

```ts
/** Cabeçalho de estado do agendamento, para FR-024a. */
interface SyncFreshness {
  daysSinceLastSuccess: number | null;  // null => nunca sincronizou
  nextDueAt: number | null;
}

interface SteamAccountCandidate {
  steamId3: string;             // nome do diretório em userdata/. Só inteiro positivo.
  steamRoot: string;            // já resolvido por realpath — evita duplicata por symlink
  gridFilePath: string;
  gridFileExists: boolean;      // false é comum: o arquivo só nasce quando o jogador cria um grid
  isConfiguredProfile: boolean; // steamId3 === steamAccountId do app
}
```

**Invariantes**

| # | Invariante | Requisito |
| --- | --- | --- |
| I-25 | Nenhum candidato duplicado por `realpath` do `steamRoot` | R2 |
| I-26 | `0` e `anonymous` nunca aparecem como candidato | R2 |
| I-27 | `gridFileExists === false` é estado apresentável, não erro | R3 |

---

## Rastreabilidade

| Entidade da spec | Tipo aqui |
| --- | --- |
| Preferência de ordenação de loadout | `HeroGridPreferences` |
| Coleção de layouts de heróis | `HeroGridFile` |
| Layout de origem | `HeroGridConfig` na posição `preferences.source.index` |
| Layout espelho | `HeroGridConfig` na posição `preferences.mirror.index`, produzido por `MirrorResult` |
| Winrate de herói | `MetaWinrate` (sempre com `matchCount`) |
| Desempenho pessoal por herói | `PersonalWinrate` |
| Nota combinada | `HeroScore.breakdown` |
| Ranking de heróis | `HeroScore[]` ordenado |
| Registro de sincronização | `SyncRecord` |
| Cópia de segurança da coleção | arquivo `.glimpse.bak.<ts>`, sem tipo em memória |
