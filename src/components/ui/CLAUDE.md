# src/components/ui/

Primitivos compartilhados entre telas. Nada de domínio de Dota mora aqui — só apresentação.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `IconButton.tsx` | Botão de ícone padronizado do chrome | `Navbar` |
| `GlintBadge.tsx` | Chip do **Glint experimental** (0 a 100) e o hook `useGlintHint`. A procedência faz parte do chip: `title` com as métricas do teste e selo "beta" no tamanho `md`. Não renderiza nada com nota nula | `MatchList`, `ScoreboardTable`; o hook também em `TeamOverviewCard`, `PlayerPerformanceTab` e na dashboard |
| `EstimateChip.tsx` | Selo "estimativa" para número comparado contra constante fixa (`ROLE_BASELINE`): o `hint` diz de onde vem a estimativa e vira o `title` | `Navbar`, `ProfileHeader`, `PlayerPerformanceTab`, `AccountStats` |
| `Tooltip.tsx` | Tooltip posicionado por portal | `HeroGridMirrorScreen` |
| `Skeleton.tsx` | `Skeleton` (bloco pulsante), `SkeletonCard` (moldura com o anúncio para leitor de tela) e `SkeletonRows` (linhas de lista). Só na **primeira** carga; recarga com dado na tela usa `opacity-60` | seções, `MatchSkeleton`, `HomeSkeleton`, `HeroDetailPanel` |
| `LoadError.tsx` | `LoadErrorNotice` (a faixa vermelha com a mensagem e "tentar de novo", que gira com `retrying`) e `LoadErrorCard` (o cartão com o título do que não veio e a faixa). Cartão cuja chamada falhou **fica**, com o erro dentro; carregado e vazio é outra regra | `AccountStats`, `AccountSection`, `HomeSection`, `MatchesSection`, `HeroesSection` |
| `PatchTransitionNotice.tsx` | Aviso temporário (chip ou banner) de que os agregados de meta ainda misturam o patch anterior. Não renderiza nada fora da janela | `Navbar`, `CoachingInsightsTab`, `HeroGridTab` |

## Regras locais

- Os limiares do Glint (`GLINT_THRESHOLDS`) moram em [`utils/glint.ts`](../../utils/CLAUDE.md),
  não neste arquivo — o badge só consome a decisão.
- `Tooltip.tsx` usa portal de propósito: dentro do `transform: scale()` da réplica do hero grid,
  posicionamento relativo quebra.

## Ao sair um patch

Nada aqui se edita por patch. O `PatchTransitionNotice` liga e desliga por `PATCH_TRANSITION`
em [`constants/gameVersion.ts`](../../constants/CLAUDE.md), não neste diretório.

Ver também: [../CLAUDE.md](../CLAUDE.md)
