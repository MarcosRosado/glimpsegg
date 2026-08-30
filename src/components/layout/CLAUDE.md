# src/components/layout/

O chrome do app — a moldura que não pertence a nenhuma tela.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `Navbar.tsx` | Topbar: marca, identidade do jogador, busca, configurações, toggle do hero grid | `App.tsx` |
| `StatRail.tsx` | Segunda faixa: forma recente, IMP, KDA, farm e **a versão do patch** (via `useGamePatch`) | `Navbar.tsx` |

## Regras locais

- O `StatRail` exibe o patch (o `SettingsModal` é o outro consumidor de `useGamePatch`). O valor vem
  do hook, nunca de constante — `CURRENT_GAME_PATCH` é só o piso do fallback de
  `services/gameVersionService.ts`.
- O corte de cor daqui (`avgImp >= 0`) é decisão visual, não calibração de gameplay.

## Ao sair um patch

Nada aqui muda por patch. O número do patch se resolve sozinho em runtime — ver
[`services/CLAUDE.md`](../../services/CLAUDE.md).

Ver também: [../CLAUDE.md](../CLAUDE.md)
