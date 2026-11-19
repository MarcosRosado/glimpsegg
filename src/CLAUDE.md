# src/

O renderer inteiro. É um cliente puro: nenhuma chamada sai daqui sem passar por `services/`, e
nenhum número aparece na tela sem procedência (ver a doutrina em [../CLAUDE.md](../CLAUDE.md)).

## Arquivos e pastas

| Item | Papel |
| --- | --- |
| `App.tsx` | Orquestrador único. Guarda a conta Steam configurada, o perfil atual, histórico de perfis, partida e slot selecionados, aba ativa, `section` e `heroGridView`. Monta a moldura (barra lateral + topo), as seções e a partida |
| `main.tsx` | Bootstrap do React (`createRoot` + `StrictMode`). Sem lógica de domínio |
| `index.css` | Tema global: variáveis CSS, scrollbar, `.glass-card`, `.glow-*` |
| `components/` | Toda a UI, agrupada por tela ([CLAUDE.md](components/CLAUDE.md)) |
| `constants/` | Metadados estáticos do Dota e constantes de domínio ([CLAUDE.md](constants/CLAUDE.md)) — **é aqui que patch novo dá trabalho** |
| `context/` | `LanguageContext.tsx` — provider de i18n (`t()`, `language`, `setLanguage`), persiste em `window.api.store` ou `localStorage`. Pasta de um arquivo só, sem CLAUDE.md próprio |
| `hooks/` | Os dois hooks com estado assíncrono ([CLAUDE.md](hooks/CLAUDE.md)) |
| `i18n/` | Os dois dicionários e os testes que os seguram ([CLAUDE.md](i18n/CLAUDE.md)) |
| `services/` | Rede: OpenDota, cache, resolução de patch (a STRATZ saiu do runtime em 2026-11-19) ([CLAUDE.md](services/CLAUDE.md)) |
| `types/` | Contratos de domínio ([CLAUDE.md](types/CLAUDE.md)) |
| `utils/` | Motores puros e testáveis ([CLAUDE.md](utils/CLAUDE.md)) |

## Navegação (`App.tsx`, desde a 2.0)

A moldura é a de docs/PROPOSTA-V2.md §3, com as escolhas do dono de 2026-11-19: barra lateral
que recolhe em trilho (`layout/Sidebar.tsx`), Início com a última partida no topo, partida
analisada em abas com um seletor de jogador só.

- **`AppSection`** (`layout/Sidebar.tsx`) — sem partida aberta: `HOME` (Início) · `MATCHES`
  (`MatchesSection`) · `HEROES` (`HeroesSection`) · `ACCOUNT` (`ProfileHeader`, `AccountStats` e a
  parte de conta do `TrendsCard`) ·
  `HERO_GRID`, só com a feature ligada, com `heroGridView` `PANEL` → `HeroGridTab` ou
  `MIRROR` → `HeroGridMirrorScreen`. Seção sem dado fica em `HIDDEN_SECTIONS` e some da barra
  (hoje vazia).
- **Partida aberta** (`selectedMatch`) — duas formas, decididas por `availability.parsed`:
  - **sem análise, "modo placar"**: `ParseRequestCard`, `TeamOverviewCard variant="scoreboard"`
    (só os destaques de papel) e o `ScoreboardTable`. Sem abas, sem linha de vantagem, sem
    comparativo, sem "quem liderou" e sem melhor por posição (decisão 2 do dono);
  - **analisada**: `MatchTab` (`utils/navigation.ts`) — `SUMMARY` (`TeamOverviewCard` +
    `AdvantageTimeline` + `ScoreboardTable`) · `MY_GAME` (`PlayerPerformanceTab`) · `VISION`
    (`WardMinimapTab`) · `COACHING` (`CoachingInsightsTab`) e `FIGHTS` (`FightsTab`), esta só com
    `availability.teamfights` (`analyzedTabs`).
- **Aba inicial**: `initialMatchView` — "Meu jogo" só quando o slot achado é da conta
  configurada e a partida foi analisada; senão "Resumo". Vale também quando a análise chega
  durante a espera.
- **Busca (Ctrl+K)**: `classifySearchInput` — link de partida ou id acima de 32 bits abre a
  partida; número que cabe em 32 bits busca a conta e o modal oferece a partida ao lado.

Os três modais (`OnboardingModal`, `SearchPlayerModal`, `SettingsModal`) também são montados aqui.

## Regras locais

- Componentes `.tsx` **não têm teste** — o vitest roda com `environment: 'node'` e
  `include: ['tests/**/*.test.ts', 'tests/**/*.test.cjs']`. Comportamento que precisa de teste sai
  do componente e vira função pura em `utils/` ou `services/`.
- **A suíte não mora aqui.** Todo `.test.ts` vive em `tests/`, numa árvore que espelha esta
  (`src/utils/laneResult.ts` → `tests/utils/laneResult.test.ts`); `src/` contém só o que o app
  embarca. Ver [../tests/CLAUDE.md](../tests/CLAUDE.md).
- Todo serviço tem os dois caminhos (Electron por IPC / browser por `fetch`). Código de rede novo
  precisa cobrir os dois.
- `useHeroGridSync` é instância **única**, criada no `App.tsx` e passada na prop `sync` para
  `HeroGridTab` e `HeroGridMirrorScreen`; o `SettingsModal` recebe só callbacks presos a ela. Não
  instanciar de novo.

## Ao sair um patch

Quase nada muda aqui — o `App.tsx` não conhece herói nem item. O trabalho está em
`constants/`, `utils/` e nos limiares de `components/dashboard/`. Roteiro completo em
[docs/PATCH-CHECKLIST.md](../docs/PATCH-CHECKLIST.md).
