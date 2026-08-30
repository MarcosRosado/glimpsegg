# src/types/

Os contratos do app. Com `strict: false` no `tsconfig.app.json`, união fechada e `Record<K, V>`
daqui são praticamente a única rede de tipos que existe — ver *Gates* em
[../../CLAUDE.md](../../CLAUDE.md).

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `dota.ts` | Domínio da partida e do perfil: `MatchDetails`, `MatchPlayer`, `PlayerProfileSummary`, `PlayerMatchSummary`, `MatchDataAvailability`, `BenchmarkSource`, `CoachingInsight`, `VisionData`/`WardPlacement`/`VisionSource`, `Role`, `Lane`, `LaneOutcome`, `PlayerLaneResult`, `MatchDynamicType`, `RadarStats`, `LaningStats`, `DamageReport` | `services/`, `utils/`, `components/`, `App.tsx` |
| `electron.d.ts` | Superfície do `window.api`: `ElectronApi` (`store`, `stratzQuery`, `openDotaFetch`, `resolveSteamId`, `windowControl`, `updater`, `getPlatform`, `getVersion`, `heroGrid`), `AppConfig` e `HeroGridApi`. Traz o `declare global` que tipa `Window.api` | ambiente global — todo `window.api` do renderer |
| `heroGrid.ts` | Formato bruto do arquivo da Valve (`HeroGridFile`, `HeroGridConfig`, `HeroGridCategory`) e os tipos da feature: `MetaWinrate`, `PersonalWinrate`, `HeroScore`, `MirrorResult`, `HeroGridPreferences`, `SyncOutcome`, `SyncState`, `HeroGridResult`, `HeroGridErrorCode` | `services/heroGrid/`, `utils/heroGrid/`, `hooks/useHeroGridSync.ts`, `components/heroGrid/` |

## Regras locais

- **`MatchDataAvailability` tem 10 flags** (`parsed`, `perMinuteStats`, `networthSeries`,
  `deathEvents`, `damageReport`, `wards`, `advantageTimeline`, `heroAverage`, `abilities`,
  `laneOutcomes`). Condição nova de disponibilidade **entra aqui**, não vira `if` solto no
  componente. Regra ou seção que exija flag ausente é pulada, nunca estimada.
- **`BenchmarkSource` carrega procedência, e a UI renderiza isso.** `ROLE_BASELINE` é constante
  estática e **precisa** aparecer rotulado como estimativa.
- **`'UNKNOWN'` é membro legítimo de `Role`, `Lane`, `MapTeam` e `PlayerLaneResult`** — é assim que
  o app diz "não sei" em vez de chutar. Remover esse membro para "simplificar" reintroduz o palpite.
- `AppConfig` tem **todas** as chaves da feature de hero grid opcionais: quem atualiza de uma versão
  anterior não as tem no `stratz_app_config.json`, e ausente lê como o default de
  `utils/heroGrid/preferences.ts`, que mantém a feature desligada. O default mora num lugar só.
- `window.api.heroGrid` é opcional de propósito: ausente no caminho browser e num preload antigo.
  Os dois casos significam a mesma coisa para a UI — não há como gravar layout.
- **Sem index signature em `heroGrid.ts`.** Campo desconhecido que a Valve acrescente é preservado
  em **runtime** (spread no `mirrorBuilder` + serializador próprio), não pelo tipo; um
  `[k: string]: unknown` só silenciaria erro de digitação.

## Ao sair um patch

Nada aqui muda por patch de Dota. Estes tipos descrevem a **forma** da resposta e do arquivo, não o
conteúdo do jogo: herói, item e habilidade novos entram em `constants/`, e valor de meta é dado, não
tipo. O que mexe neste diretório é mudança de **schema** — campo novo da STRATZ que se queira expor,
`version` novo do `hero_grid_config.json`, ou canal IPC novo no preload.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../services/CLAUDE.md](../services/CLAUDE.md) ·
[../services/heroGrid/CLAUDE.md](../services/heroGrid/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md)
