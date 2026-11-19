# src/services/heroGrid/

As fontes de meta do layout espelho de heróis e a ponte para o arquivo em disco. A decisão de *o
que* escrever mora em `utils/heroGrid/`; aqui só se busca dado e se conversa com o main.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `openDotaWinrates.ts` | **A fonte de meta — a única**, sem token. `fetchOpenDotaMetaWinrates` + o mapper puro `mapHeroStatsToWinrates`, que agrega os buckets de `BRACKET_BUCKETS` por `RankBracketBasic` | `hooks/useHeroGridSync.ts` |
| `personalWinrates.ts` | Histórico pessoal por herói via OpenDota (`players/{id}/heroes`), público. `mapPlayerHeroesToPersonal` + `fetchPersonalWinrates`, com cache próprio de 1 hora | `hooks/useHeroGridSync.ts` |
| `heroGridBridge.ts` | Ponte para `window.api.heroGrid`: `listAccounts`, `readFile`, `writeFile`, `restoreBackup`, `listBackups`, `isDotaRunning`, mais `isHeroGridFileAccessAvailable` e `isUnavailableInBrowser` | `hooks/useHeroGridSync.ts`, `settings/SettingsModal.tsx` |

## Regras locais

- **Uma fonte de meta só: OpenDota.** A STRATZ era a segunda (`stratzWinrates.ts`, apagado em
  2026-11-19 junto com o teste e a fixture `hero-winrates.json`). Ela foi **removida da lista de
  fontes**, não deixada falhando: com o slot presente e sempre fora, toda sincronização sairia
  `PARTIAL`. Hoje OpenDota respondeu ⇒ `SUCCESS` pleno; OpenDota fora ⇒ `FAILURE`, que **não
  escreve** e deixa o marcador de sucesso intacto. A classificação acontece em
  `utils/heroGrid/sourcePrecedence.ts` (`openDotaSourceInput`), que continua contando slots — fonte
  nova entra como mais um e o `PARTIAL` volta a existir sozinho.
- **Fonte nova só entra com winrate, amostra e procedência.** Se um dia a STRATZ voltar: o
  `heroStats.winWeek` usa `bracketIds: [RankBracket]` (enum **por medalha**), não o
  `RankBracketBasic` do resto do projeto — verificado por introspecção e requisições reais. Não
  reconstruir por palpite; o histórico do git tem o mapper.
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
  `api:opendota-fetch`.

## Ao sair um patch

- Herói novo aparece sozinho na fonte de meta e no histórico pessoal — são agregados, não catálogo local. O que
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
