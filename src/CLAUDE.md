# src/

O renderer inteiro. É um cliente puro: nenhuma chamada sai daqui sem passar por `services/`, e
nenhum número aparece na tela sem procedência (ver a doutrina em [../CLAUDE.md](../CLAUDE.md)).

## Arquivos e pastas

| Item | Papel |
| --- | --- |
| `App.tsx` | Orquestrador único. Guarda token, perfil atual, histórico de perfis, partida e slot selecionados, aba ativa e `panelView`. Alterna dashboard ↔ partida ↔ hero grid e monta as quatro abas |
| `main.tsx` | Bootstrap do React (`createRoot` + `StrictMode`). Sem lógica de domínio |
| `index.css` | Tema global: variáveis CSS, scrollbar, `.glass-card`, `.glow-*` |
| `components/` | Toda a UI, agrupada por tela ([CLAUDE.md](components/CLAUDE.md)) |
| `constants/` | Metadados estáticos do Dota e constantes de domínio ([CLAUDE.md](constants/CLAUDE.md)) — **é aqui que patch novo dá trabalho** |
| `context/` | `LanguageContext.tsx` — provider de i18n (`t()`, `language`, `setLanguage`), persiste em `window.api.store` ou `localStorage`. Pasta de um arquivo só, sem CLAUDE.md próprio |
| `hooks/` | Os três hooks com estado assíncrono ([CLAUDE.md](hooks/CLAUDE.md)) |
| `i18n/` | Os dois dicionários e os testes que os seguram ([CLAUDE.md](i18n/CLAUDE.md)) |
| `services/` | Rede: STRATZ, OpenDota, cache, resolução de patch ([CLAUDE.md](services/CLAUDE.md)) |
| `types/` | Contratos de domínio ([CLAUDE.md](types/CLAUDE.md)) |
| `utils/` | Motores puros e testáveis ([CLAUDE.md](utils/CLAUDE.md)) |

## Navegação em duas camadas (`App.tsx`)

- **`PanelView`** — sem partida selecionada: `DASHBOARD` (padrão) · `HERO_GRID_PANEL` →
  `HeroGridTab` · `HERO_GRID_MIRROR` → `HeroGridMirrorScreen`.
- **`MatchTab`** — com `selectedMatch`: `OVERVIEW` (`TeamOverviewCard` + `AdvantageTimeline` +
  `ScoreboardTable`) · `PERFORMANCE` (`PlayerPerformanceTab`) · `VISION` (`WardMinimapTab`) ·
  `COACHING` (`CoachingInsightsTab`).

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
