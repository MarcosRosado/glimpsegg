# src/services/heroGrid/

As fontes de meta do layout espelho de heróis e a ponte para o arquivo em disco. A decisão de *o
que* escrever mora em `utils/heroGrid/`; aqui só se busca dado e se conversa com o main.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `openDotaWinrates.ts` | **Fonte primária**, sem token. `fetchOpenDotaMetaWinrates` + o mapper puro `mapHeroStatsToWinrates`, que agrega os buckets de `BRACKET_BUCKETS` por `RankBracketBasic` | `hooks/useHeroGridSync.ts` |
| `stratzWinrates.ts` | Fonte secundária, exige token. `GET_HERO_META_WINRATES_QUERY` (`heroStats.winWeek`), `mapWinWeekRows`, `fetchStratzWinrates` e o status tipado `StratzWinratesStatus` (`OK`/`EMPTY`/`NO_TOKEN`/`ERROR`) com os predicados `stratzSourceFailed`/`stratzSourceContributed`. O transporte é injetável (`StratzTransport`), por isso o teste roda sem rede | `hooks/useHeroGridSync.ts` |
| `personalWinrates.ts` | Histórico pessoal por herói via OpenDota (`players/{id}/heroes`), público. `mapPlayerHeroesToPersonal` + `fetchPersonalWinrates`, com cache próprio de 1 hora | `hooks/useHeroGridSync.ts` |
| `heroGridBridge.ts` | Ponte para `window.api.heroGrid`: `listAccounts`, `readFile`, `writeFile`, `restoreBackup`, `listBackups`, `isDotaRunning`, mais `isHeroGridFileAccessAvailable` e `isUnavailableInBrowser` | `hooks/useHeroGridSync.ts`, `settings/SettingsModal.tsx` |

## Regras locais

- **Precedência OpenDota → STRATZ.** A fonte que não exige token vem primeiro, e a feature fecha
  inteira sem token nenhum. Uma fonte fora ⇒ resultado `PARTIAL`, que **escreve** e é rotulado; as
  duas fora ⇒ `FAILURE`, que **não escreve** e deixa o marcador de sucesso intacto. A combinação
  acontece em `utils/heroGrid/sourcePrecedence.ts` (`openDotaSourceInput`).
- **`bracketIds: [RankBracket]`, não `RankBracketBasic`.** `heroStats.winWeek` usa o enum **por
  medalha** — diferente do `RankBracketBasicEnum` que `itemFullPurchase` aceita e que o resto do
  projeto usa. Verificado por introspecção e por requisições reais; as faixas somam exatamente o
  `ALL`. `BRACKET_TO_MEDAL_IDS` faz a expansão. Não trocar por palpite.
- **O TTL de 1h do `personalWinrates.ts` é deliberadamente diferente dos 7 dias do `statsCache`**, e
  **não** tem relação com patch: histórico do jogador muda todo dia e não vira com o patch. Cachear
  por uma semana faria a nota combinada ignorar as partidas recentes.
- **A ponte não é fronteira de confiança.** `heroGridBridge.ts` roda no renderer; a validação de
  caminho é do main (`electron/heroGrid/pathGuard.cjs`). Checagem aqui é mensagem de erro mais
  amigável, nunca garantia — quem contorna a ponte fala com o IPC direto.
- **A ponte nunca lança.** Toda função devolve `HeroGridResult<T>`; sem `window.api` o resultado é
  `{ success: false, code: 'UNAVAILABLE' }` — jamais sucesso simulado, porque escrita "bem-sucedida"
  que não gravou nada registraria espelho e data de sincronização inexistentes.
- Nenhum host novo, nenhuma mudança de CSP, nenhum handler IPC de rede novo: reaproveita
  `api:opendota-fetch` e o `api:stratz-graphql` genérico.

## Ao sair um patch

- Herói novo aparece sozinho nas duas fontes — são agregados globais, não catálogo local. O que
  falha é o **nome**: `getHero` devolve fallback, então o espelho ordena certo e exibe `Hero #<id>`
  até `constants/heroes.ts` ser atualizado.
- O cache de meta é o `statsCache` (invalidação dura por patch), então a virada limpa sozinha. O
  cache pessoal de 1h ignora patch de propósito e não precisa de ação.
- O winrate usado é o **geral do herói**, nunca por posição — não há como inferir a função de um
  grupo pelo nome dele, e a tela tem de dizer isso.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../__fixtures__/CLAUDE.md](../__fixtures__/CLAUDE.md) ·
[../../types/CLAUDE.md](../../types/CLAUDE.md) ·
[../../components/heroGrid/CLAUDE.md](../../components/heroGrid/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../../docs/PATCH-CHECKLIST.md)
