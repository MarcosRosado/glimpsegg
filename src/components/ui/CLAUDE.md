# src/components/ui/

Primitivos compartilhados entre telas. Nada de domínio de Dota mora aqui — só apresentação.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `IconButton.tsx` | Botão de ícone padronizado do chrome | `Navbar` |
| `ImpBadge.tsx` | Chip de IMP: cor e ícone por faixa, com destaque para valor extremo | `MatchList`, `ScoreboardTable` |
| `Tooltip.tsx` | Tooltip posicionado por portal | `HeroGridMirrorScreen` |

## Regras locais

- O limiar de IMP extremo é `IMP_EXTREME` em [`utils/dotaFormatters.ts`](../../utils/CLAUDE.md),
  não neste arquivo — o badge só consome a decisão.
- `Tooltip.tsx` usa portal de propósito: dentro do `transform: scale()` da réplica do hero grid,
  posicionamento relativo quebra.

## Ao sair um patch

Nada aqui muda por patch.

Ver também: [../CLAUDE.md](../CLAUDE.md)
